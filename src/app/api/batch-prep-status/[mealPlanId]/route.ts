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
    .select('batch_prep_status, prep_sessions_batch')
    .eq('id', mealPlanId)
    .eq('user_id', user.id)
    .single();

  if (error || !mealPlan) {
    return Response.json({ error: 'Meal plan not found' }, { status: 404 });
  }

  const response: BatchPrepStatusResponse = {
    status: (mealPlan.batch_prep_status || 'pending') as BatchPrepStatus,
    ready: mealPlan.batch_prep_status === 'completed',
    hasBatchPrep: !!mealPlan.prep_sessions_batch,
  };

  return Response.json(response);
}
