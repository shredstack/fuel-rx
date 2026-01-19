/**
 * Extract Produce from Photo Meal API Endpoint
 *
 * POST /api/consumption/extract-produce-from-photo - Extract fruits/vegetables from photo meal ingredients
 *
 * Given an array of ingredients (with categories already detected by Claude Vision),
 * estimates their weight in grams for the 800g challenge.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estimateProduceGrams, type ProduceItem } from '@/lib/claude/produce-estimation';

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

    // Convert to format expected by produce estimation
    const itemsForEstimation: ProduceItem[] = produceIngredients.map((ing) => ({
      name: ing.name,
      amount: ing.estimated_amount,
      unit: ing.estimated_unit,
    }));

    // Call Claude to estimate grams for each produce item
    const estimatedItems = await estimateProduceGrams(itemsForEstimation, user.id);

    // Map back to the format expected by ProduceExtractorModal
    const result = produceIngredients.map((ing, index) => {
      const estimated = estimatedItems.find(
        (e) => e.name.toLowerCase() === ing.name.toLowerCase()
      ) || estimatedItems[index];

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
