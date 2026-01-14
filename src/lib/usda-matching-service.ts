/**
 * USDA Matching Service
 *
 * Uses Claude to intelligently match ingredients to USDA FoodData Central entries.
 * Claude evaluates multiple candidates and picks the best match based on:
 * - Ingredient name similarity
 * - Preparation state (raw vs cooked)
 * - Common usage context
 * - Data type preference (Foundation > SR Legacy > Branded)
 */

import { callLLMWithToolUse } from '@/lib/claude/client';
import {
  searchUSDA,
  getUSDAFoodDetails,
  extractNutritionPer100g,
  extractNutritionFromSearchResult,
  convertTo100gToServing,
  type USDASearchResult,
  type USDANutritionPer100g,
} from '@/lib/usda-service';

// ============================================
// Types
// ============================================

export interface USDAMatchCandidate {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  nutritionPer100g: USDANutritionPer100g;
}

export interface USDAMatchResult {
  status: 'matched' | 'no_match' | 'error';
  bestMatch?: {
    fdcId: number;
    description: string;
    confidence: number;
    reasoning: string;
    nutritionPer100g: USDANutritionPer100g;
  };
  alternatives?: Array<{
    fdcId: number;
    description: string;
    confidence: number;
  }>;
  errorMessage?: string;
  /** Recommended serving size if current is non-standard */
  recommendedServingSize?: number;
  /** Recommended serving unit if current is non-standard */
  recommendedServingUnit?: string;
  /** Reason for serving change recommendation */
  servingChangeReason?: string;
  /** Whether this match needs manual review due to uncertainty or large discrepancy */
  needsReview?: boolean;
}

export interface MatchIngredientOptions {
  /** The ingredient name to match */
  ingredientName: string;
  /** Current serving size (for context) */
  servingSize?: number;
  /** Current serving unit (for context) */
  servingUnit?: string;
  /** Ingredient category (for context) */
  category?: string;
  /** Existing nutrition values (for comparison) */
  existingNutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  /** User ID for logging (defaults to 'system') */
  userId?: string;
}

// ============================================
// Claude Tool Definition
// ============================================

const USDA_MATCH_TOOL = {
  name: 'select_usda_match',
  description: 'Select the best USDA FoodData Central entry that matches an ingredient and optionally recommend better serving units',
  input_schema: {
    type: 'object' as const,
    properties: {
      best_match_fdc_id: {
        type: 'number',
        description: 'The FDC ID of the best matching USDA entry. Use 0 if no good match exists.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0.0 to 1.0 indicating how well the USDA entry matches the ingredient. Below 0.5 means no good match.',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why this match was selected (or why no match was found).',
      },
      alternative_fdc_ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of other viable FDC IDs that could also match, in order of preference.',
      },
      recommended_serving_size: {
        type: 'number',
        description: 'If the current serving unit is non-standard or ambiguous (like "1 medium"), recommend a better serving size. Use standard cooking measurements.',
      },
      recommended_serving_unit: {
        type: 'string',
        description: 'If the current serving unit is non-standard or ambiguous, recommend a better unit. Prefer: g, oz, cup, tbsp, tsp for measurable ingredients.',
      },
      serving_change_reason: {
        type: 'string',
        description: 'If recommending a serving change, explain why (e.g., "1 medium carrot is ambiguous, using 100g for consistency").',
      },
      needs_review: {
        type: 'boolean',
        description: 'Set to true if the match is uncertain or the nutrition values differ significantly (>40%) from existing estimates. This flags the item for manual review.',
      },
    },
    required: ['best_match_fdc_id', 'confidence', 'reasoning'],
  },
};

interface USDAMatchToolResult {
  best_match_fdc_id: number;
  confidence: number;
  reasoning: string;
  alternative_fdc_ids?: number[];
  recommended_serving_size?: number;
  recommended_serving_unit?: string;
  serving_change_reason?: string;
  needs_review?: boolean;
}

// ============================================
// Main Matching Function
// ============================================

/**
 * Find the best USDA match for an ingredient using Claude
 *
 * Process:
 * 1. Search USDA for the ingredient name
 * 2. Present candidates to Claude with context
 * 3. Claude selects the best match with confidence and reasoning
 * 4. Fetch full nutrition details for the match
 *
 * @param options - Matching options including ingredient name and context
 * @returns Match result with best match, alternatives, or error
 */
