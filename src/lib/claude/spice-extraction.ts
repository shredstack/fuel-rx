/**
 * Spice Extraction Module
 *
 * Extracts spices and seasonings from meal instructions so they can be
 * displayed on grocery lists. Uses Claude Haiku for fast, cheap extraction.
 */

import { callLLMWithToolUse } from './client';
import { spiceExtractionSchema } from '../llm-schemas';
import type { ExtractedSpice } from '../types';

/**
 * Extract spices and seasonings from meal instructions.
 * Returns a deduplicated list of spices mentioned in the instructions.
 */
export async function extractSpicesFromInstructions(
  instructions: string[],
  userId: string
): Promise<ExtractedSpice[]> {
  // Skip if no instructions provided
  if (!instructions || instructions.length === 0) {
    return [];
  }

  // Combine all instructions into one text block
  const instructionsText = instructions.join('\n');

  const prompt = `You are a culinary assistant extracting spices and seasonings from recipe instructions.

## Instructions to Analyze
${instructionsText}

## Task
Extract all spices, seasonings, and dried herbs mentioned in these recipe instructions.

## Guidelines
1. **Include**: Spices (cumin, paprika, cayenne, etc.), dried herbs (oregano, thyme, basil, etc.), seasoning blends (Italian seasoning, taco seasoning, etc.), specialty seasonings (za'atar, garam masala, etc.)

2. **Exclude**:
   - Fresh ingredients (fresh garlic, fresh ginger, fresh herbs like cilantro or parsley)
   - Basic staples that everyone has (salt, black pepper, cooking oil, olive oil, butter)
   - Sauces and condiments (soy sauce, hot sauce, mustard, etc.)
   - Sweeteners (honey, maple syrup, sugar)

3. **Normalize names**: Use common grocery store naming
   - "cumin" not "ground cumin" (assume ground unless specified)
   - "paprika" not "sweet paprika" (use the most common form)
   - "chili powder" not "chile powder"

4. **Deduplicate**: Each spice should appear only once

5. **Capitalize properly**: "Cumin" not "cumin", "Smoked Paprika" not "smoked paprika"

## Response
Use the extract_spices tool to provide the list of spices found.`;

  try {
    const { result: parsed } = await callLLMWithToolUse<{ spices: ExtractedSpice[] }>({
      prompt,
      tool: spiceExtractionSchema,
      model: 'claude-3-5-haiku-20241022', // Fast and cheap for simple extraction
      maxTokens: 2000,
      userId,
      promptType: 'spice_extraction',
    });

    return parsed.spices || [];
  } catch (error) {
    console.error('Error extracting spices:', error);
    // Return empty array on error - spices are non-critical
    return [];
  }
}
