/**
 * Stage 3: Generate prep sessions based on user's prep style
 */

import type {
  DayPlan,
  CoreIngredients,
  UserProfile,
  PrepModeResponse,
  DayOfWeek,
  MealType,
  PrepSessionType,
  DailyAssembly,
} from '../../types';
import { buildPrepSessionsPrompt } from './prompt-builder';
import { callLLMWithToolUse } from '../client';
import { prepSessionsSchema } from '../../llm-schemas';

// Extended prep task as returned by LLM (matches new PrepTask interface)
interface LLMPrepTask {
  id: string;
  description: string;
  detailed_steps: string[];
  cooking_temps?: {
    oven?: string;
    stovetop?: string;
    internal_temp?: string;
    grill?: string;
  };
  cooking_times?: {
    prep_time?: string;
    cook_time?: string;
    rest_time?: string;
    total_time?: string;
  };
  tips?: string[];
  storage?: string;
  estimated_minutes: number;
  meal_ids: string[];
  completed: boolean;
  equipment_needed?: string[];
  ingredients_to_prep?: string[];
  prep_category?: 'sunday_batch' | 'day_of_quick' | 'day_of_cooking';
}

interface NewPrepSessionsResponse {
  prep_sessions: Array<{
    session_name: string;
    session_type: PrepSessionType;
    session_day: DayOfWeek | null;
    session_time_of_day: 'morning' | 'afternoon' | 'night' | null;
    prep_for_date: string | null;
    estimated_minutes: number;
    prep_tasks: LLMPrepTask[];
    display_order: number;
  }>;
  daily_assembly?: DailyAssembly;
}

/**
 * Stage 3: Analyze meals and generate prep sessions
 * Creates prep sessions based on user's prep style preference
 * Supports: traditional_batch, day_of
 */
export async function generatePrepSessions(
  days: DayPlan[],
  coreIngredients: CoreIngredients,
  profile: UserProfile,
  userId: string,
  weekStartDate?: string
): Promise<PrepModeResponse> {
  const prompt = buildPrepSessionsPrompt(days, coreIngredients, profile, weekStartDate);

  // Use tool use for guaranteed valid JSON output
  const { result: rawParsed } = await callLLMWithToolUse<NewPrepSessionsResponse>({
    prompt,
    tool: prepSessionsSchema,
    maxTokens: 64000,
    userId,
    promptType: 'prep_mode_analysis',
  });

  // Handle case where LLM returns prep_sessions as a JSON string instead of array
  const rawResult = rawParsed as unknown as { prep_sessions: unknown; daily_assembly?: unknown };

  let prepSessionsArray: NewPrepSessionsResponse['prep_sessions'] = [];
  let dailyAssemblyObj: NewPrepSessionsResponse['daily_assembly'] = {};

  if (typeof rawResult?.prep_sessions === 'string') {
    prepSessionsArray = parseStringPrepSessions(rawResult.prep_sessions as string);
  } else {
    prepSessionsArray = rawResult?.prep_sessions as NewPrepSessionsResponse['prep_sessions'];
  }

  // Also handle daily_assembly if it's a string
  if (typeof rawResult?.daily_assembly === 'string') {
    console.warn('LLM returned daily_assembly as string, parsing...');
    try {
      dailyAssemblyObj = JSON.parse(rawResult.daily_assembly);
    } catch {
      dailyAssemblyObj = {};
    }
  } else if (rawResult?.daily_assembly) {
    dailyAssemblyObj = rawResult.daily_assembly as NewPrepSessionsResponse['daily_assembly'];
  }

  // Reconstruct the parsed object with properly typed values
  const parsed: NewPrepSessionsResponse = {
    prep_sessions: prepSessionsArray,
    daily_assembly: dailyAssemblyObj,
  };

  // Validate that we got a valid response with prep_sessions array
  if (!parsed || !parsed.prep_sessions || !Array.isArray(parsed.prep_sessions)) {
    console.error('=== PREP SESSIONS VALIDATION FAILED ===');
    console.error('  parsed is null/undefined:', parsed == null);
    console.error('  typeof parsed:', typeof parsed);
    if (parsed) {
      console.error('  Object.keys(parsed):', Object.keys(parsed));
      console.error('  parsed.prep_sessions exists:', 'prep_sessions' in parsed);
      console.error('  typeof parsed.prep_sessions:', typeof parsed.prep_sessions);
      console.error('  Is array:', Array.isArray(parsed.prep_sessions));
    }
    const rawResponse = JSON.stringify(parsed, null, 2);
    console.error('  Full response:', rawResponse.slice(0, 2000));
    console.error('=== END VALIDATION FAILURE ===');

    const error = new Error('Failed to generate prep sessions - LLM returned invalid response structure') as Error & { rawResponse?: string };
    error.rawResponse = rawResponse.slice(0, 50000);
    throw error;
  }

  // Additional validation: ensure we have at least one prep session
  if (parsed.prep_sessions.length === 0) {
    console.error('LLM returned empty prep_sessions array');
    const error = new Error('Failed to generate prep sessions - no sessions returned') as Error & { rawResponse?: string };
    error.rawResponse = JSON.stringify(parsed, null, 2);
    throw error;
  }

  // Convert new format to PrepModeResponse format for backward compatibility
  return transformToPrepModeResponse(parsed);
}

