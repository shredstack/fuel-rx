/**
 * Cooking Assistant Message API
 * POST /api/cooking-assistant/message - Send a message and get a response
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/claude/client';
import { checkAiAccess, createAiAccessDeniedResponse } from '@/lib/subscription/check-ai-access';
import type { MealEntity, CookingChatMessage, IngredientWithNutrition } from '@/lib/types';

/**
 * Build the system prompt with full meal context
 */
function buildSystemPrompt(meal: MealEntity, batchContext?: {
  totalServings: number;
  days: string[];
}): string {
  const ingredientsList = (meal.ingredients || [])
    .map((i: IngredientWithNutrition) => `- ${i.amount} ${i.unit} ${i.name}`)
    .join('\n');

  const instructionsList = (meal.instructions || [])
    .map((inst: string, idx: number) => `${idx + 1}. ${inst}`)
    .join('\n');

  // Include prep instructions if available
  const prepInstructions = meal.prep_instructions
    ? `\n**Additional Prep Notes**:\n${meal.prep_instructions}\n`
    : '';

  let batchInfo = '';
  if (batchContext && batchContext.totalServings > 1) {
    batchInfo = `
**Batch Prep Info**:
- Making ${batchContext.totalServings} servings total
- For days: ${batchContext.days.join(', ')}
- Scale ingredient quantities accordingly
`;
  }

  return `You are a friendly, helpful cooking assistant for FuelRx, a meal planning app for CrossFit athletes. You're helping a user prepare this specific meal right now:

**Meal Name**: ${meal.name}

**Meal Type**: ${meal.meal_type}

**Prep Time**: ${meal.prep_time_minutes} minutes

**Ingredients**:
${ingredientsList || 'No ingredients listed'}

**Instructions**:
${instructionsList || 'No instructions provided'}
${prepInstructions}
**Nutrition Facts** (per serving):
- Calories: ${meal.calories}
- Protein: ${meal.protein}g
- Carbs: ${meal.carbs}g
- Fat: ${meal.fat}g
${batchInfo}
**Context**: The user is actively cooking this meal and may have questions about techniques, substitutions, timing, or clarifications about the instructions.

**Your role**:
- Answer questions clearly and concisely (users may have messy hands!)
- Focus on THIS specific meal - don't suggest completely different recipes
- Provide practical cooking advice appropriate for someone with basic-to-intermediate kitchen skills
- If they ask about substitutions, suggest items that maintain similar macros (protein, carbs, fat)
- Keep responses under 150 words unless they specifically ask for detailed explanation
- Be encouraging and supportive - cooking should be fun!
- Use simple language and avoid overly technical culinary terms unless the user asks
- If a question is about general cooking not specific to this meal, that's fine - answer it helpfully

**Important**: You only have context for THIS meal. If they ask about their full meal plan or other meals, politely let them know you're focused on helping with this specific dish.

**Tone**: Friendly, practical, and energetic - like a supportive gym buddy who also loves to cook. Keep it real and encouraging!`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check AI feature access
    const aiAccess = await checkAiAccess(user.id);
    if (!aiAccess.allowed) {
      return createAiAccessDeniedResponse();
    }

    const { sessionId, message, batchContext } = await request.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'sessionId and message are required' },
        { status: 400 }
      );
    }

    // Verify session belongs to user and is active, and get the meal
    const { data: session, error: sessionError } = await supabase
      .from('cooking_chat_sessions')
      .select('*, meals(*)')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .is('ended_at', null)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or has ended' },
        { status: 404 }
      );
    }

    const meal = session.meals as unknown as MealEntity;

    // Get chat history
    const { data: chatHistory } = await supabase
      .from('cooking_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Build messages array for Claude
    const systemPrompt = buildSystemPrompt(meal, batchContext);

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...(chatHistory || []).map((msg: CookingChatMessage) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Call Claude API with Haiku for speed and cost efficiency
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Sorry, I encountered an error processing your question.';

    // Save user message
    await supabase.from('cooking_chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
    });

    // Save assistant reply
    const { data: savedMessage } = await supabase
      .from('cooking_chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: reply,
      })
      .select()
      .single();

    return NextResponse.json({
      reply,
      created_at: savedMessage?.created_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in cooking assistant message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
