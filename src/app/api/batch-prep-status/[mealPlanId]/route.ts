import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import type { BatchPrepStatusResponse, BatchPrepStatus } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mealPlanId: string }> }
) {
  const { mealPlanId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: mealPlan, error } = await supabase
    .from('meal_plans')
    .select('batch_prep_status, prep_sessions_batch, prep_sessions_day_of')
    .eq('id', mealPlanId)
    .eq('user_id', user.id)
    .single();

  if (error || !mealPlan) {
    return Response.json({ error: 'Meal plan not found' }, { status: 404 });
  }

  // Determine the effective status:
  // - If batch_prep_status is null AND no prep_sessions_day_of exists, this is a legacy plan
  //   that can't have batch prep generated (no source data)
  // - If batch_prep_status is null but prep_sessions_day_of exists, it's eligible for generation
  const isLegacyWithoutDayOf = !mealPlan.batch_prep_status && !mealPlan.prep_sessions_day_of;
  const canGenerateBatchPrep = !!mealPlan.prep_sessions_day_of;

  // For legacy plans without day-of prep, we mark them as 'not_started' (new status)
  // rather than 'pending' which implies something is in progress
  let effectiveStatus: BatchPrepStatus | 'not_started';
  if (isLegacyWithoutDayOf) {
    effectiveStatus = 'not_started';
  } else if (!mealPlan.batch_prep_status && canGenerateBatchPrep) {
    // Has day-of prep but never had batch prep triggered - eligible for on-demand generation
    effectiveStatus = 'not_started';
  } else {
    effectiveStatus = (mealPlan.batch_prep_status || 'pending') as BatchPrepStatus;
  }

  const response: BatchPrepStatusResponse = {
    status: effectiveStatus as BatchPrepStatus,
    ready: mealPlan.batch_prep_status === 'completed',
    hasBatchPrep: !!mealPlan.prep_sessions_batch,
    canGenerateBatchPrep,
  };

  return Response.json(response);
}
