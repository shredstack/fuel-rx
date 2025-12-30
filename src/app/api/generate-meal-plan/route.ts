import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Trigger Inngest function
  try {
    await inngest.send({
      name: 'meal-plan/generate',
      data: { jobId: job.id, userId: user.id },
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
