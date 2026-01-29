import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mealPlanId: string }> }
) {
  const { mealPlanId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the meal plan exists and belongs to the user
  const { data: mealPlan, error: planError } = await supabase
    .from('meal_plans')
    .select('id, batch_prep_status, prep_sessions_day_of')
    .eq('id', mealPlanId)
    .eq('user_id', user.id)
    .single();

  if (planError || !mealPlan) {
    return Response.json({ error: 'Meal plan not found' }, { status: 404 });
  }

  // Check if already generating
  if (mealPlan.batch_prep_status === 'generating') {
    return Response.json({ error: 'Batch prep is already being generated' }, { status: 409 });
  }

  // Check if prep_sessions_day_of exists (required for batch prep transformation)
  if (!mealPlan.prep_sessions_day_of) {
    return Response.json({
      error: 'This meal plan does not have the required prep data for batch prep generation. This may be an older plan created before batch prep was available.',
      code: 'NO_DAY_OF_PREP'
    }, { status: 400 });
  }

  // Create a job record in meal_plan_jobs for tracking/history
  const { data: job, error: jobError } = await supabase
    .from('meal_plan_jobs')
    .insert({
      user_id: user.id,
      meal_plan_id: mealPlanId,
      job_type: 'batch_prep_generation',
      status: 'pending',
      progress_message: 'Starting batch prep generation...',
    })
    .select('id')
    .single();

  if (jobError || !job) {
    console.error('Failed to create batch prep job:', jobError);
    return Response.json({ error: 'Failed to create batch prep job' }, { status: 500 });
  }

  // Set status to pending on meal_plans (for UI rendering)
  await supabase
    .from('meal_plans')
    .update({ batch_prep_status: 'pending' })
    .eq('id', mealPlanId);

  // Trigger the Inngest function
  try {
    await inngest.send({
      name: 'meal-plan/generate-batch-prep',
      data: {
        mealPlanId,
        userId: user.id,
        jobId: job.id,
      },
    });

    return Response.json({ success: true, status: 'pending', jobId: job.id });
  } catch (error) {
    console.error('Failed to trigger batch prep generation:', error);

    // Update job status to failed
    await supabase
      .from('meal_plan_jobs')
      .update({
        status: 'failed',
        error_message: 'Failed to trigger Inngest function',
      })
      .eq('id', job.id);

    // Reset status on meal_plans for UI
    await supabase
      .from('meal_plans')
      .update({ batch_prep_status: null })
      .eq('id', mealPlanId);

    return Response.json({ error: 'Failed to start batch prep generation' }, { status: 500 });
  }
}
