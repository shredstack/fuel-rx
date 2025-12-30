import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const supabase = await createClient();
  const { jobId } = await params;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: job, error } = await supabase
    .from('meal_plan_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (error || !job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  return Response.json({
    id: job.id,
    status: job.status,
    progressMessage: job.progress_message,
    mealPlanId: job.meal_plan_id,
    errorMessage: job.error_message,
  });
}
