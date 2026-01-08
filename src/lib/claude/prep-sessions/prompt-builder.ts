import type {
  DayPlan,
  CoreIngredients,
  UserProfile,
  DayOfWeek,
  PrepStyle,
  MealComplexity,
  HouseholdServingsPrefs,
} from '../../types';
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABELS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '../../types';
import { buildBatchPrepPromptSection } from './batch-prep-rules';
import { buildDayOfPromptSection } from './day-of-rules';
import { hasHouseholdMembers, getServingMultiplier } from '../helpers';

/**
 * Builds the complete prep sessions prompt based on user's prep style
 */
export function buildPrepSessionsPrompt(
  days: DayPlan[],
  coreIngredients: CoreIngredients,
  profile: UserProfile,
  weekStartDate?: string
): string {
  const prepStyle = profile.prep_style || 'day_of';

  // Build meal IDs for reference
  const mealIds: Record<string, string> = {};
  days.forEach((day) => {
    day.meals.forEach((meal, mealIndex) => {
      const id = `meal_${day.day}_${meal.type}_${mealIndex}`;
      mealIds[`${day.day}_${meal.type}_${mealIndex}`] = id;
    });
  });

  // Build a detailed summary of the meal plan with IDs AND instructions
  const mealSummary = buildMealSummary(days);

  // Get meal complexities
  const breakfastComplexity = (profile.breakfast_complexity || 'minimal_prep') as MealComplexity;
  const lunchComplexity = (profile.lunch_complexity || 'minimal_prep') as MealComplexity;
  const dinnerComplexity = (profile.dinner_complexity || 'full_recipe') as MealComplexity;

  // Calculate week dates for prep_for_date
  const dayDates = calculateWeekDates(weekStartDate);

  // Get prep style specific instructions
  const prepStyleInstructions = prepStyle === 'traditional_batch'
    ? buildBatchPrepPromptSection()
    : buildDayOfPromptSection(breakfastComplexity, lunchComplexity, dinnerComplexity);

  // Build household context for prep instructions
  const householdServings = profile.household_servings ?? DEFAULT_HOUSEHOLD_SERVINGS_PREFS;
  const householdPrepSection = buildHouseholdPrepSection(householdServings);

  // Build the complete prompt
  return `You are creating a DETAILED prep schedule for a CrossFit athlete's weekly meal plan. The user needs ACTIONABLE cooking instructions, not just meal descriptions.

## MEAL PLAN WITH FULL DETAILS
${mealSummary}

## CORE INGREDIENTS
${JSON.stringify(coreIngredients, null, 2)}

## WEEK DATES
${JSON.stringify(dayDates, null, 2)}
${householdPrepSection}
${prepStyleInstructions}

${buildCriticalRulesSection()}

${buildPrepTaskStructureSection()}

${buildResponseFormatSection(dayDates)}

${buildConsolidationRulesSection()}

${buildImportantRulesSection()}

Use the generate_prep_sessions tool to provide your prep schedule.`;
}

/**
 * Build the meal summary section of the prompt
 */
