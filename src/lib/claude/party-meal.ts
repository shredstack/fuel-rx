import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { callLLMWithToolUse } from './client';
import type {
  UserProfile,
  MealPlanTheme,
  ThemeIngredientGuidance,
  PartyType,
  PartyPrepGuide,
  PARTY_TYPE_LABELS,
} from '../types';

// ============================================
// Party Prep Guide Generation
// ============================================

export interface PartyMealGenerationParams {
  profile: UserProfile;
  guestCount: number;
  partyType: PartyType;
  theme?: MealPlanTheme | null;
  customInstructions?: string;
  dietaryConsiderations?: string[];
}

const partyPrepTool: Tool = {
  name: 'generate_party_prep',
  description: 'Generate a party prep guide with timeline and shopping list',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const },
      description: { type: 'string' as const },
      serves: { type: 'number' as const },
      dishes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            role: { type: 'string' as const, enum: ['main', 'side', 'appetizer', 'dessert', 'beverage'] },
            description: { type: 'string' as const },
          },
          required: ['name', 'role', 'description'],
        },
      },
      timeline: {
        type: 'object' as const,
        properties: {
          days_before: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              tasks: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    title: { type: 'string' as const },
                    steps: { type: 'array' as const, items: { type: 'string' as const } },
                    duration: { type: 'string' as const },
                    notes: { type: 'string' as const },
                  },
                  required: ['title', 'steps'],
                },
              },
            },
            required: ['title', 'tasks'],
          },
          day_of_morning: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              tasks: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    title: { type: 'string' as const },
                    steps: { type: 'array' as const, items: { type: 'string' as const } },
                    duration: { type: 'string' as const },
                    notes: { type: 'string' as const },
                  },
                  required: ['title', 'steps'],
                },
              },
            },
            required: ['title', 'tasks'],
          },
          hours_before: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              tasks: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    title: { type: 'string' as const },
                    steps: { type: 'array' as const, items: { type: 'string' as const } },
                    duration: { type: 'string' as const },
                    notes: { type: 'string' as const },
                  },
                  required: ['title', 'steps'],
                },
              },
            },
            required: ['title', 'tasks'],
          },
          right_before: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              tasks: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    title: { type: 'string' as const },
                    steps: { type: 'array' as const, items: { type: 'string' as const } },
                    duration: { type: 'string' as const },
                    notes: { type: 'string' as const },
                  },
                  required: ['title', 'steps'],
                },
              },
            },
            required: ['title', 'tasks'],
          },
        },
      },
      shopping_list: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            item: { type: 'string' as const },
            quantity: { type: 'string' as const },
            notes: { type: 'string' as const },
          },
          required: ['item', 'quantity'],
        },
      },
      pro_tips: { type: 'array' as const, items: { type: 'string' as const } },
      estimated_total_prep_time: { type: 'string' as const },
      estimated_active_time: { type: 'string' as const },
    },
    required: ['name', 'description', 'serves', 'dishes', 'timeline', 'shopping_list', 'pro_tips', 'estimated_total_prep_time', 'estimated_active_time'],
  },
};

const PARTY_TYPE_DESCRIPTIONS: Record<PartyType, string> = {
  casual_gathering: 'Relaxed get-together with friends or family - easy finger foods and shareables',
  dinner_party: 'Elevated dining experience - impressive main course with complementary sides',
  game_day: 'Sports viewing party - hearty finger foods, dips, and easy-to-eat shareables',
  holiday: 'Special occasion celebration - festive dishes with traditional touches',
  potluck_contribution: 'Single impressive dish - make something memorable that travels well',
};

function buildPartyMealPrompt(params: PartyMealGenerationParams): string {
  const { profile, guestCount, partyType, theme, customInstructions, dietaryConsiderations } = params;

  const partyDescription = PARTY_TYPE_DESCRIPTIONS[partyType];

  let prompt = `You are a party planning assistant for FuelRx, an app for CrossFit athletes.

Generate a comprehensive party prep guide for a ${partyType.replace(/_/g, ' ')}.

## Party Details
- Guest count: ${guestCount} people
- Party type: ${partyType.replace(/_/g, ' ')} - ${partyDescription}
- Dietary considerations: ${dietaryConsiderations?.length ? dietaryConsiderations.join(', ') : 'None specified'}

## Host Profile
- Not very experienced home cook
- Values efficiency
- Prefers healthy, protein-rich options when possible
- Wants impressive results without excessive complexity
- Athletic household that appreciates quality whole foods
`;

  if (theme) {
    const guidance = theme.ingredient_guidance as ThemeIngredientGuidance;
    prompt += `
## Theme: ${theme.display_name}
${theme.description}

Flavor profile: ${guidance?.flavor_profile || 'Not specified'}
Suggested proteins: ${guidance?.proteins?.join(', ') || 'Any'}
Suggested vegetables: ${guidance?.vegetables?.join(', ') || 'Any'}
Cooking style: ${theme.cooking_style_guidance || 'Any style'}
`;
  }

  if (customInstructions) {
    prompt += `
## Special Request from User
${customInstructions}
`;
  }

  // Adjust dish count based on party type
  let dishGuidance = '';
  if (partyType === 'potluck_contribution') {
    dishGuidance = 'Create ONE impressive dish that travels well and serves the guest count.';
  } else if (partyType === 'casual_gathering' || partyType === 'game_day') {
    dishGuidance = 'Create 2-3 shareable dishes (appetizers, dips, finger foods) that are easy to grab.';
  } else {
    dishGuidance = 'Create a cohesive menu with a main course and 1-2 complementary sides.';
  }

  prompt += `
## Requirements
1. ${dishGuidance}
2. Scale ALL quantities for ${guestCount} guests
3. Organize prep into timeline phases:
   - 1-2 Days Before: Make-ahead components (marinades, sauces, anything that stores well)
   - Day Of Morning: Early prep tasks (chopping, assembling cold items)
   - 1-2 Hours Before: Final cooking and assembly
   - Right Before Serving: Last touches, plating, warming
4. Include a complete shopping list with practical quantities for ${guestCount} people
5. Provide 3-5 pro tips for success
6. Keep it achievable for a home cook - no professional equipment required
7. Focus on crowd-pleasers that happen to be relatively healthy
8. Include storage instructions where relevant

The output should look like a professional party prep guide that a busy athlete can follow step-by-step.

Use the generate_party_prep tool to provide your party plan.`;

  return prompt;
}

export async function generatePartyPrepGuide(
  params: PartyMealGenerationParams
): Promise<PartyPrepGuide> {
  const prompt = buildPartyMealPrompt(params);

  const { result } = await callLLMWithToolUse<PartyPrepGuide>({
    prompt,
    tool: partyPrepTool,
    maxTokens: 8000, // Party plans need more tokens for detailed timelines
    userId: params.profile.id,
    promptType: 'quick_cook_party_prep',
  });

  return result;
}
