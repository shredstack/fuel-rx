import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-service';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/admin/usda/backfill
 *
 * Start a USDA backfill job to match ingredients to USDA database
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  let adminUserId: string;
  try {
    const result = await requireAdmin(supabase);
    adminUserId = result.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden: Admin access required' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  let body: {
    source?: 'llm_estimated' | 'usda' | 'all';
    batchSize?: number;
    limit?: number;
    nutritionIds?: string[];  // Specific IDs to process (for bulk selection)
    includeAlreadyMatched?: boolean;  // Re-match even if already matched
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const {
    source = 'llm_estimated',
    batchSize = 50,
    limit,
    nutritionIds,
    includeAlreadyMatched = false,
  } = body;

  try {
    let count: number | null = 0;
    let countError: Error | null = null;

    if (nutritionIds && nutritionIds.length > 0) {
      // Process specific IDs - count them directly
      count = nutritionIds.length;
    } else {
      // Get count of ingredients to process based on filters
      let query = supabase
        .from('ingredient_nutrition')
        .select('id', { count: 'exact', head: true });

      // Filter by match status unless re-matching
      if (!includeAlreadyMatched) {
        query = query.eq('usda_match_status', 'pending');
      }

      // Filter by source
      if (source === 'llm_estimated') {
        query = query.eq('source', 'llm_estimated');
      } else if (source === 'usda') {
        query = query.eq('source', 'usda');
      }
      // 'all' means no source filter

      const result = await query;
      count = result.count;
      countError = result.error as Error | null;
    }

    if (countError) {
      console.error('Error counting ingredients:', countError);
      return NextResponse.json(
        { error: 'Failed to count ingredients for backfill' },
        { status: 500 }
      );
    }

    const totalToProcess = limit ? Math.min(count || 0, limit) : (count || 0);

    if (totalToProcess === 0) {
      return NextResponse.json({
        message: 'No ingredients to process',
        count: 0,
      });
    }

    // Create a job record to track progress (use service role to bypass RLS)
    const serviceClient = createServiceRoleClient();
    const { data: job, error: jobError } = await serviceClient
      .from('usda_backfill_jobs')
      .insert({
        admin_user_id: adminUserId,
        status: 'pending',
        total_count: totalToProcess,
        processed_count: 0,
        matched_count: 0,
        no_match_count: 0,
        error_count: 0,
        source_filter: source,
        batch_size: batchSize,
      })
      .select('id')
      .single();

    // If job creation failed, proceed without tracking
    const jobId = job?.id || `temp-${Date.now()}`;

    // Trigger the Inngest function
    await inngest.send({
      name: 'admin/usda-backfill',
      data: {
        jobId,
        adminUserId,
        source,
        batchSize,
        limit: totalToProcess,
        nutritionIds,  // Pass specific IDs if provided
        includeAlreadyMatched,
      },
    });

    const modeDescription = nutritionIds
      ? `${totalToProcess} selected ingredients`
      : includeAlreadyMatched
        ? `${totalToProcess} ingredients (re-matching)`
        : `${totalToProcess} pending ingredients`;

    return NextResponse.json({
      jobId,
      message: `Started USDA backfill for ${modeDescription}`,
      totalToProcess,
      batchSize,
      source,
      mode: nutritionIds ? 'selected' : includeAlreadyMatched ? 'rematch' : 'pending',
    });
  } catch (error) {
    console.error('Error starting USDA backfill:', error);
    return NextResponse.json(
      { error: 'Failed to start USDA backfill job' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/usda/backfill
 *
 * Get status of USDA backfill job(s)
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    await requireAdmin(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden: Admin access required' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  // Use service role to bypass RLS for job status queries
  const serviceClient = createServiceRoleClient();

  try {
    if (jobId) {
      // Get specific job status
      const { data: job, error } = await serviceClient
        .from('usda_backfill_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(job);
    }

    // Get recent jobs
    const { data: jobs, error } = await serviceClient
      .from('usda_backfill_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      // Table might not exist yet
      return NextResponse.json({ jobs: [], message: 'No backfill jobs found' });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error) {
    console.error('Error fetching backfill status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backfill status' },
      { status: 500 }
    );
  }
}