export async function findBestUSDAMatch(options: MatchIngredientOptions): Promise<USDAMatchResult> {
  const {
    ingredientName,
    servingSize,
    servingUnit,
    category,
    existingNutrition,
    userId = 'system',
  } = options;

  try {
    // Step 1: Search USDA for candidates
    // Prefer Foundation and SR Legacy data over Branded
    const searchResults = await searchUSDA(ingredientName, 15);

    if (searchResults.length === 0) {
      return {
        status: 'no_match',
        errorMessage: `No USDA results found for "${ingredientName}"`,
      };
    }

    // Step 2: Build candidates list with basic nutrition
    const candidates: USDAMatchCandidate[] = searchResults.map(result => ({
      fdcId: result.fdcId,
      description: result.description,
      dataType: result.dataType,
      brandOwner: result.brandOwner,
      nutritionPer100g: extractNutritionFromSearchResult(result),
    }));

    // Step 3: Build prompt for Claude
    const prompt = buildMatchingPrompt(
      ingredientName,
      candidates,
      { servingSize, servingUnit, category, existingNutrition }
    );

    // Step 4: Call Claude to select the best match
    const { result: toolResult } = await callLLMWithToolUse<USDAMatchToolResult>({
      prompt,
      tool: USDA_MATCH_TOOL,
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 1024,
      userId,
      promptType: 'usda_ingredient_matching',
    });

    // Step 5: Process Claude's selection
    if (toolResult.best_match_fdc_id === 0 || toolResult.confidence < 0.5) {
      return {
        status: 'no_match',
        bestMatch: toolResult.best_match_fdc_id !== 0 ? {
          fdcId: toolResult.best_match_fdc_id,
          description: candidates.find(c => c.fdcId === toolResult.best_match_fdc_id)?.description || '',
          confidence: toolResult.confidence,
          reasoning: toolResult.reasoning,
          nutritionPer100g: candidates.find(c => c.fdcId === toolResult.best_match_fdc_id)?.nutritionPer100g || {
            calories: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null,
          },
        } : undefined,
        alternatives: toolResult.alternative_fdc_ids?.map(id => {
          const candidate = candidates.find(c => c.fdcId === id);
          return {
            fdcId: id,
            description: candidate?.description || '',
            confidence: toolResult.confidence * 0.8, // Alternatives are less confident
          };
        }),
        errorMessage: toolResult.reasoning,
      };
    }

    // Step 6: Get full nutrition details for the best match
    const bestCandidate = candidates.find(c => c.fdcId === toolResult.best_match_fdc_id);

    // Optionally fetch full details for more accurate nutrition
    // (search results usually have the basic macros we need)
    let nutritionPer100g = bestCandidate?.nutritionPer100g;

    if (!nutritionPer100g || nutritionPer100g.calories === 0) {
      const fullDetails = await getUSDAFoodDetails(toolResult.best_match_fdc_id);
      if (fullDetails) {
        nutritionPer100g = extractNutritionPer100g(fullDetails);
      }
    }

    return {
      status: 'matched',
      bestMatch: {
        fdcId: toolResult.best_match_fdc_id,
        description: bestCandidate?.description || '',
        confidence: toolResult.confidence,
        reasoning: toolResult.reasoning,
        nutritionPer100g: nutritionPer100g || {
          calories: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null,
        },
      },
      alternatives: toolResult.alternative_fdc_ids?.map(id => {
        const candidate = candidates.find(c => c.fdcId === id);
        return {
          fdcId: id,
          description: candidate?.description || '',
          confidence: toolResult.confidence * 0.8,
        };
      }),
      // Include serving recommendations if provided
      recommendedServingSize: toolResult.recommended_serving_size,
      recommendedServingUnit: toolResult.recommended_serving_unit,
      servingChangeReason: toolResult.serving_change_reason,
      needsReview: toolResult.needs_review,
    };
  } catch (error) {
    console.error('Error finding USDA match:', error);
    return {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error during USDA matching',
    };
  }
}

// ============================================
// Prompt Building
// ============================================

