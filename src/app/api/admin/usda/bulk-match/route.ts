import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-service';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/admin/usda/bulk-match
 *
 * Start USDA matching for nutrition records of selected ingredients.
 * Accepts either ingredient IDs (matches all their nutrition records)
 * or nutrition IDs directly.
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
    ingredientIds?: string[];  // Ingredient IDs to match all nutrition records
    nutritionIds?: string[];   // Direct nutrition IDs
    includeAlreadyMatched?: boolean;  // Re-match even if already matched to USDA
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { ingredientIds, nutritionIds, includeAlreadyMatched = true } = body;

  if (!ingredientIds?.length && !nutritionIds?.length) {
    return NextResponse.json(
      { error: 'Either ingredientIds or nutritionIds is required' },
      { status: 400 }
    );
  }

  try {
    let targetNutritionIds: string[] = [];

    if (nutritionIds?.length) {
      // Use provided nutrition IDs directly
      targetNutritionIds = nutritionIds;
    } else if (ingredientIds?.length) {
      // Fetch all nutrition record IDs for the given ingredients
      let query = supabase
        .from('ingredient_nutrition')
        .select('id')
        .in('ingredient_id', ingredientIds);

      // Optionally filter out already-matched records
      if (!includeAlreadyMatched) {
        query = query.eq('usda_match_status', 'pending');
      }

      const { data: nutritionRecords, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching nutrition records:', fetchError);
        return NextResponse.json(
          { error: 'Failed to fetch nutrition records for ingredients' },
          { status: 500 }
        );
      }

      targetNutritionIds = (nutritionRecords || []).map(r => r.id);
    }

    if (targetNutritionIds.length === 0) {
      return NextResponse.json({
        message: 'No nutrition records to process',
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
        total_count: targetNutritionIds.length,
        processed_count: 0,
        matched_count: 0,
        no_match_count: 0,
        error_count: 0,
        source_filter: 'bulk_selected',
        batch_size: 50,
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Error creating job record:', jobError);
      // Continue without job tracking - use temp ID
    }

    const jobId = job?.id || `temp-${Date.now()}`;

    // Trigger the Inngest function with specific nutrition IDs
    await inngest.send({
      name: 'admin/usda-backfill',
      data: {
        jobId,
        adminUserId,
        nutritionIds: targetNutritionIds,
        includeAlreadyMatched: true,  // We already filtered above if needed
        batchSize: 50,
      },
    });

    return NextResponse.json({
      jobId,
      message: `Started USDA matching for ${targetNutritionIds.length} nutrition records`,
      totalToProcess: targetNutritionIds.length,
      mode: 'bulk_selected',
    });
  } catch (error) {
    console.error('Error starting bulk USDA match:', error);
    return NextResponse.json(
      { error: 'Failed to start bulk USDA match' },
      { status: 500 }
    );
  }
}
