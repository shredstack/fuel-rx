import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-service';
import { searchUSDA, extractNutritionFromSearchResult } from '@/lib/usda-service';

/**
 * GET /api/admin/usda/search
 *
 * Search USDA FoodData Central for ingredients
 * Used by admin UI for manual USDA matching
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
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    const results = await searchUSDA(query, Math.min(limit, 25));

    // Transform to a cleaner response format
    const foods = results.map(result => ({
      fdcId: result.fdcId,
      description: result.description,
      dataType: result.dataType,
      brandOwner: result.brandOwner || null,
      nutrition: extractNutritionFromSearchResult(result),
    }));

    return NextResponse.json({
      query,
      count: foods.length,
      foods,
    });
  } catch (error) {
    console.error('Error searching USDA:', error);
    return NextResponse.json(
      { error: 'Failed to search USDA database' },
      { status: 500 }
    );
  }
}
