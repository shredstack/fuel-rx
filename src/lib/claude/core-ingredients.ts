import type {
  UserProfile,
  CoreIngredients,
  MealPlanTheme,
  ThemeIngredientGuidance,
  ProteinFocusConstraint,
} from '../types';
import { DEFAULT_INGREDIENT_VARIETY_PREFS, normalizeCoreIngredients } from '../types';
import { callLLMWithToolUse } from './client';
import { fetchCachedNutrition, buildNutritionReferenceSection } from './ingredient-cache';
import { DIETARY_LABELS } from './helpers';
import { coreIngredientsSchema } from '../llm-schemas';

/**
 * Stage 1: Generate core ingredients for the week with quantity estimates
 * Selects a focused set of ingredients and estimates quantities to meet weekly calorie targets
 */
export async function generateCoreIngredients(
  profile: UserProfile,
  userId: string,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  ingredientPreferences?: { liked: string[]; disliked: string[] },
  theme?: MealPlanTheme,
  proteinFocus?: ProteinFocusConstraint | null,
  jobId?: string
): Promise<CoreIngredients> {
  const dietaryPrefs = profile.dietary_prefs ?? ['no_restrictions'];
  const dietaryPrefsText = dietaryPrefs
    .map(pref => DIETARY_LABELS[pref] || pref)
    .join(', ') || 'No restrictions';

  const varietyPrefs = profile.ingredient_variety_prefs ?? DEFAULT_INGREDIENT_VARIETY_PREFS;

  // Calculate weekly macro targets
  const weeklyCalories = profile.target_calories * 7;
  const weeklyProtein = profile.target_protein * 7;
  const weeklyCarbs = profile.target_carbs * 7;
  const weeklyFat = profile.target_fat * 7;

  // Map prep_time to complexity level
  let prepComplexity = 'moderate';
  if (profile.prep_time <= 15) prepComplexity = 'minimal';
  else if (profile.prep_time >= 45) prepComplexity = 'extensive';

  // Build variety section for ingredient selection based on last 3 meal plans
  let exclusionsSection = '';
  if (recentMealNames && recentMealNames.length > 0) {
    exclusionsSection = `
## CRITICAL: Ingredient Variety for Fresh Meals (based on user's last 3 meal plans)

### Recent Meals to Avoid Recreating
${recentMealNames.slice(0, 30).join(', ')}

### Variety Strategy for Ingredient Selection
To create DIFFERENT meals from recent weeks, select ingredients that enable:

1. **Different cuisines** - If recent meals were mostly Mediterranean, choose ingredients for Asian, Mexican, or American-style dishes
2. **Different protein preparations** - If chicken was always baked, pick proteins that work well for stir-frying, grilling, or bowl assembly
3. **Different flavor bases** - Rotate between:
   - Citrus-forward (lemon, lime)
   - Asian aromatics (ginger, soy, sesame)
   - Mediterranean herbs (oregano, basil, garlic)
   - Latin spices (cumin, cilantro, chili)
4. **Different vegetable families** - Mix cruciferous (broccoli, cauliflower), leafy greens, nightshades (peppers, tomatoes), and root vegetables
`;
  }

  // Build enhanced preferences section for ingredient selection
  let preferencesSection = '';
  if (mealPreferences) {
    const hasLikes = mealPreferences.liked.length > 0;
    const hasDislikes = mealPreferences.disliked.length > 0;

    if (hasLikes || hasDislikes) {
      preferencesSection = '\n## User Meal Preferences (Use to Guide Ingredient Selection)\n';
      if (hasLikes) {
        preferencesSection += `
**Meals the user LIKES**: ${mealPreferences.liked.join(', ')}
- Choose ingredients that enable similar flavor profiles and meal styles
- These meals indicate the user's preferred cuisines and cooking methods
`;
      }
      if (hasDislikes) {
        preferencesSection += `
**Meals the user DISLIKES**: ${mealPreferences.disliked.join(', ')}
- AVOID ingredients strongly associated with these disliked meals
- Do NOT select proteins, seasonings, or combinations that would lead to similar meals
- If the user dislikes several meals from a cuisine, avoid ingredients specific to that cuisine
`;
      }
    }
  }

  // Build ingredient preferences section
  let ingredientPreferencesSection = '';
  if (ingredientPreferences) {
    const hasLikedIngredients = ingredientPreferences.liked.length > 0;
    const hasDislikedIngredients = ingredientPreferences.disliked.length > 0;

    if (hasLikedIngredients || hasDislikedIngredients) {
      ingredientPreferencesSection = '\n## User Ingredient Preferences (CRITICAL - MUST FOLLOW)\n';
      if (hasLikedIngredients) {
        ingredientPreferencesSection += `
**Ingredients the user LIKES** (prioritize including these):
${ingredientPreferences.liked.map(i => `- ${i}`).join('\n')}
`;
      }
      if (hasDislikedIngredients) {
        ingredientPreferencesSection += `
**Ingredients the user DISLIKES** (NEVER include these):
${ingredientPreferences.disliked.map(i => `- ${i}`).join('\n')}

⚠️ STRICT RULE: Do NOT include any disliked ingredients in your selection. The user has explicitly marked these as ingredients they do not want.
`;
      }
    }
  }

  // Build theme section if a theme is provided
  let themeSection = '';
  if (theme) {
    const guidance = theme.ingredient_guidance as ThemeIngredientGuidance;
    themeSection = `
## 🎨 THIS WEEK'S THEME: ${theme.display_name} ${theme.emoji || ''}

**CRITICAL: You MUST select ingredients that fit this theme.**

### Theme Description
${theme.description}

### Theme Flavor Profile
${guidance.flavor_profile}

### Suggested Ingredients by Category
Use these as your PRIMARY selection pool. You may add complementary ingredients, but the majority should come from this list:

**Proteins**: ${guidance.proteins.join(', ')}
**Vegetables**: ${guidance.vegetables.join(', ')}
**Fruits**: ${guidance.fruits.join(', ')}
**Grains**: ${guidance.grains.join(', ')}
**Healthy Fats**: ${guidance.fats.join(', ')}
**Key Seasonings**: ${guidance.seasonings.join(', ')}

### Selection Rules
1. At least 70% of proteins should come from the theme's suggested list
2. At least 60% of vegetables should come from the theme's suggested list
3. Seasonings should heavily favor the theme's flavor profile
4. The overall ingredient selection should unmistakably represent "${theme.display_name}"

`;
  }

  // Build protein focus section if provided
  let proteinFocusSection = '';
  if (proteinFocus) {
    const countText =
      proteinFocus.count === 'all' ? '7' :
      proteinFocus.count === '5-7' ? '5-7' : '3-4';

    const quantityText =
      proteinFocus.count === 'all' ? '2-2.5' :
      proteinFocus.count === '5-7' ? '1.5-2' : '1';

    proteinFocusSection = `
## 🎯 PROTEIN FOCUS CONSTRAINT (CRITICAL)

The user wants to focus on **${proteinFocus.protein.toUpperCase()}** for their **${proteinFocus.mealType}s** this week.

**Requirements:**
- You MUST include "${proteinFocus.protein}" as one of the selected proteins
- This protein should be the PRIMARY protein for ${countText} ${proteinFocus.mealType} meals
- Select a quantity sufficient for ${countText} ${proteinFocus.mealType} servings (approximately ${quantityText} lbs)
- Other proteins selected should complement different meal types (breakfast, lunch, snacks)

${proteinFocus.varyCuisines ? `
**Cuisine Variety Required:**
To enable varied preparations of ${proteinFocus.protein}, also select ingredients that support these cuisine styles:
- Asian: ginger, garlic, soy-compatible vegetables, rice
- Mexican/Latin: lime, cilantro, peppers, black beans
- Mediterranean: olive oil, lemon, garlic, tomatoes
- American/Southern: butter-friendly vegetables, corn

This ensures the ${proteinFocus.mealType}s feel distinct despite using the same protein.
` : ''}
`;
  }

  // Fetch cached nutrition data for common ingredients to provide as reference
  const commonIngredients = [
    'chicken breast', 'ground beef', 'salmon', 'eggs', 'greek yogurt',
    'broccoli', 'spinach', 'sweet potato', 'bell peppers', 'rice',
    'quinoa', 'oats', 'avocado', 'olive oil', 'almonds', 'banana'
  ];
  const nutritionCache = await fetchCachedNutrition(commonIngredients);
  const nutritionReference = buildNutritionReferenceSection(nutritionCache);

  const prompt = `You are a meal planning assistant for CrossFit athletes. Your job is to select a focused set of core ingredients for one week of meals that will MEET THE USER'S CALORIE AND MACRO TARGETS.
${themeSection}${proteinFocusSection}${exclusionsSection}${preferencesSection}${ingredientPreferencesSection}
## CRITICAL: WEEKLY CALORIE TARGET
The user needs approximately ${weeklyCalories} calories for the week (${profile.target_calories} per day).
- Weekly Protein Target: ${weeklyProtein}g (${profile.target_protein}g/day)
- Weekly Carbs Target: ${weeklyCarbs}g (${profile.target_carbs}g/day)
- Weekly Fat Target: ${weeklyFat}g (${profile.target_fat}g/day)

**Your ingredient selection with quantities MUST provide enough total calories and macros to meet these weekly targets.**

## USER CONTEXT
- Meal prep time available: ${prepComplexity} (${profile.prep_time} minutes per meal max)
- Dietary preferences: ${dietaryPrefsText}
- Meals per day: ${profile.meals_per_day}

## INGREDIENT COUNTS REQUESTED BY USER
The user wants their weekly grocery list to include:
- Proteins: ${varietyPrefs.proteins} different options (includes eggs, which are an excellent whole-food protein)
- Vegetables: ${varietyPrefs.vegetables} different options
- Fruits: ${varietyPrefs.fruits} different options
- Grains/Starches: ${varietyPrefs.grains} different options (includes legumes like beans, lentils)
- Healthy Fats: ${varietyPrefs.fats} different options
- Dairy: ${varietyPrefs.dairy} different options (Greek yogurt, cottage cheese, milk, cheese)
${nutritionReference}
## INSTRUCTIONS
Select ingredients that:
1. Can provide approximately ${weeklyCalories} calories and ${weeklyProtein}g protein for the week when combined
2. Are versatile and can be prepared multiple ways
3. Are commonly available at grocery stores
4. Work well for batch cooking
5. Match the user's dietary preferences

## CALORIE DISTRIBUTION GUIDANCE
When selecting ingredients, keep in mind a typical distribution:
- Proteins should provide ~35-40% of calories
- Grains/Starches should provide ~25-30% of calories
- Fats should provide ~20-25% of calories
- Fruits, vegetables, and dairy make up the rest

## INGREDIENT SELECTION GUIDELINES
- **Proteins**: Focus on lean, versatile options (chicken breast, salmon, eggs, etc.)
- **Vegetables**: Mix of colors - cruciferous, leafy greens, nightshades, root vegetables
- **Fruits**: Fresh fruits for energy and nutrients
- **Grains/Starches**: Includes legumes (rice, quinoa, black beans, etc.)
- **Healthy Fats**: Nutrient-dense options (avocado, olive oil, nuts)
- **Dairy**: High-protein options (Greek yogurt, cottage cheese, etc.)

## ATHLETE HEALTH: FRUIT & VEGETABLE TARGET
Athletes should consume approximately 800g (~6 cups) of fruits and vegetables per day for optimal health and recovery.
- Select a variety that enables this volume across all meals
- Prioritize nutrient-dense options: leafy greens, cruciferous vegetables, berries, citrus, and colorful produce

## CONSTRAINTS
- Select EXACTLY the number of items requested per category
- Prioritize ingredients that can be used in multiple meals
- ONLY recommend healthy, whole foods that are non-processed or minimally processed

## OUTPUT FORMAT
Return ONLY the ingredient name for each item (e.g., "Chicken breast", "Broccoli", "Brown rice").
Do NOT include quantities, weights, calorie counts, or macro information in the ingredient names.

Use the select_core_ingredients tool to provide your selection.`;

  // Use tool use for guaranteed valid JSON output
  const { result } = await callLLMWithToolUse<CoreIngredients>({
    prompt,
    tool: coreIngredientsSchema,
    maxTokens: 8000,
    userId,
    promptType: 'two_stage_core_ingredients',
    jobId,
  });

  // Normalize to handle any legacy 'pantry' responses
  const normalized = normalizeCoreIngredients(result);
  if (!normalized) {
    throw new Error('Failed to parse core ingredients from LLM response');
  }
  return normalized;
}
