import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

// Theme selection can be:
// - 'surprise': auto-select based on preferences and season (default)
// - 'none': no theme, classic meal plan
// - a specific theme ID string
type ThemeSelectionRequest = 'surprise' | 'none' | string;

interface GenerateMealPlanRequest {
  themeSelection?: ThemeSelectionRequest;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const serviceClient = createServiceRoleClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check subscription status and rate limit
  const { data: subscription } = await serviceClient
    .from('user_subscriptions')
    .select('is_subscribed, has_meal_plan_generation, is_override, free_plans_used, free_plan_limit')
    .eq('user_id', user.id)
    .single();

  // Check if user can generate meal plans:
  // 1. Has override (friends/testers) - unlimited access
  // 2. Has Pro subscription (has_meal_plan_generation = true) - unlimited access
  // 3. Is free user with remaining free plans
  const isOverride = subscription?.is_override ?? false;
  const hasMealPlanGeneration = subscription?.has_meal_plan_generation ?? false;
  const freePlansUsed = subscription?.free_plans_used ?? 0;
  const freePlanLimit = subscription?.free_plan_limit ?? 3;

  const canGenerate = isOverride || hasMealPlanGeneration || freePlansUsed < freePlanLimit;

  if (!canGenerate) {
    return Response.json({
      error: 'FREE_PLAN_LIMIT_REACHED',
      message: 'You have used all your free meal plans. Upgrade to Pro to continue generating meal plans.',
      freePlansUsed,
      freePlanLimit,
    }, { status: 402 }); // 402 Payment Required
  }

  // Parse request body for theme selection
  let themeSelection: ThemeSelectionRequest = 'surprise';
  try {
    const body: GenerateMealPlanRequest = await request.json();
    if (body.themeSelection) {
      themeSelection = body.themeSelection;
    }
  } catch {
    // No body or invalid JSON - use default (surprise)
  }

  // Check for existing pending/in-progress job
  const { data: existingJob } = await supabase
    .from('meal_plan_jobs')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['pending', 'generating_ingredients', 'generating_meals', 'generating_prep', 'saving'])
    .single();

  if (existingJob) {
    return Response.json({
      jobId: existingJob.id,
      status: existingJob.status,
      message: 'A meal plan is already being generated'
    });
  }

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from('meal_plan_jobs')
    .insert({ user_id: user.id, status: 'pending' })
    .select()
    .single();

  if (jobError || !job) {
    return Response.json({ error: 'Failed to create job' }, { status: 500 });
  }

  // Trigger Inngest function with theme selection
  try {
    await inngest.send({
      name: 'meal-plan/generate',
      data: { jobId: job.id, userId: user.id, themeSelection },
    });
  } catch (error) {
    console.error('Failed to send Inngest event:', error);
    await supabase
      .from('meal_plan_jobs')
      .update({ status: 'failed', error_message: 'Failed to queue job' })
      .eq('id', job.id);
    return Response.json({ error: 'Failed to queue job' }, { status: 500 });
  }

  return Response.json({ jobId: job.id, status: 'pending' });
}
