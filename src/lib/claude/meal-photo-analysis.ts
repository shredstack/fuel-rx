import Anthropic from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { anthropic, logLLMCall } from './client';
import type { MealPhotoAnalysisResult } from '../types';

// ============================================
// Meal Photo Analysis Tool Definition
// ============================================

const mealPhotoAnalysisTool: Tool = {
  name: 'analyze_meal_photo',
  description: 'Analyze a meal photo to identify ingredients and estimate nutrition',
  input_schema: {
    type: 'object' as const,
    properties: {
      meal_name: {
        type: 'string',
        description: 'A descriptive, appetizing name for the meal',
      },
      meal_description: {
        type: 'string',
        description: 'Brief description of what is visible in the photo',
      },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the ingredient' },
            estimated_amount: { type: 'string', description: 'Estimated amount (e.g., "6", "1.5", "0.5")' },
            estimated_unit: { type: 'string', description: 'Unit of measurement (e.g., "oz", "cup", "medium")' },
            calories: { type: 'number', description: 'Estimated calories for this portion' },
            protein: { type: 'number', description: 'Estimated protein in grams' },
            carbs: { type: 'number', description: 'Estimated carbs in grams' },
            fat: { type: 'number', description: 'Estimated fat in grams' },
            confidence: { type: 'number', description: 'Confidence score 0-1 for this ingredient' },
            category: {
              type: 'string',
              enum: ['protein', 'vegetable', 'fruit', 'grain', 'fat', 'dairy', 'other'],
              description: 'Category of the ingredient',
            },
          },
          required: ['name', 'estimated_amount', 'estimated_unit', 'calories', 'protein', 'carbs', 'fat', 'confidence'],
        },
      },
      total_macros: {
        type: 'object',
        properties: {
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
        required: ['calories', 'protein', 'carbs', 'fat'],
      },
      overall_confidence: {
        type: 'number',
        description: 'Overall confidence in the analysis (0-1)',
      },
      analysis_notes: {
        type: 'string',
        description: 'Any caveats, notes, or observations about the analysis',
      },
    },
    required: ['meal_name', 'ingredients', 'total_macros', 'overall_confidence'],
  },
};

// ============================================
// System Prompt for Meal Photo Analysis
// ============================================

const MEAL_PHOTO_ANALYSIS_SYSTEM_PROMPT = `You are a nutrition analyst for FuelRx, an app for CrossFit athletes. Analyze this meal photo to identify all visible foods and estimate their nutritional content.

## Your Task
1. Identify each distinct food item visible in the image
2. Estimate portion sizes based on visual cues (plate size, utensils, common references)
3. Calculate macros for each ingredient based on the estimated portion
4. Provide a descriptive, appetizing meal name
5. Assess your confidence in the analysis

## Guidelines for Identification
- Be specific with proteins (e.g., "grilled chicken breast" not just "chicken")
- List each vegetable type separately
- For mixed dishes, break down into component ingredients when possible
- Account for cooking oils, sauces, and dressings even if not fully visible
- If you can identify a specific dish type (e.g., "Caesar salad"), use that knowledge to inform hidden ingredients

## Portion Estimation for CrossFit Athletes
CrossFit athletes typically eat larger portions than average:
- Proteins: 4-8 oz servings are common
- Vegetables: 1-2 cups per meal
- Grains/starches: 1/2-1 cup per meal
- Use visual cues: standard dinner plate is 10-11 inches, a fist is roughly 1 cup

## Unit Standards
- Proteins: oz (ounces)
- Vegetables/fruits: cup or count (e.g., "1 medium")
- Grains: cup
- Oils/sauces: tbsp (tablespoon)
- Cheese: oz
- Eggs: count

## Nutrition Estimation
- Use USDA FoodData Central guidelines as your reference
- Be conservative with calories - better to slightly underestimate
- Account for cooking methods (grilled vs fried affects fat content)
- Remember that sauces and oils add significant calories

## Confidence Scoring
- 0.9-1.0: Clear, easily identifiable food with standard portions
- 0.7-0.9: Identifiable food but some uncertainty in exact portion
- 0.5-0.7: Can identify food type but unclear on specifics (hidden ingredients, mixed dish)
- Below 0.5: Uncertain identification, best guess

## Important Notes
- If the image doesn't show food or is too unclear, set overall_confidence below 0.3 and explain in notes
- If you see packaged/branded food, note it in analysis_notes
- Round calories to nearest 5, macros to 0.5g

Use the analyze_meal_photo tool to provide your analysis.`;

// ============================================
// Main Analysis Function
// ============================================

/**
 * Analyze a meal photo using Claude Vision API.
 * Returns structured ingredient breakdown and macro estimates.
 */
export async function analyzeMealPhoto(
  imageBase64: string,
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  userId: string
): Promise<MealPhotoAnalysisResult> {
  const startTime = Date.now();

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: MEAL_PHOTO_ANALYSIS_SYSTEM_PROMPT,
    tools: [mealPhotoAnalysisTool],
    tool_choice: { type: 'tool', name: mealPhotoAnalysisTool.name },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Analyze this meal photo and identify all ingredients with their estimated portions and nutritional content.',
          },
        ],
      },
    ],
  });

  const duration = Date.now() - startTime;

  // Log the LLM call
  await logLLMCall({
    user_id: userId,
    prompt: '[Meal photo analysis - image content]',
    output: JSON.stringify(message.content),
    model: 'claude-sonnet-4-20250514',
    prompt_type: 'meal_photo_analysis',
    tokens_used: message.usage?.output_tokens,
    duration_ms: duration,
  });

  // Extract tool use result
  const toolUseBlock = message.content.find(
    (block): block is ToolUseBlock => block.type === 'tool_use' && block.name === mealPhotoAnalysisTool.name
  );

  if (!toolUseBlock) {
    throw new Error('No tool use block found in response');
  }

  const result = toolUseBlock.input as MealPhotoAnalysisResult;

  // Validate and sanitize the result
  if (!result.meal_name || !result.ingredients || !result.total_macros) {
    throw new Error('Invalid response structure from Claude Vision');
  }

  // Round values for cleaner display
  result.total_macros.calories = Math.round(result.total_macros.calories / 5) * 5;
  result.total_macros.protein = Math.round(result.total_macros.protein * 2) / 2;
  result.total_macros.carbs = Math.round(result.total_macros.carbs * 2) / 2;
  result.total_macros.fat = Math.round(result.total_macros.fat * 2) / 2;

  result.ingredients.forEach(ing => {
    ing.calories = Math.round(ing.calories / 5) * 5;
    ing.protein = Math.round(ing.protein * 2) / 2;
    ing.carbs = Math.round(ing.carbs * 2) / 2;
    ing.fat = Math.round(ing.fat * 2) / 2;
  });

  return result;
}
