import type {
  Ingredient,
  CoreIngredients,
  DayPlan,
  UserProfile,
} from '../types';
import { DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '../types';
import { callLLMWithToolUse, logLLMCall } from './client';
import { groceryListSchema, consolidatedGrocerySchema } from '../llm-schemas';
import {
  hasHouseholdMembers,
  getAverageServingMultiplier,
  getHouseholdDescription,
} from './helpers';

/**
 * Consolidate raw ingredients into a practical grocery list using LLM
 */
export async function consolidateGroceryListWithLLM(
  rawIngredients: Ingredient[],
  userId: string
): Promise<Ingredient[]> {
  // Group raw ingredients by name similarity for the prompt
  const ingredientSummary = rawIngredients.map(i =>
    `${i.amount} ${i.unit} ${i.name} (${i.category})`
  ).join('\n');

  const prompt = `You are a helpful assistant that creates practical grocery shopping lists.

## Task
Take this raw list of ingredients from a 7-day meal plan and consolidate them into a practical grocery shopping list.

## Raw Ingredients (one per line):
${ingredientSummary}

## Instructions
1. **Combine similar ingredients**: Merge items that are the same ingredient even if described differently (e.g., "avocado", "avocado, sliced", "1/2 avocado" should all become one "Avocados" entry)
2. **Use practical shopping quantities**: Convert to units you'd actually buy at a store:
   - Use "whole" or count for items bought individually (e.g., "3 Avocados" not "2.5 medium avocado")
   - Use "bag" for items typically sold in bags (e.g., "1 bag Carrots" or "2 bags Spinach")
   - Use "bunch" for herbs and leafy greens sold in bunches
   - Use "lb" or "oz" for meats and proteins
   - Use "can" or "jar" for canned/jarred items
   - Use "dozen" for eggs
   - Use "container" or "package" for items sold that way (e.g., yogurt, tofu)
3. **Round up to whole numbers**: Always round up to ensure the shopper has enough (e.g., 1.3 avocados → 2 avocados)
4. **Keep practical minimums**: Don't list less than you can buy (e.g., at least 1 bag of carrots, at least 1 bunch of cilantro)
5. **Preserve categories**: Keep the same category for each ingredient

## Response Format
Sort the list by category (produce, protein, dairy, grains, pantry, frozen, other) then alphabetically by name within each category.

Use the consolidate_grocery_list tool to provide your consolidated list.`;

  // Use tool use for guaranteed valid JSON output
  const { result: parsed } = await callLLMWithToolUse<{ grocery_list: Ingredient[] }>({
    prompt,
    tool: consolidatedGrocerySchema,
    maxTokens: 8000,
    userId,
    promptType: 'grocery_list_consolidation',
  });

  return parsed.grocery_list;
}

/**
 * Generate grocery list from core ingredients
 * Converts core ingredients to practical shopping quantities
 * Scales quantities based on household servings
 */
export async function generateGroceryListFromCoreIngredients(
  coreIngredients: CoreIngredients,
  days: DayPlan[],
  userId: string,
  profile?: UserProfile
): Promise<Ingredient[]> {
  // First, collect all ingredient usage from meals to understand quantities
  const ingredientUsage: Map<string, { count: number; amounts: string[] }> = new Map();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase();
        const existing = ingredientUsage.get(key) || { count: 0, amounts: [] };
        existing.count += 1;
        existing.amounts.push(`${ing.amount} ${ing.unit}`);
        ingredientUsage.set(key, existing);
      }
    }
  }

  // Build usage summary
  const usageSummary = Array.from(ingredientUsage.entries())
    .map(([name, data]) => `${name}: used ${data.count} times (${data.amounts.join(', ')})`)
    .join('\n');

  // Calculate household scaling if applicable
  const householdServings = profile?.household_servings ?? DEFAULT_HOUSEHOLD_SERVINGS_PREFS;
  const avgMultiplier = getAverageServingMultiplier(householdServings);
  const householdHasMembers = hasHouseholdMembers(householdServings);

  let householdScalingSection = '';
  if (householdHasMembers) {
    householdScalingSection = `
## HOUSEHOLD SCALING - READ CAREFULLY
The ingredient usage above shows ATHLETE-ONLY portions (1 person).
The household has ${getHouseholdDescription(householdServings)}, which means an average of ${avgMultiplier.toFixed(1)}x portions per meal.

**YOUR TASK**: Multiply the total ingredient amounts by approximately ${avgMultiplier.toFixed(1)}x to account for the full household, THEN consolidate into practical shopping quantities.

Example: If the athlete uses "chicken breast: 8 oz × 7 meals = 56 oz (3.5 lb)" for the week,
the household (${avgMultiplier.toFixed(1)}x) needs approximately ${(3.5 * avgMultiplier).toFixed(1)} lb total.
`;
  } else {
    householdScalingSection = `
## SCALING NOTE
This meal plan is for a SINGLE PERSON (the athlete only). No household scaling needed.
Simply consolidate the ingredient usage into practical shopping quantities.
`;
  }

  const prompt = `You are creating a practical grocery shopping list from a meal plan's core ingredients.

## CORE INGREDIENTS
${JSON.stringify(coreIngredients, null, 2)}

## INGREDIENT USAGE IN MEALS
${usageSummary}
${householdScalingSection}

## CRITICAL: REASONABLENESS CHECKS
Before finalizing quantities, validate that they make sense for ONE WEEK of meals:

**Red flags that indicate you're calculating wrong:**
- More than 15 of any single fruit or vegetable (e.g., 40 bell peppers is WRONG)
- More than 20 of any citrus or small fruit (e.g., 26 oranges is WRONG)
- More than 12 avocados (unless explicitly used in every single meal)
- More than 5 lbs of any single vegetable
- More than 8 lbs total protein for a household of 2-4 people

**Realistic weekly quantities for a household of 3-4 people:**
- Proteins: 4-6 lbs total (e.g., 2 lbs chicken + 2 lbs ground turkey + 1.5 lbs fish)
- Leafy greens: 1-2 bags spinach, 1 bunch kale
- Vegetables: 6-10 bell peppers MAX, 4-6 zucchini, 3-5 lbs broccoli
- Fruits: 2 bunches bananas (6-8 bananas), 6-12 oranges, 6-10 avocados
- Sweet potatoes: 3-5 lbs
- Grains: 2-3 lbs rice, 1-2 bags/boxes oats

If your calculated quantities exceed these by 2x or more, you're scaling incorrectly.

## INSTRUCTIONS
Convert these core ingredients into a practical grocery shopping list with realistic quantities.

**SCALING REMINDER:**
${householdHasMembers
  ? `The usage data above shows ATHLETE-ONLY portions. You MUST apply the ${avgMultiplier.toFixed(1)}x household multiplier when calculating totals, then consolidate into practical shopping units.`
  : `The usage data shows athlete-only portions. Round up slightly for shopping convenience.`}

Use practical shopping quantities:
- Use "whole" or count for items bought individually (e.g., "6" bell peppers, NOT "40")
- Use "lb" or "oz" for meats and proteins
- Use "bag" for items typically sold in bags
- Use "bunch" for herbs and leafy greens
- Use "container" or "package" for yogurt, tofu, etc.
- Round up modestly to ensure enough food, but stay realistic

## RESPONSE FORMAT
Return ONLY valid JSON:
Sort by category: produce, protein, dairy, grains, pantry, frozen, other.

Use the generate_grocery_list tool to provide your grocery list.`;

  // Use tool use for guaranteed valid JSON output
  const { result: parsed } = await callLLMWithToolUse<{ grocery_list: Ingredient[] }>({
    prompt,
    tool: groceryListSchema,
    maxTokens: 12000,
    userId,
    promptType: 'two_stage_grocery_list',
  });

  // Validate and cap quantities
  const cappedGroceryList = capGroceryQuantities(parsed.grocery_list, userId);

  return cappedGroceryList;
}

