/**
 * Cooking Assistant Session API
 * POST /api/cooking-assistant/session - Create or resume a session for a meal
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAiAccess, createAiAccessDeniedResponse } from '@/lib/subscription/check-ai-access';
import type { CookingChatMessage, MealEntity } from '@/lib/types';

/**
 * Generate contextual suggested questions based on the meal
 */
function generateSuggestedQuestions(meal: MealEntity): string[] {
  const questions: string[] = [];
  const instructions = (meal.instructions || []).join(' ').toLowerCase();
  const ingredientsText = JSON.stringify(meal.ingredients || []).toLowerCase();

  // Check for cooking techniques
  if (instructions.includes('sauté') || instructions.includes('sear') || instructions.includes('pan fry')) {
    questions.push('What heat level should I use for sautéing?');
  }

  if (instructions.includes('dice') || instructions.includes('chop') || instructions.includes('cut')) {
    questions.push('How do I cut this properly?');
  }

  if (instructions.includes('fold') || instructions.includes('whisk') || instructions.includes('emulsify')) {
    questions.push('What does this technique mean?');
  }

  if (instructions.includes('simmer') || instructions.includes('boil') || instructions.includes('reduce')) {
    questions.push('How long should I cook this?');
  }

  // Check for proteins that need doneness guidance
  const proteins = ['chicken', 'salmon', 'steak', 'pork', 'fish', 'beef', 'turkey', 'shrimp'];
  const hasProtein = proteins.some(p => ingredientsText.includes(p));

  if (hasProtein) {
    questions.push('How do I know when the protein is cooked?');
  }

  // Always offer substitution question
  questions.push('Can I substitute any ingredients?');

  // Timing question if cook time exists
  if (meal.prep_time_minutes && meal.prep_time_minutes > 10) {
    questions.push('Can I prepare any of this ahead of time?');
  }

  // Return max 5 unique questions
  return [...new Set(questions)].slice(0, 5);
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

    const { mealId } = await request.json();

    if (!mealId) {
      return NextResponse.json({ error: 'mealId is required' }, { status: 400 });
    }

    // Fetch the meal data to include in context
    const { data: meal, error: mealError } = await supabase
      .from('meals')
      .select('*')
      .eq('id', mealId)
      .single();

    if (mealError || !meal) {
      console.error('Meal lookup error:', mealError);
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    // Check for existing active session
    const { data: existingSessions } = await supabase
      .from('cooking_chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('meal_id', mealId)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    let sessionId: string;
    let messages: CookingChatMessage[] = [];

    if (existingSessions && existingSessions.length > 0) {
      // Resume existing session
      sessionId = existingSessions[0].id;

      // Fetch existing messages
      const { data: existingMessages } = await supabase
        .from('cooking_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      messages = existingMessages || [];
    } else {
      // Create new session
      const { data: newSession, error: sessionError } = await supabase
        .from('cooking_chat_sessions')
        .insert({
          user_id: user.id,
          meal_id: mealId,
        })
        .select()
        .single();

      if (sessionError || !newSession) {
        console.error('Session creation error:', sessionError);
        return NextResponse.json(
          { error: 'Failed to create session', details: sessionError?.message },
          { status: 500 }
        );
      }

      sessionId = newSession.id;
    }

    // Generate suggested questions based on meal content
    const suggestedQuestions = generateSuggestedQuestions(meal as MealEntity);

    return NextResponse.json({
      sessionId,
      messages,
      suggestedQuestions,
    });
  } catch (error) {
    console.error('Error in cooking assistant session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
