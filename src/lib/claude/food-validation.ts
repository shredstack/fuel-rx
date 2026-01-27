import { anthropic, logLLMCall } from './client';

// ============================================
// Types
// ============================================

export interface FoodValidationResult {
  isSafe: boolean;
  isFood: boolean;
  confidence: number;
  detectedContent: string;
  category: 'food' | 'pet' | 'person' | 'receipt' | 'screenshot' | 'landscape' | 'object' | 'explicit' | 'unclear';
  rejectionMessage?: string;
}

// ============================================
// Fun Rejection Messages
// ============================================

const REJECTION_MESSAGES: Record<string, string> = {
  pet: "Adorable! But unless your pup is on the meal plan, let's snap some actual food!",
  person: "Looking great! But save the selfie for your profile—we want to see what's on your plate!",
  receipt: "Nice tracking instincts! But we need the food, not the receipt",
  screenshot: "Screenshots won't fuel your WOD! Snap the real thing",
  landscape: "Beautiful view! But your muscles need meals, not mountains",
  object: "Interesting! But that won't help hit your macros. Let's see some food!",
  explicit: "Whoa there! Let's keep FuelRx focused on nutrition, not... that.",
  unclear: "Hmm, we couldn't identify any food in this image. Try again with a clearer shot of your meal!",
  default: "We couldn't find any food here. Try snapping your actual meal!"
};

function getRejectionMessage(category: string): string {
  return REJECTION_MESSAGES[category] || REJECTION_MESSAGES.default;
}

// ============================================
// Validation Prompt (Safety-First)
// ============================================

const FOOD_VALIDATION_PROMPT = `You are a content and food validator for FuelRx, a nutrition app for CrossFit athletes.

Your task: First check if the image is SAFE, then determine if it shows FOOD.

## STEP 1: SAFETY CHECK (this takes priority)
IMMEDIATELY REJECT and set is_safe: false if the image contains:
- Nudity or sexually explicit content (even partial)
- Sexually suggestive poses or content
- Gore, violence, or disturbing imagery
- Illegal content or drug paraphernalia
- Any content inappropriate for a family-friendly nutrition app

CRITICAL: If ANY unsafe content is present, set is_safe: false AND is_food: false,
REGARDLESS of whether food is also visible in the image.
Example: An explicit image with a banana visible = is_safe: false, is_food: false, category: "explicit"

## STEP 2: FOOD CHECK (only if image is safe)
If the image passed the safety check, determine if it shows food.

ACCEPT as food (is_food: true):
- Prepared meals, home cooking, restaurant food
- Snacks, drinks, smoothies, protein shakes
- Raw ingredients (meat, vegetables, fruits)
- Packaged/branded food products
- Meal prep containers with food
- Food on plates, in bowls, on cutting boards

REJECT as non-food (is_food: false):
- Pets or animals
- People, selfies, body shots (even clothed fitness photos)
- Receipts, menus, nutrition labels (without actual food)
- Screenshots of apps, websites, or text
- Landscapes, nature, buildings
- Random objects, furniture, electronics
- Memes, drawings, or non-photographic images
- Empty plates or containers (no food visible)

## Response Format
Respond with ONLY valid JSON, no additional text or markdown:
{
  "is_safe": boolean,
  "is_food": boolean,
  "confidence": number between 0.0 and 1.0,
  "detected": "brief 2-5 word description of what you see",
  "category": "food" | "pet" | "person" | "receipt" | "screenshot" | "landscape" | "object" | "explicit" | "unclear"
}

## Examples
- Grilled chicken and vegetables → {"is_safe": true, "is_food": true, "confidence": 0.95, "detected": "grilled chicken with vegetables", "category": "food"}
- Cat sitting on counter → {"is_safe": true, "is_food": false, "confidence": 0.98, "detected": "cat on kitchen counter", "category": "pet"}
- Gym selfie in mirror → {"is_safe": true, "is_food": false, "confidence": 0.95, "detected": "person taking mirror selfie", "category": "person"}
- Explicit content with food visible → {"is_safe": false, "is_food": false, "confidence": 0.99, "detected": "inappropriate content", "category": "explicit"}
- Blurry dark image → {"is_safe": true, "is_food": false, "confidence": 0.3, "detected": "unclear dark image", "category": "unclear"}`;

// ============================================
// Main Validation Function
// ============================================

/**
 * Validate that an image is safe and contains food using Claude Haiku.
 * Fast, cheap check (~300-500ms, ~$0.0003) before expensive storage/analysis.
 *
 * Safety is checked FIRST - explicit content is always rejected even if food is present.
 *
 * @param imageBase64 - Base64 encoded image data
 * @param imageMediaType - MIME type of the image
 * @param userId - User ID for logging
 * @returns Validation result with isSafe, isFood flags and rejection message if applicable
 */
export async function validateFoodImage(
  imageBase64: string,
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  userId: string
): Promise<FoodValidationResult> {
  const startTime = Date.now();

  // Check for debug bypass
  if (process.env.SKIP_FOOD_VALIDATION === 'true') {
    console.log('[Food Validation] Debug mode: skipping validation');
    return {
      isSafe: true,
      isFood: true,
      confidence: 1.0,
      detectedContent: 'debug_bypass',
      category: 'food'
    };
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
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
              text: FOOD_VALIDATION_PROMPT,
            },
          ],
        },
      ],
    });

    const duration = Date.now() - startTime;

    // Log the validation call
    await logLLMCall({
      user_id: userId,
      prompt: '[Food image validation - image content]',
      output: JSON.stringify(message.content),
      model: 'claude-haiku-4-5-20251001',
      prompt_type: 'food_validation',
      tokens_used: message.usage?.output_tokens,
      duration_ms: duration,
    });

    // Extract text response
    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from validation');
    }

    // Parse JSON response
    const responseText = textBlock.text.trim();
    // Handle potential markdown code blocks
    const jsonText = responseText.replace(/^```json\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(jsonText);

    // Build result with safety taking priority
    const isSafe = parsed.is_safe !== false;

    const result: FoodValidationResult = {
      isSafe: isSafe,
      // Food can only be true if the image is also safe
      isFood: isSafe && parsed.is_food === true,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      detectedContent: parsed.detected || 'unknown',
      category: parsed.category || 'unclear',
    };

    // Determine rejection message based on what failed
    if (!result.isSafe) {
      // Unsafe content - override category to explicit
      result.category = 'explicit';
      result.isFood = false;
      result.rejectionMessage = getRejectionMessage('explicit');
    } else if (!result.isFood) {
      // Safe but not food
      result.rejectionMessage = getRejectionMessage(result.category);
    }

    console.log('[Food Validation] Result:', {
      isSafe: result.isSafe,
      isFood: result.isFood,
      category: result.category,
      confidence: result.confidence,
      duration: `${duration}ms`
    });

    return result;

  } catch (error) {
    console.error('[Food Validation] Error:', error);

    // On error, be conservative - reject the upload
    // This is safer than allowing potentially inappropriate content through
    return {
      isSafe: true,  // Assume safe (don't falsely accuse)
      isFood: false, // But don't allow upload
      confidence: 0,
      detectedContent: 'validation_error',
      category: 'unclear',
      rejectionMessage: "We couldn't validate this image. Please try again with a clear photo of your meal."
    };
  }
}
