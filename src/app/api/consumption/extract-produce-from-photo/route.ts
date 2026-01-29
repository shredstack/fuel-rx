/**
 * Extract Produce from Photo Meal API Endpoint
 *
 * POST /api/consumption/extract-produce-from-photo - Extract fruits/vegetables from photo meal ingredients
 *
 * Given an array of ingredients (with categories already detected by Claude Vision),
 * estimates their weight in grams for the 800g challenge.
 * Uses deterministic lookup from produce_weights table first, falls back to LLM for unmatched items.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estimateProduceGrams, type ProduceItem } from '@/lib/claude/produce-estimation';
import { lookupProduceWeights, type ProduceItemInput } from '@/lib/produce-extraction-service';

interface PhotoIngredient {
  name: string;
  estimated_amount: string;
  estimated_unit: string;
  category?: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'fat' | 'dairy' | 'other';
}

interface RequestBody {
  ingredients: PhotoIngredient[];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await request.json();

    if (!body.ingredients || !Array.isArray(body.ingredients)) {
      return NextResponse.json({ error: 'Missing required field: ingredients' }, { status: 400 });
    }

    // Filter for ingredients that are fruits or vegetables
    const produceIngredients = body.ingredients.filter(
      (ing) => ing.category === 'fruit' || ing.category === 'vegetable'
    );

    if (produceIngredients.length === 0) {
      return NextResponse.json({ produceIngredients: [] }, { status: 200 });
    }

    // 1. Try deterministic lookup first
    const lookupItems: ProduceItemInput[] = produceIngredients.map((ing) => ({
      name: ing.name,
      amount: ing.estimated_amount,
      unit: ing.estimated_unit,
    }));

    const deterministicResults = await lookupProduceWeights(lookupItems, supabase);

    // 2. Collect items not matched by deterministic lookup
    const unmatchedItems: { index: number; item: PhotoIngredient }[] = [];
    for (let i = 0; i < produceIngredients.length; i++) {
      if (!deterministicResults.has(i)) {
        unmatchedItems.push({ index: i, item: produceIngredients[i] });
      }
    }

    // 3. Send only unmatched items to Claude for gram estimation
    let aiResults: Awaited<ReturnType<typeof estimateProduceGrams>> = [];
    if (unmatchedItems.length > 0) {
      const itemsForAI: ProduceItem[] = unmatchedItems.map(({ item }) => ({
        name: item.name,
        amount: item.estimated_amount,
        unit: item.estimated_unit,
      }));

      aiResults = await estimateProduceGrams(itemsForAI, user.id);
    }

    // 4. Merge deterministic + AI results
    const result = produceIngredients.map((ing, index) => {
      // Check deterministic result first
      const deterministicResult = deterministicResults.get(index);
      if (deterministicResult) {
        return {
          name: ing.name,
          amount: ing.estimated_amount,
          unit: ing.estimated_unit,
          category: ing.category as 'fruit' | 'vegetable',
          estimatedGrams: deterministicResult.grams,
        };
      }

      // Fall back to AI result
      const unmatchedIdx = unmatchedItems.findIndex(u => u.index === index);
      const estimated = aiResults.find(
        (e) => e.name.toLowerCase() === ing.name.toLowerCase()
      ) || (unmatchedIdx >= 0 ? aiResults[unmatchedIdx] : undefined);

      return {
        name: ing.name,
        amount: ing.estimated_amount,
        unit: ing.estimated_unit,
        category: ing.category as 'fruit' | 'vegetable',
        estimatedGrams: estimated?.estimatedGrams || 100, // Default to 100g if estimation fails
      };
    });

    return NextResponse.json({ produceIngredients: result }, { status: 200 });
  } catch (error) {
    console.error('Error extracting produce from photo:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
