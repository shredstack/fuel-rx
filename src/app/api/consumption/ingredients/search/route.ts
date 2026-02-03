/**
 * Ingredient Search API
 *
 * GET /api/consumption/ingredients/search?q=chicken
 * GET /api/consumption/ingredients/search?q=chicken&include_usda=true
 *
 * When include_usda=true, returns both FuelRx and USDA results with health scores
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchIngredients } from '@/lib/consumption-service';
import { searchUSDA, extractNutritionFromSearchResult, type USDASearchResult } from '@/lib/usda-service';
import { calculateHealthScoreFromSearchResult } from '@/lib/health-score-service';
import {
  preprocessQuery,
  scoreResults,
  generateFallbackQueries,
  FUZZY_THRESHOLD,
} from '@/lib/usda-search-helpers';
import type { USDASearchResultWithScore, EnhancedSearchResults } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const includeUsda = searchParams.get('include_usda') === 'true';
    const usdaDisplayLimit = Math.min(parseInt(searchParams.get('usda_limit') || '50', 10), 50);
    // Always fetch the max from USDA so fuzzy re-ranking has a large pool to work with
    const usdaFetchLimit = 50;

    if (query.length < 2) {
      if (includeUsda) {
        return NextResponse.json({
          fuelrx_results: [],
          usda_results: [],
          fuelrx_count: 0,
          usda_count: 0,
          usda_total_available: 0,
        } as EnhancedSearchResults);
      }
      return NextResponse.json({ results: [] });
    }

    // Always search FuelRx database
    const fuelrxResults = await searchIngredients(user.id, query);

    // If not including USDA, return legacy format for backward compatibility
    if (!includeUsda) {
      return NextResponse.json({ results: fuelrxResults });
    }

    // Search USDA in parallel with deduplication
    let usdaResults: USDASearchResultWithScore[] = [];
    let usdaTotalAvailable = 0;

    try {
      // Get existing USDA FDC IDs from our database to filter duplicates
      const { data: existingUsdaFoods } = await supabase
        .from('ingredient_nutrition')
        .select('usda_fdc_id')
        .not('usda_fdc_id', 'is', null);

      const existingFdcIds = new Set(
        (existingUsdaFoods || []).map(f => f.usda_fdc_id?.toString())
      );

      // Layer 1: Pre-process query (spell correction + non-food token stripping)
      const cleanedQuery = preprocessQuery(query);

      // Search USDA API with cleaned query
      const usdaSearchResults = await searchUSDA(cleanedQuery, usdaFetchLimit);

      // Layer 2: Fuzzy re-rank results by relevance to query
      const queryTokens = cleanedQuery.toLowerCase().split(/\s+/);
      let scored = scoreResults(
        usdaSearchResults,
        queryTokens,
        (r: USDASearchResult) => r.description
      );

      const bestScore = scored.length > 0 ? scored[0].fuzzyScore : 0;

      // Layer 3: Fallback — if results are poor and query has multiple tokens,
      // try dropping one token at a time for better matches
      if (bestScore < FUZZY_THRESHOLD && queryTokens.length >= 2) {
        const fallbackQueries = generateFallbackQueries(queryTokens);
        const seenFdcIds = new Set(scored.map((s) => s.item.fdcId));

        for (const fbQuery of fallbackQueries.slice(0, 2)) {
          const fbResults = await searchUSDA(fbQuery, usdaFetchLimit);
          const newResults = fbResults.filter((r) => !seenFdcIds.has(r.fdcId));
          const fbScored = scoreResults(
            newResults,
            fbQuery.split(/\s+/),
            (r: USDASearchResult) => r.description
          );

          if (fbScored.length > 0 && fbScored[0].fuzzyScore > bestScore) {
            // Prepend better fallback results, then append originals
            scored = [...fbScored, ...scored];
            break;
          }
        }
      }

      const rankedResults = scored.map((s) => s.item);
      usdaTotalAvailable = rankedResults.length;

      // Filter out foods already in FuelRx, calculate health scores, cap to display limit
      usdaResults = rankedResults
        .filter(result => !existingFdcIds.has(result.fdcId.toString()))
        .slice(0, usdaDisplayLimit)
        .map(result => {
          const healthScore = calculateHealthScoreFromSearchResult(result);
          const nutrition = extractNutritionFromSearchResult(result);

          return {
            fdcId: result.fdcId,
            description: result.description,
            dataType: result.dataType,
            brandOwner: result.brandOwner,
            brandName: result.brandName,
            ingredients: result.ingredients,
            servingSize: result.servingSize,
            servingSizeUnit: result.servingSizeUnit,
            health_score: healthScore.score,
            health_category: healthScore.category,
            nutrition_per_100g: nutrition,
          };
        });
    } catch (usdaError) {
      // Log but don't fail the entire request if USDA search fails
      console.error('USDA search error (continuing with FuelRx results only):', usdaError);
    }

    const response: EnhancedSearchResults = {
      fuelrx_results: fuelrxResults,
      usda_results: usdaResults,
      fuelrx_count: fuelrxResults.length,
      usda_count: usdaResults.length,
      usda_total_available: usdaTotalAvailable,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error searching ingredients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
