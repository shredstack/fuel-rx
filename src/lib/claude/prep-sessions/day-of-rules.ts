import type { MealComplexity } from '../../types';

/**
 * Rules and prompt instructions specific to day_of prep style
 */

/**
 * Build day-of prep instructions with complexity preferences
 */
export function buildDayOfPromptSection(
  breakfastComplexity: MealComplexity,
  lunchComplexity: MealComplexity,
  dinnerComplexity: MealComplexity
): string {
  return `
## PREP STYLE: Day-Of Fresh Cooking
The user wants to cook fresh for every meal. This means they need DETAILED prep instructions for EVERY meal that involves ANY cooking or preparation.

CRITICAL RULES FOR DAY-OF STYLE:
1. Create a prep session for EVERY meal that requires:
   - Any heat (stove, oven, microwave, grill)
   - Any mixing, chopping, or assembly that takes more than 2 minutes
   - Any advance prep (like soaking oats overnight)

2. ONLY skip meals that are truly grab-and-go (like eating a banana or pre-made protein bar)

3. Session types:
   - "day_of_morning" for breakfast prep
   - "day_of_morning" for lunch prep (done in the morning or at lunchtime)
   - "day_of_dinner" for dinner prep

4. Include ALL meals with cooking verbs in their instructions (bake, sear, roast, grill, sauté, simmer, boil, fry, toast, heat, cook, etc.)

5. Even "simple" meals like eggs, oatmeal, or salads with cooked protein NEED prep sessions with proper instructions.

**CRITICAL: SINGLE SERVING INSTRUCTIONS (ATHLETE ONLY)**
Since the user cooks fresh each time, ALL quantities must be for exactly ONE SERVING (the athlete's portion):
- Write all quantities for 1 serving only - the UI will show household scaling instructions separately
- Do NOT multiply quantities by household size or number of days
- Do NOT include storage instructions (they cook fresh each time)
- Do NOT reference specific days of the week in the method steps (e.g., don't say "for Monday's portion")

**Why single serving?** The user's household size may vary by day (e.g., kids only on weekdays). The app UI will show them how to scale for each day's household. Your job is just to provide clear 1-serving instructions.

**Task consolidation for day-of prep:**
- CONSOLIDATE identical meals that repeat across days into ONE task
- The task description can mention which days (e.g., "Scrambled Eggs (Mon-Fri)")
- But the METHOD steps must be generic and day-agnostic - no "Monday", "Tuesday" etc. in the instructions
- Example task description: "Scrambled Eggs with Veggies (Mon-Fri)"
- Example method step: "Crack 2 eggs into a bowl" (NOT "Crack 2 eggs for Monday's breakfast")

User's complexity preferences:
- Breakfast: ${breakfastComplexity}
- Lunch: ${lunchComplexity}
- Dinner: ${dinnerComplexity}

NOTE: Complexity preference does NOT mean skip the prep session. It just indicates how complex the user expects meals to be. ALL cooked meals need prep instructions regardless of complexity level.
`;
}
