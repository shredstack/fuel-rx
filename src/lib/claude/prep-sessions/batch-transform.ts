/**
 * Batch Prep Transformation
 *
 * Transforms day-of fresh cooking prep sessions into optimized batch prep format.
 * This runs as an async job after the main meal plan is generated.
 */

import type {
  PrepModeResponse,
  DayPlan,
  CoreIngredients,
  UserProfile,
  DayOfWeek,
  MealType,
  PrepSessionType,
  DailyAssembly,
} from '../../types';
import { callLLMWithToolUse } from '../client';
import { prepSessionsSchema } from '../../llm-schemas';

// Extended prep task as returned by LLM (matches new PrepTask interface)
interface LLMPrepTask {
  id: string;
  description: string;
  detailed_steps: string[];
  cooking_temps?: {
    oven?: string;
    stovetop?: string;
    internal_temp?: string;
    grill?: string;
  };
  cooking_times?: {
    prep_time?: string;
    cook_time?: string;
    rest_time?: string;
    total_time?: string;
  };
  tips?: string[];
  storage?: string;
  estimated_minutes: number;
  meal_ids: string[];
  completed: boolean;
  equipment_needed?: string[];
  ingredients_to_prep?: string[];
  prep_category?: 'sunday_batch' | 'day_of_quick' | 'day_of_cooking';
}

interface LLMPrepSessionsResponse {
  prep_sessions: Array<{
    session_name: string;
    session_type: PrepSessionType;
    session_day: DayOfWeek | null;
    session_time_of_day: 'morning' | 'afternoon' | 'night' | null;
    prep_for_date: string | null;
    estimated_minutes: number;
    prep_tasks: LLMPrepTask[];
    display_order: number;
  }>;
  daily_assembly?: DailyAssembly;
}

/**
 * Transform day-of prep sessions into batch prep format.
 *
 * Takes the detailed day-of cooking instructions and optimizes them
 * for Sunday batch prep + weekday assembly.
 */
export async function transformToBatchPrep(
  dayOfPrepSessions: PrepModeResponse,
  days: DayPlan[],
  coreIngredients: CoreIngredients,
  profile: UserProfile,
  userId: string,
  weekStartDate?: string,
  jobId?: string
): Promise<PrepModeResponse> {
  const prompt = buildBatchTransformPrompt(
    dayOfPrepSessions,
    days,
    coreIngredients,
    profile,
    weekStartDate
  );

  const { result: rawResult } = await callLLMWithToolUse<LLMPrepSessionsResponse>({
    prompt,
    tool: prepSessionsSchema,
    maxTokens: 64000,
    userId,
    promptType: 'batch_prep_transform',
    jobId,
  });

  // Transform the snake_case LLM response to camelCase PrepModeResponse
  return transformLLMResponseToPrepModeResponse(rawResult);
}

/**
 * Build the prompt for transforming day-of prep to batch prep
 */
