import type { MessageParam, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { anthropic, logLLMCall } from './client';
import type { MealPhotoAnalysisResult } from '../types';

const MEAL_PHOTO_MODEL = 'claude-sonnet-5';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ============================================
// Meal Photo Analysis Tool Definition
// ============================================

const mealPhotoAnalysisTool: Tool = {
  name: 'analyze_meal_photo',
  description: 'Record the final structured meal analysis after you have described the photo in detail',
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

const MEAL_PHOTO_ANALYSIS_SYSTEM_PROMPT = `You are a nutrition analyst for FuelRx, an app for CrossFit athletes. Analyze meal photos to identify all foods present and estimate their nutritional content.

## How to Work
Work in two phases:

**Phase 1 — Observe (plain text).** Before calling any tool, describe the meal out loud:
1. What dish or cuisine is this? If you recognize a specific dish (e.g., "chicken burrito bowl", "Caesar salad"), name it and list the ingredients that dish typically contains, including ones partially hidden under other food.
2. Walk the plate systematically (e.g., top-left to bottom-right) and name every distinct visible item, including garnishes, sauces, dressings, and cooking fats you can infer from sheen or browning.
3. Estimate portion sizes using visual references (plate diameter, utensils, hand-sized comparisons).

**Phase 2 — Structure.** Call the analyze_meal_photo tool with the complete ingredient list from your observation. Every item you identified in Phase 1 must appear in the tool call.

## Guidelines for Identification
- Be specific with proteins (e.g., "grilled chicken breast" not just "chicken")
- List each vegetable type separately
- For mixed dishes, break down into component ingredients
- Account for cooking oils, sauces, and dressings even if not fully visible — a sauteed or grilled item implies cooking fat
- If the user provided a description of the meal, treat it as ground truth for what the meal is, and use the photo to estimate portions

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
- Estimate realistically — do not systematically over- or under-estimate
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
- Round calories to nearest 5, macros to 0.5g`;

// ============================================
// Main Analysis Function
// ============================================

/**
 * Analyze a meal photo using Claude Vision.
 *
 * Runs a two-phase analysis in one request: the model first describes the meal
 * in free text (which substantially improves ingredient recall on complex
 * plates), then records the structured result via tool call. If the model
 * stops without calling the tool, a follow-up request forces it.
 *
 * @param userContext Optional user-provided description of the meal
 *   (e.g., "beef barbacoa bowl with cauliflower rice") to ground the analysis.
 */
export async function analyzeMealPhoto(
  imageBase64: string,
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  userId: string,
  userContext?: string
): Promise<MealPhotoAnalysisResult> {
  const startTime = Date.now();

  const contextText = userContext?.trim()
    ? `\n\nThe user described this meal as: "${userContext.trim()}"`
    : '';

  const messages: MessageParam[] = [
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
          text: `Analyze this meal photo. First describe everything you can see (Phase 1), then call the analyze_meal_photo tool with the complete structured analysis (Phase 2).${contextText}`,
        },
      ],
    },
  ];

  const requestParams = {
    model: MEAL_PHOTO_MODEL,
    max_tokens: 16000,
    system: MEAL_PHOTO_ANALYSIS_SYSTEM_PROMPT,
    tools: [mealPhotoAnalysisTool],
  };

  let message = await anthropic.messages.create({
    ...requestParams,
    messages,
  });

  let totalOutputTokens = message.usage?.output_tokens ?? 0;

  let toolUseBlock = message.content.find(
    (block): block is ToolUseBlock => block.type === 'tool_use' && block.name === mealPhotoAnalysisTool.name
  );

  // Fallback: if the model described the meal but never called the tool,
  // continue the conversation and force the structured output.
  if (!toolUseBlock) {
    messages.push(
      { role: 'assistant', content: message.content },
      {
        role: 'user',
        content: 'Now call the analyze_meal_photo tool with the complete structured analysis of everything you identified.',
      }
    );

    message = await anthropic.messages.create({
      ...requestParams,
      tool_choice: { type: 'tool', name: mealPhotoAnalysisTool.name },
      messages,
    });

    totalOutputTokens += message.usage?.output_tokens ?? 0;

    toolUseBlock = message.content.find(
      (block): block is ToolUseBlock => block.type === 'tool_use' && block.name === mealPhotoAnalysisTool.name
    );
  }

  const duration = Date.now() - startTime;

  // Log the LLM call
  await logLLMCall({
    user_id: userId,
    prompt: userContext?.trim()
      ? `[Meal photo analysis - image content] User context: ${userContext.trim()}`
      : '[Meal photo analysis - image content]',
    output: JSON.stringify(message.content),
    model: MEAL_PHOTO_MODEL,
    prompt_type: 'meal_photo_analysis',
    tokens_used: totalOutputTokens,
    duration_ms: duration,
  });

  if (!toolUseBlock) {
    throw new Error('No tool use block found in response');
  }

  const result = toolUseBlock.input as MealPhotoAnalysisResult;

  // Validate and sanitize the result
  if (!result.meal_name || !result.ingredients || !result.total_macros) {
    throw new Error('Invalid response structure from Claude Vision');
  }

  // The model occasionally HTML-escapes text in tool output (e.g. "&amp;")
  result.meal_name = decodeHtmlEntities(result.meal_name);
  result.ingredients.forEach(ing => {
    ing.name = decodeHtmlEntities(ing.name);
  });

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
