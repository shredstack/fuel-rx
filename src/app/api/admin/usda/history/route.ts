import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-service';

/**
 * GET /api/admin/usda/history
 *
 * Get history of USDA matching changes.
 * Query params:
 * - jobId: Get history for a specific job
 * - nutritionId: Get history for a specific nutrition record
 * - limit: Number of records (default 50)
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
  const nutritionId = searchParams.get('nutritionId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const serviceClient = createServiceRoleClient();

  try {
    let query = serviceClient
      .from('ingredient_nutrition_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    if (nutritionId) {
      query = query.eq('nutrition_id', nutritionId);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('Error fetching history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({ history: history || [] });
  } catch (error) {
    console.error('Error in history endpoint:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

/**
 * POST /api/admin/usda/history/rollback
 *
 * Rollback changes from a specific job or specific history entries.
 * Body:
 * - jobId: Rollback all changes from a job
 * - historyIds: Rollback specific history entries
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
    jobId?: string;
    historyIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { jobId, historyIds } = body;

  if (!jobId && !historyIds?.length) {
    return NextResponse.json(
      { error: 'Either jobId or historyIds is required' },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    // Get history entries to rollback
    let query = serviceClient
      .from('ingredient_nutrition_history')
      .select('*')
      .is('reverted_at', null); // Only non-reverted entries

    if (jobId) {
      query = query.eq('job_id', jobId);
    } else if (historyIds?.length) {
      query = query.in('id', historyIds);
    }

    const { data: historyEntries, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching history for rollback:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch history entries' }, { status: 500 });
    }

    if (!historyEntries || historyEntries.length === 0) {
      return NextResponse.json({
        message: 'No entries to rollback',
        rolledBack: 0,
      });
    }

    let rolledBack = 0;
    let errors = 0;

    // Rollback each entry
    for (const entry of historyEntries) {
      try {
        // Restore previous values
        const { error: updateError } = await serviceClient
          .from('ingredient_nutrition')
          .update({
            calories: entry.previous_calories,
            protein: entry.previous_protein,
            carbs: entry.previous_carbs,
            fat: entry.previous_fat,
            fiber: entry.previous_fiber,
            sugar: entry.previous_sugar,
            source: entry.previous_source,
            confidence_score: entry.previous_confidence_score,
            usda_fdc_id: entry.previous_usda_fdc_id,
            usda_match_status: entry.previous_usda_match_status,
            usda_match_confidence: entry.previous_usda_match_confidence,
            usda_calories_per_100g: entry.previous_usda_calories_per_100g,
            usda_protein_per_100g: entry.previous_usda_protein_per_100g,
            usda_carbs_per_100g: entry.previous_usda_carbs_per_100g,
            usda_fat_per_100g: entry.previous_usda_fat_per_100g,
            usda_fiber_per_100g: entry.previous_usda_fiber_per_100g,
            usda_sugar_per_100g: entry.previous_usda_sugar_per_100g,
            usda_match_job_id: null, // Clear job reference
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.nutrition_id);

        if (updateError) {
          console.error(`Failed to rollback nutrition ${entry.nutrition_id}:`, updateError);
          errors++;
          continue;
        }

        // Mark history entry as reverted
        await serviceClient
          .from('ingredient_nutrition_history')
          .update({
            reverted_at: new Date().toISOString(),
            reverted_by: adminUserId,
          })
          .eq('id', entry.id);

        rolledBack++;
      } catch (error) {
        console.error(`Error rolling back entry ${entry.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      message: `Rolled back ${rolledBack} entries`,
      rolledBack,
      errors,
      total: historyEntries.length,
    });
  } catch (error) {
    console.error('Error in rollback:', error);
    return NextResponse.json({ error: 'Failed to rollback changes' }, { status: 500 });
  }
}