/**
 * Cap grocery quantities to reasonable weekly maximums
 * Prevents LLM errors that produce absurd quantities
 */
async function capGroceryQuantities(groceryList: Ingredient[], userId: string): Promise<Ingredient[]> {
  // Define reasonable maximum quantities for a week's worth of groceries
  // These limits are generous enough for a family of 4-5 but prevent absurd quantities
  const maxQuantities: Record<string, { max: number; unit: string }> = {
    // Produce - whole items
    'bell pepper': { max: 12, unit: 'whole' },
    'avocado': { max: 14, unit: 'whole' },
    'orange': { max: 18, unit: 'whole' },
    'apple': { max: 18, unit: 'whole' },
    'banana': { max: 14, unit: 'whole' },
    'lemon': { max: 10, unit: 'whole' },
    'lime': { max: 10, unit: 'whole' },
    'onion': { max: 8, unit: 'whole' },
    'zucchini': { max: 10, unit: 'whole' },
    'cucumber': { max: 8, unit: 'whole' },
    'tomato': { max: 12, unit: 'whole' },
    'sweet potato': { max: 10, unit: 'whole' },
    // Proteins - by weight
    'chicken': { max: 8, unit: 'lb' },
    'beef': { max: 6, unit: 'lb' },
    'salmon': { max: 5, unit: 'lb' },
    'fish': { max: 5, unit: 'lb' },
    'turkey': { max: 6, unit: 'lb' },
    'pork': { max: 5, unit: 'lb' },
    'shrimp': { max: 3, unit: 'lb' },
  };

  // Validate and cap quantities
  const warnings: string[] = [];
  const cappedList = groceryList.map(item => {
    const amount = parseFloat(item.amount);
    if (isNaN(amount)) return item;

    const nameLower = item.name.toLowerCase();

    // Check against specific limits
    for (const [ingredient, limit] of Object.entries(maxQuantities)) {
      if (nameLower.includes(ingredient) && amount > limit.max) {
        warnings.push(`Capped ${item.name}: ${amount} → ${limit.max} ${item.unit}`);
        return { ...item, amount: String(limit.max) };
      }
    }

    // General fallback limits for items not in the specific list
    if (item.unit === 'whole' && amount > 20 && !nameLower.includes('egg')) {
      warnings.push(`Capped ${item.name}: ${amount} → 15 whole`);
      return { ...item, amount: '15' };
    }
    if (item.unit === 'lb' && amount > 10) {
      warnings.push(`Capped ${item.name}: ${amount} → 8 lb`);
      return { ...item, amount: '8' };
    }

    return item;
  });

  if (warnings.length > 0) {
    console.warn('Grocery list quantities capped:', warnings);
    // Log to database for monitoring
    await logLLMCall({
      user_id: userId,
      prompt: 'QUANTITY_CAPPED',
      output: warnings.join('; '),
      model: 'validation',
      prompt_type: 'grocery_list_validation',
    });
  }

  return cappedList;
}
