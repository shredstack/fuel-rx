/**
 * Food Journal — Promote to Tracked Meal
 *
 * POST /api/food-journal/[id]/promote
 * Body: { meal_type?, consumed_at? }
 *
 * Runs the journal photo through Claude Vision (`analyzeMealPhoto`) and creates
 * a real meal_consumption_log entry so the meal feeds the macro dashboard.
 *
 * Paywalled via `checkAiAccess()` — it shares the expensive Sonnet cost profile
 * of Snap a Meal. (Journaling itself is free.)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeMealPhoto } from '@/lib/claude/meal-photo-analysis';
import { checkAiAccess, createAiAccessDeniedResponse } from '@/lib/subscription/check-ai-access';
import { upsertResolution, isReminderMealType } from '@/lib/meal-reminders/resolution-service';
import { trackEvent } from '@/lib/analytics';
import type { ReminderMealType } from '@/lib/meal-reminders/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Paid feature — same cost profile as Snap a Meal.
  const aiAccess = await checkAiAccess(user.id);
  if (!aiAccess.allowed) {
    return createAiAccessDeniedResponse();
  }

  let body: { meal_type?: string; consumed_at?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional.
  }

  // Load the journal entry + its photo.
  const { data: entry, error: entryError } = await supabase
    .from('food_journal_entries')
    .select('id, meal_type, journaled_at, promoted_consumption_log_id, meal_photo_id, meal_photos!inner(storage_path)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (entryError || !entry) {
    return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
  }
  if (entry.promoted_consumption_log_id) {
    return NextResponse.json(
      { consumption_log_id: entry.promoted_consumption_log_id, alreadyPromoted: true },
      { status: 200 }
    );
  }

  const photo = entry.meal_photos as unknown as { storage_path: string };
  const storagePath = photo?.storage_path;
  if (!storagePath) {
    return NextResponse.json({ error: 'Journal photo is missing' }, { status: 400 });
  }

  try {
    // Download the photo and run vision analysis.
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('meal-photos')
      .download(storagePath);
    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to load journal photo' }, { status: 500 });
    }

    const base64 = Buffer.from(await fileData.arrayBuffer()).toString('base64');
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
    if (storagePath.endsWith('.png')) mediaType = 'image/png';
    else if (storagePath.endsWith('.webp')) mediaType = 'image/webp';

    const analysis = await analyzeMealPhoto(base64, mediaType, user.id);

    const consumedAt = body.consumed_at || new Date().toISOString();
    const consumedDate = consumedAt.split('T')[0];
    const mealType: ReminderMealType | null = isReminderMealType(body.meal_type)
      ? body.meal_type
      : isReminderMealType(entry.meal_type)
        ? entry.meal_type
        : null;

    // Create the tracked consumption entry from the analysis.
    const { data: consumption, error: insertError } = await supabase
      .from('meal_consumption_log')
      .insert({
        user_id: user.id,
        entry_type: 'photo_meal',
        source_photo_id: entry.meal_photo_id,
        consumed_at: consumedAt,
        consumed_date: consumedDate,
        display_name: analysis.meal_name || 'Meal from journal',
        meal_type: mealType,
        calories: Math.round(analysis.total_macros.calories),
        protein: Math.round(analysis.total_macros.protein * 10) / 10,
        carbs: Math.round(analysis.total_macros.carbs * 10) / 10,
        fat: Math.round(analysis.total_macros.fat * 10) / 10,
      })
      .select('id')
      .single();

    if (insertError || !consumption) {
      console.error('[food-journal/promote] consumption insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to create tracked meal' }, { status: 500 });
    }

    // Record the analysis on the photo and link the consumption entry.
    await supabase
      .from('meal_photos')
      .update({
        analysis_status: 'completed',
        analyzed_at: new Date().toISOString(),
        raw_analysis: analysis,
        meal_name: analysis.meal_name,
        meal_description: analysis.meal_description || null,
        total_calories: analysis.total_macros.calories,
        total_protein: analysis.total_macros.protein,
        total_carbs: analysis.total_macros.carbs,
        total_fat: analysis.total_macros.fat,
        confidence_score: analysis.overall_confidence,
        consumption_entry_id: consumption.id,
      })
      .eq('id', entry.meal_photo_id);

    // Link the journal entry to its promoted consumption entry.
    await supabase
      .from('food_journal_entries')
      .update({ promoted_consumption_log_id: consumption.id })
      .eq('id', id);

    // Promoting also counts as logging the meal — silence any matching reminder.
    if (isReminderMealType(mealType)) {
      try {
        await upsertResolution(supabase, {
          userId: user.id,
          reminderDate: consumedDate,
          mealType,
          source: 'meal_logged',
          consumptionLogId: consumption.id,
        });
      } catch (hookError) {
        console.error('[food-journal/promote] resolution hook failed:', hookError);
      }
    }

    trackEvent('food_journal_entry_promoted', {
      minutes_since_journaled: Math.round(
        (Date.now() - new Date(entry.journaled_at).getTime()) / 60000
      ),
    });

    return NextResponse.json({ consumption_log_id: consumption.id }, { status: 201 });
  } catch (error) {
    console.error('[food-journal/promote] failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to promote entry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
