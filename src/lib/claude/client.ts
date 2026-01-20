import Anthropic from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getTestConfig } from '../claude_test';

// ============================================
// Supabase Service Role Client for Inngest
// ============================================

/**
 * Create a service role Supabase client that doesn't require cookies.
 * This is necessary because Inngest functions don't have access to
 * Next.js request context with cookies.
 */
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or service role key');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================
// Anthropic Client
// ============================================

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// LLM Logging
// ============================================

interface LLMLogEntry {
  user_id: string;
  prompt: string;
  output: string;
  model: string;
  prompt_type: string;
  tokens_used?: number;
  duration_ms?: number;
  inngest_job_id?: string;
}

export async function logLLMCall(entry: LLMLogEntry): Promise<void> {
  try {
    // Use service role client since this may be called from Inngest
    // which doesn't have access to Next.js cookies context
    const supabase = createServiceRoleClient();
    await supabase.from('llm_logs').insert(entry);
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log LLM call:', error);
  }
}

// ============================================
// Tool Use Helpers for Guaranteed JSON Output
// ============================================

/**
 * Extract the tool use result from an Anthropic message response.
 * When using tool_choice: { type: 'tool', name: '...' }, the response
 * is guaranteed to contain a tool_use block with valid JSON input.
 */
function extractToolUseResult<T>(message: Anthropic.Message, toolName: string): T {
  const toolUseBlock = message.content.find(
    (block): block is ToolUseBlock => block.type === 'tool_use' && block.name === toolName
  );

  if (!toolUseBlock) {
    throw new Error(`No tool use block found for tool: ${toolName}`);
  }

  // The input is already parsed JSON - guaranteed to match the schema
  return toolUseBlock.input as T;
}

/**
 * Call the LLM with tool use and automatic retry on transient failures.
 * This provides guaranteed valid JSON output matching the tool's schema.
 */
export async function callLLMWithToolUse<T>(options: {
  prompt: string;
  tool: Tool;
  model?: string;
  maxTokens?: number;
  maxRetries?: number;
  userId: string;
  promptType: string;
  jobId?: string;
}): Promise<{ result: T; usage: { outputTokens: number }; durationMs: number }> {
  const {
    prompt,
    tool,
    model: requestedModel,
    maxTokens: requestedMaxTokens,
    maxRetries = 2,
    userId,
    promptType,
    jobId,
  } = options;

  // ===== TEST MODE INTEGRATION =====
  const testConfig = getTestConfig();
  let model = requestedModel || 'claude-sonnet-4-5-20250929';
  let maxTokens = requestedMaxTokens || 16000;

  // Apply test mode configuration if enabled
  // Admin/utility operations bypass test mode restrictions
  const adminPromptTypes = ['usda_ingredient_matching', 'meal_photo_analysis'];
  const isAdminOperation = adminPromptTypes.includes(promptType);

  if (process.env.MEAL_PLAN_TEST_MODE && testConfig.mode !== 'production' && !isAdminOperation) {
    // Fixture mode should never reach here - all LLM calls should be bypassed
    if (testConfig.mode === 'fixture') {
      throw new Error(`[TEST MODE] Fixture mode should not make LLM calls. Called with promptType: ${promptType}`);
    }

    model = testConfig.model;

    // Map prompt type to appropriate token limit from test config
    switch (promptType) {
      case 'two_stage_core_ingredients':
        maxTokens = testConfig.maxTokensCore;
        break;
      case 'two_stage_meals_from_ingredients':
      case 'meal_type_batch_breakfast':
      case 'meal_type_batch_lunch':
      case 'meal_type_batch_dinner':
      case 'meal_type_batch_snack':
        maxTokens = testConfig.maxTokensMeals;
        break;
      case 'two_stage_grocery_list':
      case 'grocery_list_consolidation':
        maxTokens = testConfig.maxTokensGrocery;
        break;
      case 'prep_mode_analysis':
        maxTokens = testConfig.maxTokensPrep;
        break;
      default:
        // Use requested tokens for unknown prompt types
        maxTokens = requestedMaxTokens || 16000;
    }

    // Ensure we never send 0 tokens
    if (maxTokens === 0) {
      maxTokens = requestedMaxTokens || 16000;
    }

    // Log test mode info (only once per generation)
    if (promptType === 'two_stage_core_ingredients') {
      console.log(`[TEST MODE] ${testConfig.mode} | Model: ${model} | Tokens: ${maxTokens}`);
    }
  }
  // ===== END TEST MODE INTEGRATION =====

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();

      const message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: prompt }],
      });

      const duration = Date.now() - startTime;

      // Log the LLM call
      await logLLMCall({
        user_id: userId,
        prompt,
        output: JSON.stringify(message.content),
        model,
        prompt_type: promptType,
        tokens_used: message.usage?.output_tokens,
        duration_ms: duration,
        inngest_job_id: jobId,
      });

      // Check for max_tokens stop reason (truncation)
      if (message.stop_reason === 'max_tokens') {
        throw new Error(`Response was truncated (used ${message.usage?.output_tokens} tokens). Consider increasing max_tokens.`);
      }

      // Debug: Log the raw message content for prep_sessions
      if (tool.name === 'generate_prep_sessions') {
        console.log('[DEBUG] Raw LLM response for generate_prep_sessions:');
        console.log('  stop_reason:', message.stop_reason);
        console.log('  content blocks:', message.content.length);
        message.content.forEach((block, i) => {
          console.log(`  block ${i}: type=${block.type}${block.type === 'tool_use' ? `, name=${block.name}` : ''}`);
          if (block.type === 'tool_use') {
            console.log(`    input keys:`, Object.keys(block.input as Record<string, unknown>));
          }
        });
      }

      const result = extractToolUseResult<T>(message, tool.name);

      return {
        result,
        usage: { outputTokens: message.usage?.output_tokens || 0 },
        durationMs: duration,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on truncation errors - that's a config issue
      if (lastError.message.includes('truncated')) {
        throw lastError;
      }

      // Log retry attempt
      if (attempt < maxRetries) {
        console.warn(`LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying:`, lastError.message);
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error('LLM call failed after retries');
}
