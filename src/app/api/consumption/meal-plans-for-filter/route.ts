import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface MealPlanFilterOption {
  id: string;
  title: string | null;
  week_start_date: string;
  is_favorite: boolean;
  is_latest: boolean;
}

/**
 * GET /api/consumption/meal-plans-for-filter
 *
 * Returns a lightweight list of user's meal plans for the filter UI.
 * Includes the most recent plans and all favorited plans.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch recent plans and favorited plans in parallel
  const [recentResult, favoritesResult] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('id, title, week_start_date, is_favorite, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('meal_plans')
      .select('id, title, week_start_date, is_favorite, created_at')
      .eq('user_id', user.id)
      .eq('is_favorite', true)
      .order('created_at', { ascending: false }),
  ]);

  if (recentResult.error) {
    console.error('Error fetching recent meal plans:', recentResult.error);
    return NextResponse.json({ error: 'Failed to fetch meal plans' }, { status: 500 });
  }

  // Combine recent and favorites, avoiding duplicates
  const planMap = new Map<string, MealPlanFilterOption>();
  const latestPlanId = recentResult.data?.[0]?.id;

  // Add recent plans first
  for (const plan of recentResult.data || []) {
    planMap.set(plan.id, {
      id: plan.id,
      title: plan.title,
      week_start_date: plan.week_start_date,
      is_favorite: plan.is_favorite,
      is_latest: plan.id === latestPlanId,
    });
  }

  // Add any favorites not already included
  for (const plan of favoritesResult.data || []) {
    if (!planMap.has(plan.id)) {
      planMap.set(plan.id, {
        id: plan.id,
        title: plan.title,
        week_start_date: plan.week_start_date,
        is_favorite: plan.is_favorite,
        is_latest: false,
      });
    }
  }

  // Convert to array and sort: latest first, then by created_at desc
  const plans = Array.from(planMap.values()).sort((a, b) => {
    // Latest plan always first
    if (a.is_latest) return -1;
    if (b.is_latest) return 1;
    // Then favorites
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    // Then by date
    return new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime();
  });

  return NextResponse.json({ plans, latestPlanId });
}
