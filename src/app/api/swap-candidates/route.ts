/**
 * Swap Candidates API Endpoint
 *
 * GET /api/swap-candidates
 * Returns meals available for swapping, ordered by: custom -> community -> previous
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSwapCandidates } from '@/lib/meal-plan-service';
import type { MealType, SwapCandidatesResponse } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mealPlanId = searchParams.get('mealPlanId');
    const mealType = searchParams.get('mealType') as MealType | null;
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!mealPlanId) {
      return NextResponse.json(
        { error: 'Missing required parameter: mealPlanId' },
        { status: 400 }
      );
    }

    const { candidates, total } = await getSwapCandidates(user.id, mealPlanId, {
      mealType: mealType || undefined,
      search: search || undefined,
      limit,
      offset,
    });

    const response: SwapCandidatesResponse = {
      candidates,
      total,
      hasMore: total > offset + limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching swap candidates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
