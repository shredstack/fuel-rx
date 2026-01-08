/**
 * Rules and prompt instructions specific to traditional_batch prep style
 */

const BATCH_PREP_DECISION_TREE = `
## CRITICAL: BATCH PREP DECISION TREE (READ FIRST!)

Before deciding to batch prep ANY meal, run through this decision tree:

### STEP 1: Is this meal PURELY ASSEMBLY with no cooking?
Examples of assembly-only meals:
- Yogurt bowls with toppings (scoop yogurt, add toppings)
- Overnight oats (mix and refrigerate)
- Fresh fruit salads
- Cottage cheese with fruit
- Toast with toppings (avocado toast, nut butter toast)
- Pre-made protein bars or shakes
- Deli meat roll-ups
- Cheese and crackers

**-> If YES: DO NOT BATCH PREP. Put in day_of_quick session.**
   Reason: Assembly takes 2-5 minutes. Batch-prepping just adds staleness.

### STEP 2: Does this meal require only 1 cooking step under 10 minutes?
Examples:
- Scrambled eggs (5 min)
- Fried eggs (3 min)
- Quesadilla (5 min)
- Grilled cheese (5 min)
- Pan-seared fish (8 min) - also quality issue

**-> If YES: DO NOT BATCH PREP. Put in day_of_quick session.**
   Reason: Quick cooking = no time savings from batch prep.

### STEP 3: Will food quality significantly degrade over 3+ days?
Items that degrade:
- Fish/seafood (eat within 2 days max)
- Avocado-based dishes (brown quickly)
- Eggs cooked to order (rubbery when reheated)
- Fresh salads with delicate greens
- Smoothies (separate and lose texture)
- Crispy items (lose crispiness)

**-> If YES: DO NOT BATCH PREP. Put in day_of_cooking session.**
   Reason: Quality loss defeats the purpose.

### STEP 4: Does this meal have components that reheat poorly?
- Pasta (gets mushy) -> Batch prep sauce only, cook pasta day-of
- Rice can be batch prepped (reheats well in microwave)
- Roasted vegetables (usually fine, some get soggy)

**-> If MIXED: Batch prep the components that store well, day-of for the rest.**

### STEP 5: If none of the above apply -> BATCH PREP IT!
Good candidates for batch prep:
- Grilled/baked chicken breast (stores 5-7 days)
- Ground turkey/beef dishes
- Rice and quinoa
- Roasted root vegetables (sweet potato, carrots)
- Soups, stews, curries
- Marinades and sauces
- Hard-boiled eggs
- Overnight oats and chia pudding
`;

const CROSS_REFERENCE_RULES = `
## CRITICAL: CROSS-REFERENCE RULES

When you batch prep an ingredient on Sunday, you MUST ensure:

1. **Day-of instructions NEVER include cooking steps for batch-prepped items**

   WRONG (batch prepped chicken, but day-of says cook it):
   - Sunday batch: "Grill 6 chicken breasts, slice, store in containers"
   - Wednesday dinner task: "Season chicken with salt and pepper, grill 6 min per side"

   RIGHT:
   - Sunday batch: "Grill 6 chicken breasts, slice, store in containers"
   - Wednesday dinner task: "Take 1 portion of prepped chicken from fridge. Warm in microwave 60-90 seconds if desired."

2. **Daily assembly entries exist for EVERY batch-prepped meal**

   If you batch prep a meal component, there MUST be a daily_assembly entry telling the user how to assemble/reheat it.

3. **Use this language pattern for batch-prepped items in day-of tasks:**
   - "Take prepped [X] from refrigerator"
   - "Remove [X] from fridge (prepped Sunday)"
   - "Use your batch-prepped [X]"
   - "Warm prepped [X] in microwave [time]"

4. **NEVER generate cooking instructions for something already batch-prepped**

   Before writing any day-of task, mentally check: "Did I batch prep any component of this meal on Sunday?"
   If yes, the day-of task should be about ASSEMBLY and REHEATING only.
`;