function buildMealSummary(days: DayPlan[]): string {
  return days.map(day => {
    const mealsList = day.meals.map((m, idx) => {
      const mealId = `meal_${day.day}_${m.type}_${idx}`;
      const ingredientsList = m.ingredients.map(ing => `${ing.amount} ${ing.unit} ${ing.name}`).join(', ');
      const instructionsList = m.instructions.length > 0
        ? `\n      Instructions: ${m.instructions.map((inst, i) => `${i + 1}. ${inst}`).join(' ')}`
        : '';
      return `  - ${m.type} (ID: ${mealId}): ${m.name}
      Prep time: ${m.prep_time_minutes}min | Protein: ${m.macros.protein}g
      Ingredients: ${ingredientsList}${instructionsList}`;
    }).join('\n');
    return `${day.day.charAt(0).toUpperCase() + day.day.slice(1)}:\n${mealsList}`;
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
 * Build household prep section
 */
function buildHouseholdPrepSection(householdServings: HouseholdServingsPrefs): string {
  const householdHasMembers = hasHouseholdMembers(householdServings);

  if (!householdHasMembers) {
    return '';
  }

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  const servingLines: string[] = [];

  for (const day of DAYS_OF_WEEK) {
    const dayParts: string[] = [];
    for (const meal of mealTypes) {
      const multiplier = getServingMultiplier(householdServings, day, meal);
      if (multiplier > 1) {
        dayParts.push(`${meal}: ${multiplier.toFixed(1)}x`);
      }
    }
    if (dayParts.length > 0) {
      servingLines.push(`- ${DAY_OF_WEEK_LABELS[day]}: ${dayParts.join(', ')}`);
    }
  }

  return `
## HOUSEHOLD SERVINGS NOTE
The athlete has household members configured, but household sizes vary by day/meal.
The app UI will show scaling instructions. Your job is to write clear SINGLE-SERVING (1 portion) instructions only.
Do NOT scale quantities for household - just write for 1 serving.
`;
}

/**
 * Build critical rules section
 */
function buildCriticalRulesSection(): string {
  return `## CRITICAL RULES

### RULE 1: ONE TASK PER MEAL (NOT PER INGREDIENT)
Each prep_task should represent ONE COMPLETE MEAL, not individual ingredients.
- WRONG: Separate tasks for "Roast sweet potato" and "Roast asparagus" for the same dinner
- RIGHT: One task "Monday Dinner: Salmon with Roasted Vegetables" that includes ALL steps for that meal

### RULE 2: INCLUDE EVERY SINGLE MEAL
Create a prep task for EVERY meal in the meal plan, even simple ones:
- Even "Greek yogurt with berries" needs a task: "Scoop yogurt into bowl, top with berries"
- Even "Avocado toast" needs a task: "Toast bread, mash avocado, spread on toast, season with salt"
- NO MEAL should be skipped. If someone asks "what do I do for Tuesday lunch?" there must be a task for it.

### RULE 3: ACTIONABLE STEP-BY-STEP INSTRUCTIONS
Your detailed_steps must be ACTUALLY HELPFUL with real cooking guidance.

BAD (useless - just restates the meal):
- "Prepare overnight oats with Greek yogurt and berries"

GOOD (actionable with real details):
- detailed_steps: [
    "Combine 1/2 cup rolled oats, 1/2 cup Greek yogurt, and 1/2 cup milk in a jar",
    "Stir in 1 tbsp chia seeds and 1 tsp honey",
    "Refrigerate overnight (at least 6 hours)",
    "Top with fresh berries before serving"
  ]`;
}

/**
 * Build prep task structure section
 */
function buildPrepTaskStructureSection(): string {
  return `## PREP TASK STRUCTURE

Each prep_task represents ONE MEAL and MUST include:
1. "id": Unique identifier (e.g., "meal_monday_breakfast")
2. "description": The meal name (e.g., "Monday Breakfast: Overnight Oats with Berries")
3. "equipment_needed": Array of ALL cookware and tools needed (THIS IS REQUIRED - see examples below)
4. "ingredients_to_prep": Array of ingredients to gather/prep before starting (THIS IS REQUIRED)
5. "detailed_steps": Array of ALL steps to prepare this meal (THIS IS REQUIRED - never leave empty)
6. "cooking_temps": Object with temperature info (if applicable):
   - "oven": e.g., "400°F" or "200°C"
   - "stovetop": e.g., "medium-high heat"
   - "internal_temp": e.g., "145°F for salmon", "165°F for chicken"
   - "grill": e.g., "medium-high, 400-450°F"
7. "cooking_times": Object with timing info:
   - "prep_time": e.g., "5 min"
   - "cook_time": e.g., "15-20 min"
   - "rest_time": e.g., "5 min" (if applicable)
   - "total_time": e.g., "25 min"
8. "tips": Array of helpful pro tips (optional but encouraged)
9. "storage": Storage instructions (REQUIRED for batch prep and night-before styles, optional for day-of)
   - e.g., "Refrigerate in airtight container for up to 5 days"
   - e.g., "Store in glass meal prep containers, keeps 4-5 days refrigerated"
   - e.g., "Portion into individual containers for grab-and-go"
10. "estimated_minutes": Total time in minutes
11. "meal_ids": Array with the single meal_id this task is for
12. "completed": false
13. "prep_category": Category for batch prep users (REQUIRED for traditional_batch prep style):
   - "sunday_batch": Can be prepped ahead on Sunday, stores well
   - "day_of_quick": Must be made day-of, but takes <10 minutes
   - "day_of_cooking": Must be made day-of, requires more cooking time

## CRITICAL: EQUIPMENT_NEEDED EXAMPLES

**For "Asian-Style Ground Turkey with Jasmine Rice and Vegetables":**
equipment_needed: ["Large skillet or wok (for turkey and vegetables)", "Medium pot with lid (for rice)", "Cutting board", "Chef's knife", "Wooden spoon or spatula", "Measuring spoons"]

**For "Baked Salmon with Roasted Vegetables":**
equipment_needed: ["Large baking sheet (for salmon)", "Separate baking sheet (for vegetables)", "Parchment paper or foil", "Tongs or spatula", "Small bowl (for seasoning mix)"]

**For "Overnight Oats":**
equipment_needed: ["Mason jar or airtight container", "Spoon for mixing"]

## CRITICAL: INGREDIENTS_TO_PREP EXAMPLES

**For "Asian-Style Ground Turkey with Jasmine Rice and Vegetables":**
ingredients_to_prep: ["1.5 lbs ground turkey", "2 cups jasmine rice", "1 onion, diced", "8 oz mushrooms, sliced", "2 cups red cabbage, shredded", "1.5 tbsp coconut oil", "Garlic powder, salt, pepper, ginger"]

This helps users gather everything BEFORE they start cooking.

## CRITICAL: DETAILED_STEPS WITH VESSEL CLARITY

Your detailed_steps MUST specify which cookware is being used at each step:

**BAD (unclear which vessel):**
- "Add ground turkey, cook 5-6 minutes until browned"
- "Add mushrooms and cook 3-4 minutes"

**GOOD (clear vessel instructions):**
- "In the large skillet, add 1.5 lbs ground turkey, breaking apart with spoon. Cook 5-6 minutes until browned and no pink remains."
- "To the same skillet with the turkey, add 8 oz sliced mushrooms. Cook 3-4 minutes until tender."
- "Meanwhile, in the medium pot, bring 2 cups water to a boil. Add rice, reduce to low, cover and simmer 15 minutes."

**GOOD (using multiple vessels simultaneously):**
- "While the chicken is baking (check step 2), heat 1 tbsp olive oil in a large skillet over medium heat."
- "In a separate small pot, bring 4 cups water to a boil for the quinoa."

**Key patterns to use:**
- "In the [specific cookware]..."
- "To the same [cookware]..." (when adding to existing pan)
- "In a separate [cookware]..." (when using different vessel)
- "While X is cooking in [cookware A], prepare Y in [cookware B]..."
- "Meanwhile, in [cookware]..." (for parallel tasks)`;
}

/**
 * Build response format section
 */
function buildResponseFormatSection(dayDates: Record<DayOfWeek, string>): string {
  return `## RESPONSE FORMAT
Return ONLY valid JSON:
{
  "prep_sessions": [
    {
      "session_name": "Monday Morning Prep",
      "session_type": "day_of_morning",
      "session_day": "monday",
      "session_time_of_day": "morning",
      "prep_for_date": "${dayDates.monday}",
      "estimated_minutes": 20,
      "prep_tasks": [
        {
          "id": "meal_monday_breakfast",
          "description": "Monday Breakfast: Overnight Oats with Berries",
          "equipment_needed": [
            "Mason jar or airtight container",
            "Spoon for mixing"
          ],
          "ingredients_to_prep": [
            "1/2 cup rolled oats",
            "1/2 cup Greek yogurt",
            "1/2 cup milk",
            "1 tbsp chia seeds",
            "1 tsp honey",
            "1/4 cup fresh mixed berries"
          ],
          "detailed_steps": [
            "In the mason jar, combine 1/2 cup rolled oats, 1/2 cup Greek yogurt, and 1/2 cup milk",
            "Add 1 tbsp chia seeds and 1 tsp honey, stir well to combine",
            "Cover and refrigerate overnight (minimum 6 hours)",
            "Before serving, top with 1/4 cup fresh mixed berries"
          ],
          "cooking_times": {
            "prep_time": "5 min",
            "rest_time": "6+ hours (overnight)",
            "total_time": "5 min active"
          },
          "tips": [
            "Prep multiple jars at once for the week",
            "Add berries just before eating to keep them fresh"
          ],
          "storage": "Refrigerate in mason jars for up to 5 days",
          "estimated_minutes": 5,
          "meal_ids": ["meal_monday_breakfast_0"],
          "completed": false
        }
      ],
      "display_order": 1
    }
  ],
  "daily_assembly": {
    "monday": {
      "breakfast": { "time": "5 min", "instructions": "Remove overnight oats from fridge, top with fresh berries and enjoy cold" },
      "lunch": { "time": "5 min", "instructions": "Combine prepped salad components, add dressing, toss and serve" },
      "dinner": { "time": "0 min", "instructions": "Serve fresh from cooking" }
    }
  }
}`;
}

/**
 * Build consolidation rules section
 */
function buildConsolidationRulesSection(): string {
  return `## MEAL CONSOLIDATION RULES
When the SAME EXACT meal appears on multiple days, consolidate into a SINGLE prep task:

**Example - Identical Breakfast across days:**
If "Overnight Oats with Berries" appears on Monday, Tuesday, AND Wednesday breakfast:

Instead of 3 separate tasks, create ONE consolidated task:
{
  "id": "meal_breakfast_overnight_oats_mon_wed",
  "description": "Overnight Oats with Berries (Mon-Wed, 3 servings)",
  "detailed_steps": [
    "In a large bowl, combine 1.5 cups rolled oats, 1.5 cups Greek yogurt, and 1.5 cups milk (3x recipe)",
    "Stir in 3 tbsp chia seeds and 3 tsp honey",
    "Divide evenly into 3 mason jars or containers",
    "Refrigerate overnight (minimum 6 hours)",
    "Each morning, top one serving with 1/4 cup fresh berries before eating"
  ],
  "estimated_minutes": 10,
  "meal_ids": ["meal_monday_breakfast_0", "meal_tuesday_breakfast_0", "meal_wednesday_breakfast_0"],
  "storage": "Refrigerate in individual jars for up to 5 days. Add fresh toppings just before serving.",
  "tips": ["Batch prep all 3 at once to save time", "Keep berries separate until serving for best texture"],
  "completed": false
}

**Consolidation rules:**
- ALWAYS consolidate when the same meal name appears across 2+ days for the same meal type
- Multiply ingredient quantities by the number of servings
- Include ALL meal_ids that this task covers in the meal_ids array
- Update description to show day range and total servings: "Meal Name (Mon-Wed, 3 servings)"
- Adjust detailed_steps to describe making the full batch quantity
- This creates shorter, cleaner prep instructions and better batch prep UX

**When NOT to consolidate:**
- Different meals even if similar (e.g., "Grilled Chicken Salad" vs "Greek Chicken Salad")
- Same meal but different meal types (breakfast vs snack)

**Multiple snacks per day:**
Users may have multiple snacks per day. Use meal_ids with indices:
- "meal_monday_snack_0" for first snack
- "meal_monday_snack_1" for second snack
Consolidate Snack 1 across days separately from Snack 2.`;
}

/**
 * Build important rules section
 */
function buildImportantRulesSection(): string {
  return `## IMPORTANT RULES
1. Every meal_id in prep_tasks MUST match the format "meal_[day]_[type]_[index]" from the meal plan above
2. Order sessions by display_order chronologically through the week
3. ONE TASK PER MEAL - combine all components of a meal into a single task (or ONE TASK PER CONSOLIDATED MEAL GROUP)
4. EVERY MEAL must have a prep task - even simple assembly meals like "yogurt with fruit"
5. detailed_steps is REQUIRED for every task - never leave it empty or with generic descriptions
6. Include cooking_temps and cooking_times whenever heat/cooking is involved
7. Base your detailed_steps on the actual meal instructions provided above
8. STORAGE: Include storage instructions for any meal that is prepped in advance (required for traditional_batch style)
9. DAILY ASSEMBLY (REQUIRED for traditional_batch style only):
   - For batch prep style, include a "daily_assembly" object in your response
   - This tells the user how to assemble/reheat prepped food each day
   - Include instructions for each meal of each day (breakfast, lunch, dinner, snack if applicable)
   - Each entry should have "time" (quick estimate like "5 min") and "instructions" (what to do at meal time)
   - For day_of style, daily_assembly can be empty since food is cooked fresh
10. CONSOLIDATE identical meals - if the same meal appears multiple days, create ONE consolidated task (see MEAL CONSOLIDATION RULES above)`;
}
