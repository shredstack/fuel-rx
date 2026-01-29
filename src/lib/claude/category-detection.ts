import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { callLLMWithToolUse } from './client';
import type { IngredientCategoryType } from '@/lib/types';

// ============================================
// Ingredient Category Detection Tool Definition
// ============================================

interface CategoryDetectionToolResult {
  category: IngredientCategoryType;
}

const categoryDetectionTool: Tool = {
  name: 'classify_ingredient_category',
  description: 'Classify a food ingredient into its primary category',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: ['protein', 'vegetable', 'fruit', 'grain', 'fat', 'dairy', 'pantry', 'other'],
        description: 'The primary category of the ingredient',
      },
    },
    required: ['category'],
  },
};

// ============================================
// System Prompt
// ============================================

const CATEGORY_DETECTION_SYSTEM_PROMPT = `You are a nutrition assistant for FuelRx, a meal tracking app for CrossFit athletes.

Your task: Classify a food ingredient into exactly one category.

## Categories

**protein** - Primary protein sources:
- Meat: chicken, beef, pork, turkey, lamb, bison, venison
- Seafood: fish, salmon, tuna, shrimp, cod, tilapia, crab, lobster
- Eggs and egg products
- Plant proteins: tofu, tempeh, seitan
- Protein powders and supplements

**vegetable** - Vegetables AND legumes (legumes count for the 800g challenge):
- Leafy greens: spinach, kale, lettuce, arugula, chard, collards
- Cruciferous: broccoli, cauliflower, brussels sprouts, cabbage
- Root vegetables: carrots, beets, radishes, turnips, potatoes, sweet potatoes, yams
- Nightshades: tomatoes, bell peppers, eggplant
- Squash: zucchini, yellow squash, butternut squash, pumpkin
- Legumes: black beans, kidney beans, chickpeas, lentils, edamame, peas, lima beans, navy beans, pinto beans, hummus
- Others: cucumber, celery, asparagus, green beans, corn, mushrooms, onion, garlic, artichoke

**fruit** - Fresh, frozen, or dried fruits:
- Apples, bananas, oranges, berries (strawberries, blueberries, raspberries, blackberries)
- Grapes, melons (watermelon, cantaloupe, honeydew), peaches, pears, plums
- Mangoes, pineapple, kiwi, cherries, avocado
- Dried fruits: raisins, dates, dried cranberries, dried apricots
- Fruit juices (100% juice)

**grain** - Grains, cereals, and grain-based products:
- Rice, pasta, bread, tortillas, wraps
- Oats, quinoa, barley, farro, couscous
- Cereal, granola, granola bars
- Crackers, pretzels, chips (grain-based)
- Flour, cornmeal

**fat** - Oils, nuts, seeds, and high-fat foods:
- Cooking oils: olive oil, coconut oil, avocado oil, vegetable oil
- Nuts: almonds, walnuts, cashews, pecans, pistachios, macadamia
- Seeds: chia seeds, flax seeds, sunflower seeds, pumpkin seeds
- Nut butters: peanut butter, almond butter

**dairy** - Milk and dairy products:
- Milk (all types including plant-based milks like almond milk, oat milk)
- Cheese (all types)
- Yogurt (all types including Greek yogurt)
- Butter, cream, sour cream, cream cheese
- Ice cream

**pantry** - Condiments, sauces, seasonings, and shelf-stable items:
- Condiments: ketchup, mustard, mayo, hot sauce, soy sauce
- Sauces: marinara, BBQ sauce, salsa, pesto
- Sweeteners: sugar, honey, maple syrup, agave
- Baking: baking powder, baking soda, vanilla extract
- Spices and dried herbs

**other** - Only if the item truly doesn't fit any category above

## Rules
- For branded/processed foods, classify by the PRIMARY ingredient (e.g., "Kind Almond Bar" → fat, "Chobani Greek Yogurt" → dairy)
- Multi-ingredient items go by their dominant component
- When in doubt between two categories, pick the one that best represents the food's nutritional role
- Prefer a specific category over "other" — only use "other" as a last resort`;

// ============================================
// Main Function
// ============================================

/**
 * Detect the category of a food ingredient using AI classification.
 * Uses Haiku for fast, low-cost classification.
 */
export async function detectIngredientCategory(
  ingredientName: string,
  userId: string
): Promise<IngredientCategoryType> {
  if (!ingredientName.trim()) {
    return 'other';
  }

  try {
    const userPrompt = `Classify this food ingredient into a category:\n\n"${ingredientName}"`;

    const { result } = await callLLMWithToolUse<CategoryDetectionToolResult>({
      prompt: `${CATEGORY_DETECTION_SYSTEM_PROMPT}\n\n${userPrompt}`,
      tool: categoryDetectionTool,
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 100,
      userId,
      promptType: 'ingredient_category_detection',
    });

    return result.category;
  } catch (error) {
    console.error('Failed to detect ingredient category, defaulting to "other":', error);
    return 'other';
  }
}
