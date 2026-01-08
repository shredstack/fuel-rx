/**
 * Rules and prompt instructions specific to traditional_batch prep style
 */

export const BATCH_PREP_INSTRUCTIONS = `
## PREP STYLE: Traditional Batch Prep

**USER GOAL:** The user is busy all week and wants to prep as much food as possible on Sunday without sacrificing food quality. They'll spend 1.5-2.5 hours on Sunday, then just assemble/reheat during the week.

### CRITICAL: FOOD QUALITY DECISIONS
You must decide for EACH meal whether it can be batch-prepped Sunday or must be made day-of:

**BATCH PREP SUNDAY (put in "weekly_batch" session, prep_category: "sunday_batch"):**
- Grains (rice, quinoa, oats) - store well 5-7 days
- Proteins that reheat well: chicken, ground turkey, beef, tofu
- Roasted vegetables (root veggies, broccoli, peppers)
- Sauces, dressings, marinades
- Overnight oats, chia pudding
- Soups, stews, curries
- Hard-boiled eggs

**MUST BE DAY-OF (put in "day_of_morning" or "day_of_dinner" session):**
- Fish/seafood being eaten 3+ days after prep (quality degrades significantly)
- Fresh salads with delicate greens (they wilt)
- Eggs cooked to order (scrambled, fried, poached) - too quick to batch anyway
- Avocado dishes (brown quickly)
- Yogurt and fruit bowls
- Anything that takes <10 min to make fresh
- Meals where freshness is absolutely key to enjoyment

Use prep_category "day_of_quick" for meals under 10 minutes, "day_of_cooking" for longer day-of meals.

### SESSION STRUCTURE
Create prep sessions like this:
1. **Main Batch Prep Session** (session_type: "weekly_batch", session_name: "Sunday Batch Prep"):
   - Contains ALL sunday_batch tasks
   - Full detailed cooking instructions
   - Storage instructions for each item (REQUIRED)
   - All tasks have prep_category: "sunday_batch"

2. **Day-of Sessions** (session_type: "day_of_morning" or "day_of_dinner"):
   - For meals that can't be batched
   - Full cooking instructions
   - Tasks have prep_category: "day_of_quick" or "day_of_cooking"

### DAILY ASSEMBLY GUIDE
For batch-prepped meals, include clear assembly/reheating instructions in daily_assembly:
- "Remove chicken and rice from fridge. Microwave rice 90 seconds, chicken 60 seconds. Top with pre-made sauce."
- "Grab overnight oats from fridge, top with fresh berries, enjoy cold."

### QUANTITY INSTRUCTIONS
Write ALL quantities for 1 serving only. The UI will show the user how to multiply for their household and total weekly servings.
`;

/**
 * Build the batch prep specific prompt section
 */
export function buildBatchPrepPromptSection(): string {
  return BATCH_PREP_INSTRUCTIONS;
}
