import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { OnboardingTipId, FeatureDiscoveryId, OnboardingMilestone } from '@/lib/types';

const MILESTONE_FIELDS: OnboardingMilestone[] = [
  'profile_completed',
  'first_plan_started',
  'first_plan_completed',
  'first_plan_viewed',
  'grocery_list_viewed',
  'prep_view_visited',
  'first_meal_liked',
  'first_meal_swapped',
];

/**
 * GET /api/onboarding/state
 * Fetches the current user's onboarding state, creating it if it doesn't exist
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // If no row exists (PGRST116 = no rows returned), create one
    if (error.code === 'PGRST116') {
      const { data: newState, error: insertError } = await supabase
        .from('user_onboarding_state')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating onboarding state:', insertError);
        return NextResponse.json({ error: 'Failed to create onboarding state' }, { status: 500 });
      }

      return NextResponse.json(newState);
    }

    console.error('Error fetching onboarding state:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/onboarding/state
 * Updates specific fields of the user's onboarding state
 *
 * Body can include:
 * - Milestone booleans (profile_completed, first_plan_started, etc.)
 * - dismiss_tip: OnboardingTipId - adds tip to tips_dismissed array
 * - discover_feature: FeatureDiscoveryId - adds feature to features_discovered array
 * - first_plan_tour_completed: boolean
 * - first_plan_tour_current_step: number
 * - first_plan_tour_skipped: boolean
 * - replay_tutorial: boolean - resets tour state and increments replay count
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Build the update object
  const updateData: Record<string, unknown> = {};

  // Handle milestone updates with auto-timestamps
  for (const field of MILESTONE_FIELDS) {
    if (body[field] === true) {
      updateData[field] = true;
      updateData[`${field}_at`] = new Date().toISOString();
    }
  }

  // Handle tour state updates
  if (typeof body.first_plan_tour_completed === 'boolean') {
    updateData.first_plan_tour_completed = body.first_plan_tour_completed;
  }
  if (typeof body.first_plan_tour_current_step === 'number') {
    updateData.first_plan_tour_current_step = body.first_plan_tour_current_step;
  }
  if (typeof body.first_plan_tour_skipped === 'boolean') {
    updateData.first_plan_tour_skipped = body.first_plan_tour_skipped;
  }

  // Handle tip dismissal (append to array)
  if (body.dismiss_tip) {
    const tipId = body.dismiss_tip as OnboardingTipId;
    const { data: current } = await supabase
      .from('user_onboarding_state')
      .select('tips_dismissed')
      .eq('user_id', user.id)
      .single();

    const existingTips: string[] = current?.tips_dismissed || [];
    if (!existingTips.includes(tipId)) {
      updateData.tips_dismissed = [...existingTips, tipId];
    }
  }

  // Handle feature discovery (append to array)
  if (body.discover_feature) {
    const featureId = body.discover_feature as FeatureDiscoveryId;
    const { data: current } = await supabase
      .from('user_onboarding_state')
      .select('features_discovered')
      .eq('user_id', user.id)
      .single();

    const existingFeatures: string[] = current?.features_discovered || [];
    if (!existingFeatures.includes(featureId)) {
      updateData.features_discovered = [...existingFeatures, featureId];
    }
  }

  // Handle tutorial replay
  if (body.replay_tutorial === true) {
    const { data: current } = await supabase
      .from('user_onboarding_state')
      .select('tutorial_replay_count')
      .eq('user_id', user.id)
      .single();

    updateData.first_plan_tour_completed = false;
    updateData.first_plan_tour_current_step = 0;
    updateData.first_plan_tour_skipped = false;
    updateData.tutorial_replay_count = (current?.tutorial_replay_count || 0) + 1;
    updateData.last_tutorial_replay_at = new Date().toISOString();
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Use upsert to create the row if it doesn't exist (new users won't have one yet)
  const { data, error } = await supabase
    .from('user_onboarding_state')
    .upsert(
      { user_id: user.id, ...updateData },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error updating onboarding state:', error);
    return NextResponse.json({ error: 'Failed to update onboarding state' }, { status: 500 });
  }

  return NextResponse.json(data);
}