/**
 * Parse prep_sessions when LLM returns it as a string
 */
function parseStringPrepSessions(prepSessionsStr: string): NewPrepSessionsResponse['prep_sessions'] {
  console.warn('LLM returned prep_sessions as string, parsing...');
  console.warn(`  String length: ${prepSessionsStr.length} chars`);
  console.warn(`  Last 200 chars: ${prepSessionsStr.slice(-200)}`);

  // First attempt: try parsing as-is
  try {
    return JSON.parse(prepSessionsStr);
  } catch (parseError) {
    const parseErr = parseError as SyntaxError;
    console.warn('Initial parse failed:', parseErr.message);

    // Extract position from error message
    const posMatch = parseErr.message.match(/at position (\d+)/);
    const errorPosition = posMatch ? parseInt(posMatch[1], 10) : null;

    if (errorPosition) {
      console.warn(`  Error at position ${errorPosition}, attempting targeted repair...`);
      console.warn(`  Context around error: ...${prepSessionsStr.slice(Math.max(0, errorPosition - 50), errorPosition + 50)}...`);
    }

    // Strategy 0: Fix common LLM bracket mismatch errors
    let repairedStr = prepSessionsStr;
    repairedStr = repairedStr.replace(
      /("(?:prep_time|cook_time|total_time|stovetop|oven|internal_temp)":\s*"[^"]*")\s*\n(\s*)\]/g,
      '$1\n$2}'
    );

    let repaired = false;

    if (repairedStr !== prepSessionsStr) {
      console.warn('  Applied bracket mismatch fixes, attempting parse...');
      try {
        const result = JSON.parse(repairedStr);
        console.warn(`  Bracket repair successful! Parsed ${result.length} sessions.`);
        return result;
      } catch (bracketRepairError) {
        console.warn('  Bracket repair parse still failed:', (bracketRepairError as Error).message);
        prepSessionsStr = repairedStr;
      }
    }

    // Strategy 1: Find session boundaries and extract valid sessions
    const sessions: unknown[] = [];
    if (!repaired) {
      console.warn('Attempting to extract complete sessions by finding boundaries...');

      const sessionEndRegex = /"display_order"\s*:\s*\d+\s*\}/g;
      const sessionEnds: number[] = [];
      let endMatch;
      while ((endMatch = sessionEndRegex.exec(prepSessionsStr)) !== null) {
        sessionEnds.push(endMatch.index + endMatch[0].length);
      }

      console.warn(`  Found ${sessionEnds.length} potential session end positions`);

      for (const endPos of sessionEnds) {
        const candidate = prepSessionsStr.substring(0, endPos) + '\n]';
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sessions.length = 0;
            sessions.push(...parsed);
          }
        } catch {
          // This endpoint doesn't produce valid JSON, continue
        }
      }

      if (sessions.length > 0) {
        console.warn(`  Extracted ${sessions.length} complete sessions by boundary search`);
        return sessions as NewPrepSessionsResponse['prep_sessions'];
      }
    }

    // Strategy 2: Truncation before error position
    if (!repaired && errorPosition && errorPosition > 100) {
      console.warn('Boundary search failed, trying truncation before error position...');

      const beforeError = prepSessionsStr.substring(0, errorPosition);
      const lastSessionEnd = beforeError.lastIndexOf('},');

      if (lastSessionEnd > 0) {
        const truncated = prepSessionsStr.substring(0, lastSessionEnd + 1) + '\n]';
        try {
          const result = JSON.parse(truncated);
          console.warn(`  Repair successful via truncation at position ${lastSessionEnd}! Recovered ${result.length} sessions.`);
          return result;
        } catch {
          // Continue to next strategy
        }
      }
    }

    // Strategy 3: Look for the last complete "display_order" ending
    if (!repaired) {
      const lastCompleteSessionMatch = prepSessionsStr.match(/[\s\S]*"display_order":\s*\d+\s*\}/g);

      if (lastCompleteSessionMatch) {
        const lastMatch = lastCompleteSessionMatch[lastCompleteSessionMatch.length - 1];
        const lastCompleteIndex = prepSessionsStr.lastIndexOf(lastMatch) + lastMatch.length;

        const truncatedStr = prepSessionsStr.substring(0, lastCompleteIndex) + '\n]';
        console.warn(`  Attempting repair via display_order match: truncated to ${truncatedStr.length} chars`);

        try {
          const result = JSON.parse(truncatedStr);
          console.warn(`  Repair successful! Recovered ${result.length} sessions.`);
          return result;
        } catch (repairError) {
          console.error('Repair via display_order match failed:', repairError);
        }
      }
    }

    // All strategies failed
    console.error('All repair strategies failed');
    console.error('=== TRUNCATED JSON STRING (first 500 chars) ===');
    console.error(prepSessionsStr.slice(0, 500));
    console.error('=== AROUND ERROR POSITION ===');
    if (errorPosition) {
      console.error(prepSessionsStr.slice(Math.max(0, errorPosition - 200), errorPosition + 200));
    }
    console.error('=== LAST 500 CHARS ===');
    console.error(prepSessionsStr.slice(-500));
    console.error('=== END DEBUG INFO ===');
    const error = new Error('Failed to generate prep sessions - prep_sessions was string but not valid JSON') as Error & { rawResponse?: string };
    error.rawResponse = prepSessionsStr.slice(0, 50000);
    throw error;
  }
}