const SESSION_STRUCTURE_INSTRUCTIONS = `
## SESSION STRUCTURE FOR TRADITIONAL BATCH

You will create these sessions:

### 1. Sunday Batch Prep (session_type: "weekly_batch")
- session_name: "Sunday Batch Prep"
- Contains ALL batch-prep tasks (prep_category: "sunday_batch")
- Each task includes:
  - Full cooking instructions with temps and times
  - Storage instructions (REQUIRED - how to store, how long it lasts)
  - Which meals this feeds (meal_ids)

### 2. Day-of Sessions (session_type: "day_of_morning" or "day_of_dinner")
- Only for meals that CANNOT be batch prepped (per decision tree above)
- For meals that CAN'T be batched: full cooking instructions
- For meals with batch-prepped components: assembly/reheating only

### 3. Daily Assembly (REQUIRED for traditional_batch)
The daily_assembly object tells users how to eat their batch-prepped food each day.

EVERY meal that has batch-prepped components needs a daily_assembly entry:

Example:
{
  "monday": {
    "breakfast": {
      "time": "3 min",
      "instructions": "Take overnight oats from fridge. Top with fresh berries. Enjoy cold or microwave 60 seconds."
    },
    "lunch": {
      "time": "5 min",
      "instructions": "Take prepped chicken and roasted vegetables from fridge. Microwave 90 seconds. Add fresh spinach and drizzle with stored dressing."
    },
    "dinner": {
      "time": "5 min",
      "instructions": "Reheat batch-prepped beef stir-fry in skillet over medium heat for 3 minutes. Serve over fresh rice if cooking rice day-of, or microwave prepped rice 90 seconds."
    }
  }
}

### What goes where:

| Meal Type | Sunday Batch Task | Day-of Task | Daily Assembly |
|-----------|-------------------|-------------|----------------|
| Overnight oats | YES: Prep all 7 portions | NO: None needed | YES: "Add toppings, enjoy" |
| Yogurt bowl | NO: Don't batch | YES: "Scoop yogurt, add toppings" | NO: N/A |
| Chicken + rice dinner | YES: Cook chicken & rice | NO: None needed | YES: "Reheat chicken, rice" |
| Salmon dinner (day 5) | NO: Fish spoils | YES: Full cooking instructions | NO: N/A |
| Eggs any style | NO: Don't batch eggs | YES: "Cook eggs to preference" | NO: N/A |
`;

const BATCH_PREP_EXAMPLES = `
## CORRECT vs INCORRECT EXAMPLES

### Example 1: Yogurt Bowl (should NOT be batched)

INCORRECT:
- Sunday Batch task: "Mediterranean Yogurt Bowl - Chop figs and almonds, portion into containers"
- Breakfast task also exists with same instructions
- daily_assembly says "Enjoy your prepped yogurt bowl"

CORRECT:
- NO Sunday Batch task for yogurt bowl
- day_of_morning task: "Mediterranean Yogurt Bowl - Scoop 1 cup Greek yogurt into bowl. Slice 2 fresh figs. Sprinkle with 2 tbsp chopped almonds and drizzle with honey."
- NO daily_assembly entry (it's made fresh)

Reason: Yogurt bowl is purely assembly. Takes 3 minutes. Nothing to batch prep.

---

### Example 2: Chicken + Rice + Vegetables (should be batched)

INCORRECT:
- Sunday Batch: "Grill chicken, cook rice, roast vegetables"
- Wednesday dinner task: "Season chicken breast with salt, pepper, garlic. Grill 6 min per side until internal temp reaches 165F..."

CORRECT:
- Sunday Batch: "Grill 6 chicken breasts (feeds Mon-Sat dinners). Season with salt, pepper, garlic. Grill 6 min per side until 165F. Slice and portion into 6 containers. Refrigerate up to 5 days."
- Wednesday dinner task: "Take 1 portion of prepped sliced chicken from fridge. Microwave 60-90 seconds until warmed through."
- daily_assembly.wednesday.dinner: "Combine prepped chicken, rice, and roasted vegetables. Microwave 90 seconds. Add fresh herbs if desired."

Reason: Chicken was already cooked Sunday. Wednesday should not re-cook it.

---

### Example 3: Fish on Day 5 (should NOT be batched)

INCORRECT:
- Sunday Batch: "Bake 7 salmon fillets for the week"

CORRECT:
- day_of_dinner task (Friday): "Salmon with Lemon - Pat salmon dry, season with salt, pepper, lemon zest. Bake at 400F for 12-15 minutes until flakes easily."
- NO daily_assembly entry (made fresh)

Reason: Fish quality degrades significantly after 2-3 days. Day 5 fish would be unpleasant.

---

### Example 4: Overnight Oats (should be batched)

CORRECT:
- Sunday Batch task: "Overnight Oats (7 portions) - In each of 7 mason jars, combine 1/2 cup oats, 1/2 cup milk, 1/4 cup Greek yogurt, 1 tbsp chia seeds, 1 tbsp maple syrup. Stir well, seal, refrigerate. Keeps 5-7 days."
- NO day_of_morning task needed
- daily_assembly.monday.breakfast: "Grab overnight oats from fridge. Top with fresh berries and sliced almonds. Enjoy cold."

Reason: Overnight oats are DESIGNED to be prepped ahead. They get better after soaking.
`;

export const BATCH_PREP_INSTRUCTIONS = `
## PREP STYLE: Traditional Batch Prep

**USER GOAL:** The user is busy all week and wants to prep as much food as possible on Sunday without sacrificing food quality. They'll spend 1.5-2.5 hours on Sunday, then just assemble/reheat during the week.

${BATCH_PREP_DECISION_TREE}

${CROSS_REFERENCE_RULES}

${SESSION_STRUCTURE_INSTRUCTIONS}

${BATCH_PREP_EXAMPLES}

### QUANTITY INSTRUCTIONS
Write ALL quantities for 1 serving only. The UI will show the user how to multiply for their household and total weekly servings.
`;

/**
 * Build the batch prep specific prompt section
 */
export function buildBatchPrepPromptSection(): string {
  return BATCH_PREP_INSTRUCTIONS;
}
