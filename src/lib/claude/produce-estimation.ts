import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { callLLMWithToolUse } from './client';

// ============================================
// Produce Estimation Tool Definition
// ============================================

export interface ProduceItem {
  name: string;
  amount: string;
  unit: string;
}

export interface EstimatedProduceItem {
  name: string;
  category: 'fruit' | 'vegetable' | 'other';
  estimatedGrams: number;
}

interface ProduceEstimationToolResult {
  items: EstimatedProduceItem[];
}

const produceEstimationTool: Tool = {
  name: 'estimate_produce_grams',
  description: 'Classify produce as fruit/vegetable and estimate weight in grams',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the produce item',
            },
            category: {
              type: 'string',
              enum: ['fruit', 'vegetable', 'other'],
              description: 'Classification of the produce',
            },
            estimatedGrams: {
              type: 'number',
              description: 'Estimated weight in grams',
            },
          },
          required: ['name', 'category', 'estimatedGrams'],
        },
      },
    },
    required: ['items'],
  },
};

// ============================================
// System Prompt
// ============================================

const PRODUCE_ESTIMATION_SYSTEM_PROMPT = `You are a nutrition assistant for FuelRx, an app for CrossFit athletes tracking their 800g fruit and vegetable challenge.

Your task: Classify each produce item as 'fruit', 'vegetable', or 'other', and estimate its weight in grams based on the amount and unit provided.

## Classification Rules

**Fruits** - Botanically or culinary fruits:
- Apples, bananas, oranges, berries (strawberries, blueberries, raspberries, blackberries)
- Grapes, melons (watermelon, cantaloupe, honeydew), peaches, pears, plums
- Mangoes, pineapple, kiwi, cherries, avocado (yes, it's a fruit!)

**Vegetables** - Everything else from the produce section:
- Leafy greens: spinach, kale, lettuce, arugula, chard, collards
- Cruciferous: broccoli, cauliflower, brussels sprouts, cabbage
- Root/bulb: carrots, beets, onions, garlic, radishes, turnips, sweet potatoes, yams
- Nightshades: tomatoes, bell peppers, eggplant (culinary vegetables)
- Squash: zucchini, yellow squash, butternut squash, pumpkin
- Legumes: black beans, kidney beans, chickpeas, lentils, edamame, peas
- Others: cucumber, celery, asparagus, green beans, corn, mushrooms

**Other** - Items that don't clearly fit the 800g challenge:
- Dried herbs and spices (basil, oregano, cilantro in small amounts)
- Regular white potatoes (starchy, often counted separately - but sweet potatoes DO count!)
- Items that are negligible in quantity
- Proteins (chicken, beef, fish, eggs, tofu)
- Dairy (milk, cheese, yogurt)
- Grains (rice, pasta, bread, oats)
- Oils and fats

## Gram Estimation Guidelines

Use these common conversions as reference:

**Leafy Greens (low density):**
- 1 cup raw spinach/lettuce: ~30g
- 1 cup raw kale (packed): ~70g
- 1 large handful: ~30-40g

**Chopped/Diced Vegetables (medium density):**
- 1 cup chopped broccoli: ~90g
- 1 cup diced bell pepper: ~150g
- 1 cup sliced cucumber: ~120g
- 1 cup chopped carrots: ~130g
- 1 cup diced tomatoes: ~180g
- 1 cup chopped onion: ~160g
- 1 cup sliced mushrooms: ~70g
- 1 cup green beans: ~100g
- 1 cup zucchini: ~120g

**Whole Vegetables:**
- 1 medium bell pepper: ~150g
- 1 medium tomato: ~150g
- 1 medium carrot: ~60g
- 1 medium zucchini: ~200g
- 1 cup cherry tomatoes: ~150g

**Fruits:**
- 1 medium apple: ~180g
- 1 medium banana: ~120g
- 1 cup berries (mixed): ~150g
- 1 cup strawberries (sliced): ~170g
- 1 cup blueberries: ~150g
- 1 medium orange: ~130g
- 1 cup grapes: ~150g
- 1 medium avocado: ~150g (edible portion)

**By Weight/Ounces:**
- 1 oz = ~28g
- 4 oz = ~113g
- 6 oz = ~170g

Be slightly conservative with estimates - users will verify and adjust. Round to the nearest 10g for cleaner numbers.`;

// ============================================
// Main Function
// ============================================

/**
 * Classify produce items and estimate their weight in grams using Claude.
 * Returns items with category (fruit/vegetable/other) and estimated grams.
 */
export async function estimateProduceGrams(
  items: ProduceItem[],
  userId: string
): Promise<EstimatedProduceItem[]> {
  if (items.length === 0) {
    return [];
  }

  // Build the user prompt with the items to classify
  const itemsList = items
    .map((item, i) => `${i + 1}. ${item.amount} ${item.unit} ${item.name}`)
    .join('\n');

  const userPrompt = `${PRODUCE_ESTIMATION_SYSTEM_PROMPT}

## Items to Classify and Estimate

${itemsList}

Use the estimate_produce_grams tool to provide your classification and gram estimates for each item.`;

  const { result } = await callLLMWithToolUse<ProduceEstimationToolResult>({
    prompt: userPrompt,
    tool: produceEstimationTool,
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 2000,
    userId,
    promptType: 'produce_estimation',
  });

  return result.items;
}