function buildMatchingPrompt(
  ingredientName: string,
  candidates: USDAMatchCandidate[],
  context: {
    servingSize?: number;
    servingUnit?: string;
    category?: string;
    existingNutrition?: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  }
): string {
  const { servingSize, servingUnit, category, existingNutrition } = context;

  // Format candidates for the prompt
  const candidatesList = candidates
    .map((c, i) => {
      const n = c.nutritionPer100g;
      return `${i + 1}. FDC ID: ${c.fdcId}
   Description: ${c.description}
   Data Type: ${c.dataType}${c.brandOwner ? ` (Brand: ${c.brandOwner})` : ''}
   Nutrition per 100g: ${n.calories} cal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fat}g fat`;
    })
    .join('\n\n');

  // Build context section
  let contextSection = '';
  if (servingSize && servingUnit) {
    contextSection += `\nTypical serving size used: ${servingSize} ${servingUnit}`;
  }
  if (category) {
    contextSection += `\nIngredient category: ${category}`;
  }
  if (existingNutrition) {
    contextSection += `\nCurrent nutrition estimate (LLM-generated): ${existingNutrition.calories} cal, ${existingNutrition.protein}g protein, ${existingNutrition.carbs}g carbs, ${existingNutrition.fat}g fat`;
  }

  return `You are helping match a recipe ingredient to the most appropriate USDA FoodData Central entry.

## Ingredient to Match
Name: "${ingredientName}"${contextSection}

## USDA Candidates
${candidatesList}

## Your Task
Select the BEST matching USDA entry for this ingredient based on:

1. **Name Similarity**: How closely does the USDA description match the ingredient name?
2. **Typical Usage**: For proteins, prefer "meat only" unless the ingredient explicitly says "with skin". For vegetables/fruits, prefer raw unless the recipe implies cooked.
3. **Data Type Priority**: Prefer Foundation > SR Legacy > Branded (branded products vary too much)
4. **Nutrition Sanity Check**: If we have existing nutrition estimates, the USDA values should be in a SIMILAR range. If your selected match would result in calories differing by more than 40% from existing estimates, set needs_review=true.

## Guidelines
- If the ingredient is a common whole food (chicken, rice, vegetables), there should be a good match
- If the ingredient is a branded product or very specific preparation, it may not have a good match
- Use confidence 0.9+ for exact or near-exact matches
- Use confidence 0.7-0.9 for good matches with minor differences
- Use confidence 0.5-0.7 for acceptable matches with some uncertainty
- Use confidence below 0.5 (or FDC ID 0) if no suitable match exists

## Serving Size Recommendations
The current serving uses: ${servingSize || '?'} ${servingUnit || '?'}

**If the serving unit is non-standard or ambiguous**, recommend a better one:
- Non-standard units to fix: "medium", "large", "small", "piece", "item", "whole", "unit", "serving"
- Standard units to use: g, oz, cup, tbsp, tsp, lb
- For proteins (chicken, beef, fish): prefer oz or g
- For produce: prefer g or cup
- For liquids/sauces: prefer cup, tbsp, or tsp
- For grains/pasta: prefer cup (cooked) or g

**USDA Standard Portions (per 100g reference)**:
- 1 oz = 28.35g
- 1 cup varies by ingredient (check USDA portions if available)
- 1 tbsp ≈ 15g for most ingredients
- 1 tsp ≈ 5g for most ingredients

If you recommend changing the serving, provide:
- recommended_serving_size: the new size
- recommended_serving_unit: the new unit (g, oz, cup, etc.)
- serving_change_reason: why you're recommending this change

## Examples of Good Matches
- "chicken breast" → "Chicken, broilers or fryers, breast, meat only, cooked, roasted"
- "chicken thighs" → "Chicken, broilers or fryers, thigh, meat only, cooked, roasted" (prefer meat only!)
- "almonds" → "Nuts, almonds, dry roasted, without salt added"
- "brown rice" → "Rice, brown, long-grain, cooked"

## Examples of Poor Matches (use confidence < 0.5)
- "grandma's special sauce" → No standard USDA entry exists
- "protein powder" → Too brand-specific, USDA entries vary significantly

## When to Flag for Review (needs_review=true)
- The match confidence is between 0.5-0.7
- The resulting calories would differ >40% from existing estimates
- The serving unit conversion is uncertain
- Multiple equally good matches exist

Select the best match using the select_usda_match tool.`;
}

// ============================================
// Batch Processing Helper
// ============================================

/**
 * Process multiple ingredients for USDA matching
 * Includes rate limiting to stay under USDA API limits
 *
 * @param ingredients - Array of ingredients to match
 * @param delayMs - Delay between API calls (default 200ms)
 * @returns Array of match results
 */
export async function batchMatchIngredients(
  ingredients: Array<{
    id: string;
    name: string;
    servingSize?: number;
    servingUnit?: string;
    category?: string;
  }>,
  delayMs: number = 200
): Promise<Array<{ id: string; result: USDAMatchResult }>> {
  const results: Array<{ id: string; result: USDAMatchResult }> = [];

  for (const ingredient of ingredients) {
    const result = await findBestUSDAMatch({
      ingredientName: ingredient.name,
      servingSize: ingredient.servingSize,
      servingUnit: ingredient.servingUnit,
      category: ingredient.category,
    });

    results.push({ id: ingredient.id, result });

    // Rate limiting delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert USDA match result nutrition to a specific serving size
 */
export function convertMatchToServing(
  matchResult: USDAMatchResult,
  servingSize: number,
  servingUnit: string
): USDANutritionPer100g | null {
  if (matchResult.status !== 'matched' || !matchResult.bestMatch) {
    return null;
  }

  return convertTo100gToServing(
    matchResult.bestMatch.nutritionPer100g,
    servingSize,
    servingUnit
  );
}