function buildBatchTransformPrompt(
  dayOfPrepSessions: PrepModeResponse,
  days: DayPlan[],
  coreIngredients: CoreIngredients,
  profile: UserProfile,
  weekStartDate?: string
): string {
  // Build meal summary for context
  const mealSummary = buildMealSummaryForTransform(days);

  // Calculate week dates
  const dayDates = calculateWeekDates(weekStartDate);

  // Serialize day-of prep sessions
  const dayOfJson = JSON.stringify(dayOfPrepSessions, null, 2);

  return `You are transforming a day-of fresh cooking meal prep plan into an optimized BATCH PREP plan for a busy CrossFit athlete.

## YOUR TASK
You have been given detailed day-of cooking instructions for every meal. Your job is to:
1. Identify what can be batch prepped on Sunday without quality loss
2. Create a Sunday batch prep session
3. Create daily assembly instructions for weekday meals
4. Keep certain items as day-of cooking when freshness matters

## THE MEAL PLAN
${mealSummary}

## CORE INGREDIENTS AVAILABLE
${JSON.stringify(coreIngredients, null, 2)}

## WEEK DATES
${JSON.stringify(dayDates, null, 2)}

## DAY-OF PREP INSTRUCTIONS (YOUR INPUT)
These are the detailed cooking instructions if everything were cooked fresh:

${dayOfJson}

## BATCH PREP DECISION RULES

### BATCH THESE (Sunday prep):
- Grains: rice, quinoa, pasta, oatmeal bases
- Proteins: chicken breast, ground beef/turkey, pulled pork, hard-boiled eggs
- Roasted vegetables: broccoli, sweet potatoes, bell peppers, zucchini, asparagus
- Sauces and dressings
- Overnight oats (up to 5 days)
- Soups and stews
- Marinades and seasoned proteins (prep Sunday, cook day-of if needed)

### KEEP FRESH (day-of cooking):
- Fish and seafood (batch for day 1-2 ONLY, day-of for days 3+)
- Eggs (scrambled, fried, poached - batch hard-boiled only)
- Salad greens (prep but don't dress)
- Avocado (cut day-of)
- Any meal on Day 5+ that contains fish
- Crispy items (will get soggy - fried foods, crispy coatings)
- Fresh herbs as garnish (add day-of)

### PARTIAL BATCH:
- Stir-fries: prep vegetables, batch cook protein, but stir-fry fresh
- Salads with cooked protein: batch the protein, assemble fresh
- Tacos/bowls: batch fillings, assemble fresh
- Grain bowls: batch grains and protein, fresh toppings day-of

## OUTPUT STRUCTURE

Create a response with:

1. **Sunday Batch Session** (session_type: "weekly_batch", session_day: "sunday")
   - All items that should be prepped ahead
   - Scaled quantities for the week (combine same ingredients across meals)
   - Storage instructions for each item
   - Which meals each prep item feeds (meal_ids array)

2. **Day-of Sessions** (session_type: "day_of_morning" or "day_of_dinner")
   - ONLY for meals that must be cooked fresh (fish on day 3+, eggs, etc.)
   - These should be minimal if batch prep is done well
   - Include any quick cooking needed for partially batched meals

3. **Daily Assembly** (daily_assembly object - REQUIRED)
   - For EVERY meal that uses batched ingredients
   - Quick instructions: "Reheat rice in microwave 90 sec, top with pulled pork from container, add fresh cilantro and lime"
   - Specific reheating instructions: "350°F oven for 10 min" or "microwave 90 seconds, stir, 30 more seconds"
   - Time estimates (most should be 5-10 min)

## QUALITY REQUIREMENTS

1. PRESERVE the detailed cooking instructions from the day-of plan - use them as your source
2. When batching, COMBINE quantities for multiple servings (e.g., 3 cups rice for Mon-Wed meals)
3. Every meal_id from the original plan must appear somewhere (batch task meal_ids, day-of task, or daily_assembly)
4. Storage instructions are REQUIRED for all batch items:
   - "Refrigerate in airtight container for up to 5 days"
   - "Store in glass containers, label with date"
   - "Divide into 4 individual containers for grab-and-go"
5. Daily assembly must be SPECIFIC:
   - "Microwave rice 90 seconds" NOT just "reheat rice"
   - "Remove chicken from fridge 10 min before to take off chill" NOT just "serve chicken"
6. Use prep_category field:
   - "sunday_batch" for items prepped on Sunday
   - "day_of_quick" for items needing <10min fresh prep
   - "day_of_cooking" for items needing full day-of cooking

## HOUSEHOLD CONTEXT
${profile.household_servings ? 'User has household members - the UI handles serving multipliers. Write quantities for 1 athlete serving.' : 'Single athlete - write quantities for 1 serving.'}

## EXAMPLE BATCH TASK

{
  "id": "batch_proteins",
  "description": "Sunday Batch: Cook All Proteins for the Week",
  "equipment_needed": ["Large baking sheet", "Parchment paper", "Meat thermometer", "Airtight containers for storage"],
  "ingredients_to_prep": ["2 lbs chicken breast", "1.5 lbs ground turkey", "Olive oil", "Salt, pepper, garlic powder"],
  "detailed_steps": [
    "Preheat oven to 400°F",
    "Pound chicken breasts to even thickness (about 3/4 inch)",
    "Season chicken with olive oil, salt, pepper, and garlic powder",
    "Arrange on baking sheet lined with parchment, leaving space between pieces",
    "Bake 22-25 minutes until internal temp reaches 165°F",
    "Let rest 5 minutes before slicing or storing whole",
    "While chicken bakes, brown ground turkey in large skillet over medium-high heat, 8-10 minutes",
    "Season turkey with salt, pepper, and any weekly spices",
    "Let both proteins cool to room temperature (max 2 hours)",
    "Divide into labeled containers: 'Mon Lunch', 'Tue Dinner', etc."
  ],
  "cooking_temps": {
    "oven": "400°F",
    "internal_temp": "165°F for chicken",
    "stovetop": "medium-high heat for turkey"
  },
  "cooking_times": {
    "prep_time": "15 min",
    "cook_time": "25 min",
    "rest_time": "5 min",
    "total_time": "45 min"
  },
  "tips": [
    "Don't skip resting time - keeps chicken juicy",
    "Ground turkey can be frozen in portions if not using within 4 days"
  ],
  "storage": "Refrigerate in airtight containers up to 4 days. Slice chicken before storing for faster reheating.",
  "estimated_minutes": 45,
  "meal_ids": ["meal_monday_lunch_0", "meal_tuesday_dinner_0", "meal_wednesday_lunch_0", "meal_thursday_dinner_0"],
  "completed": false,
  "prep_category": "sunday_batch"
}

Now transform the day-of plan into an optimized batch prep plan.

Use the generate_prep_sessions tool to provide your batch prep schedule.`;
}