/**
 * Transform LLM response to PrepModeResponse format
 */
function transformToPrepModeResponse(parsed: NewPrepSessionsResponse): PrepModeResponse {
  const prepModeResponse: PrepModeResponse = {
    prepSessions: parsed.prep_sessions.map(session => ({
      sessionName: session.session_name,
      sessionOrder: session.display_order,
      estimatedMinutes: session.estimated_minutes,
      instructions: `${session.session_type} session${session.session_day ? ` on ${session.session_day}` : ''}`,
      prepItems: session.prep_tasks.map(task => ({
        item: task.description,
        quantity: '',
        method: task.detailed_steps?.join(' → ') || '',
        storage: task.storage || '',
        feeds: task.meal_ids.map(mealId => {
          const parts = mealId.split('_');
          if (parts.length >= 3) {
            return {
              day: parts[1] as DayOfWeek,
              meal: parts[2] as MealType,
            };
          }
          return { day: 'monday' as DayOfWeek, meal: 'dinner' as MealType };
        }),
      })),
      sessionType: session.session_type,
      sessionDay: session.session_day,
      sessionTimeOfDay: session.session_time_of_day,
      prepForDate: session.prep_for_date,
      prepTasks: session.prep_tasks.map(task => ({
        ...task,
        detailed_steps: task.detailed_steps || [],
        cooking_temps: task.cooking_temps || undefined,
        cooking_times: task.cooking_times || undefined,
        tips: task.tips || [],
        storage: task.storage || undefined,
        equipment_needed: task.equipment_needed || undefined,
        ingredients_to_prep: task.ingredients_to_prep || undefined,
        prep_category: task.prep_category || undefined,
      })),
      displayOrder: session.display_order,
    })),
    dailyAssembly: parsed.daily_assembly || {},
  };

  // Store the raw new format for the new prep view UI
  (prepModeResponse as PrepModeResponse & { newPrepSessions: NewPrepSessionsResponse['prep_sessions'] }).newPrepSessions = parsed.prep_sessions;

  return prepModeResponse;
}

// Re-export the prompt builder for testing purposes
export { buildPrepSessionsPrompt } from './prompt-builder';