/**
 * Build meal summary for the transformation prompt
 */
function buildMealSummaryForTransform(days: DayPlan[]): string {
  return days.map(day => {
    const meals = day.meals.map(m => {
      const mealTypeCounts: Record<string, number> = {};
      const typeIndex = mealTypeCounts[m.type] || 0;
      mealTypeCounts[m.type] = typeIndex + 1;
      return `  - ${m.type} (ID: meal_${day.day}_${m.type}_${typeIndex}): ${m.name} (${m.prep_time_minutes}min, ${m.macros.protein}g protein)`;
    }).join('\n');
    return `${day.day.charAt(0).toUpperCase() + day.day.slice(1)}:\n${meals}`;
  }).join('\n\n');
}

/**
 * Calculate week dates from start date
 */
function calculateWeekDates(weekStartDate?: string): Record<DayOfWeek, string> {
  const weekStart = weekStartDate ? new Date(weekStartDate) : new Date();
  return {
    monday: new Date(weekStart).toISOString().split('T')[0],
    tuesday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 1)).toISOString().split('T')[0],
    wednesday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 2)).toISOString().split('T')[0],
    thursday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 3)).toISOString().split('T')[0],
    friday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toISOString().split('T')[0],
    saturday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 5)).toISOString().split('T')[0],
    sunday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 6)).toISOString().split('T')[0],
  };
}

/**
 * Transform LLM response (snake_case) to PrepModeResponse format (camelCase)
 */
function transformLLMResponseToPrepModeResponse(parsed: LLMPrepSessionsResponse): PrepModeResponse {
  const prepModeResponse: PrepModeResponse = {
    prepSessions: parsed.prep_sessions.map(session => ({
      sessionName: session.session_name,
      sessionOrder: session.display_order,
      estimatedMinutes: session.estimated_minutes,
      instructions: `${session.session_type} session${session.session_day ? ` on ${session.session_day}` : ''}`,
      prepItems: session.prep_tasks.map(task => ({
        item: task.description,
        quantity: '',
        method: task.detailed_steps?.join(' → ') || '',
        storage: task.storage || '',
        feeds: task.meal_ids.map(mealId => {
          const parts = mealId.split('_');
          if (parts.length >= 3) {
            return {
              day: parts[1] as DayOfWeek,
              meal: parts[2] as MealType,
            };
          }
          return { day: 'monday' as DayOfWeek, meal: 'dinner' as MealType };
        }),
      })),
      sessionType: session.session_type,
      sessionDay: session.session_day,
      sessionTimeOfDay: session.session_time_of_day,
      prepForDate: session.prep_for_date,
      prepTasks: session.prep_tasks.map(task => ({
        ...task,
        detailed_steps: task.detailed_steps || [],
        cooking_temps: task.cooking_temps || undefined,
        cooking_times: task.cooking_times || undefined,
        tips: task.tips || [],
        storage: task.storage || undefined,
        equipment_needed: task.equipment_needed || undefined,
        ingredients_to_prep: task.ingredients_to_prep || undefined,
        prep_category: task.prep_category || undefined,
      })),
      displayOrder: session.display_order,
    })),
    dailyAssembly: parsed.daily_assembly || {},
  };

  return prepModeResponse;
}
