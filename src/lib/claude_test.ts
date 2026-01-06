/**
 * Testing utilities for faster meal plan generation during development
 *
 * Test Modes:
 * - fixture: Instant mock data (no API calls)
 * - haiku-minimal: Fast, cheap, 1 day repeated (RECOMMENDED for dev)
 * - haiku-full: Moderate speed, full 7 days with Haiku
 * - sonnet-minimal: Quality test, 1 day with Sonnet
 * - production: Full Sonnet generation (use for final testing)
 */

import type {
  DayPlan,
  CoreIngredients,
  MealWithIngredientNutrition,
  DayOfWeek,
  Macros,
  Meal,
  Ingredient,
} from './types';
import { DAYS_OF_WEEK } from './types';

// ============================================
// Test Mode Configuration
// ============================================

export type TestMode =
  | 'fixture'        // Use pre-generated mock data (fastest, no LLM calls)
  | 'haiku-minimal'  // Use Haiku, generate 1 day only
  | 'haiku-full'     // Use Haiku, generate full 7 days
  | 'sonnet-minimal' // Use Sonnet, generate 1 day only (for quality testing)
  | 'production';    // Full production mode (Sonnet, 7 days)

interface TestConfig {
  mode: TestMode;
  model: string;
  maxTokensCore: number;
  maxTokensMeals: number;
  maxTokensGrocery: number;
  maxTokensPrep: number;
  generateFullWeek: boolean;
  skipPrepSessions: boolean;
}

// Test configurations
const TEST_CONFIGS: Record<TestMode, TestConfig> = {
  'fixture': {
    mode: 'fixture',
    model: 'none',
    maxTokensCore: 0,
    maxTokensMeals: 0,
    maxTokensGrocery: 0,
    maxTokensPrep: 0,
    generateFullWeek: false,
    skipPrepSessions: true,
  },
  'haiku-minimal': {
    mode: 'haiku-minimal',
    model: 'claude-haiku-4-5-20251001',
    maxTokensCore: 4000,
    maxTokensMeals: 8000,
    maxTokensGrocery: 3000,
    maxTokensPrep: 0,
    generateFullWeek: false,
    skipPrepSessions: true,
  },
  'haiku-full': {
    mode: 'haiku-full',
    model: 'claude-haiku-4-5-20251001',
    maxTokensCore: 8000,
    maxTokensMeals: 16000,
    maxTokensGrocery: 6000,
    maxTokensPrep: 0,
    generateFullWeek: true,
    skipPrepSessions: true,
  },
  'sonnet-minimal': {
    mode: 'sonnet-minimal',
    model: 'claude-sonnet-4-20250514',
    maxTokensCore: 8000,
    maxTokensMeals: 12000,
    maxTokensGrocery: 6000,
    maxTokensPrep: 0,
    generateFullWeek: false,
    skipPrepSessions: true,
  },
  'production': {
    mode: 'production',
    model: 'claude-sonnet-4-20250514',
    maxTokensCore: 16000,
    maxTokensMeals: 32000,
    maxTokensGrocery: 12000,
    maxTokensPrep: 64000,
    generateFullWeek: true,
    skipPrepSessions: false,
  },
};

/**
 * Get test config from environment or default to production
 */
export function getTestConfig(): TestConfig {
  const mode = (process.env.MEAL_PLAN_TEST_MODE as TestMode) || 'production';
  const config = TEST_CONFIGS[mode] || TEST_CONFIGS.production;
  return config;
}

/**
 * Check if currently in test mode (not production)
 */
export function isTestMode(): boolean {
  const config = getTestConfig();
  return config.mode !== 'production';
}

// ============================================
// Fixture Data for Fast Testing
// ============================================

export const FIXTURE_CORE_INGREDIENTS: CoreIngredients = {
  proteins: ['Chicken breast', 'Salmon', 'Protein powder', 'Greek yogurt'],
  vegetables: ['Broccoli', 'Asparagus', 'Sweet potato'],
  fruits: ['Mixed berries', 'Banana', 'Apple'],
  grains: ['Brown rice', 'Granola'],
  fats: ['Olive oil', 'Almond butter', 'Peanut butter'],
  dairy: ['Greek yogurt', 'Almond milk'],
};

// Helper function to create a single day's meal plan
function createFixtureDayMeals(): Meal[] {
  return [
    {
      name: 'Greek Yogurt Parfait',
      type: 'breakfast',
      prep_time_minutes: 5,
      ingredients: [
        { name: 'Greek yogurt', amount: '1', unit: 'cup', category: 'dairy' },
        { name: 'Mixed berries', amount: '0.5', unit: 'cup', category: 'produce' },
        { name: 'Granola', amount: '0.25', unit: 'cup', category: 'grains' },
        { name: 'Honey', amount: '1', unit: 'tbsp', category: 'other' },
      ],
      instructions: [
        'Layer Greek yogurt in a bowl',
        'Top with mixed berries',
        'Sprinkle granola on top',
        'Drizzle with honey',
      ],
      macros: { calories: 350, protein: 25, carbs: 45, fat: 8 },
    },
    {
      name: 'Protein Smoothie',
      type: 'snack',
      prep_time_minutes: 3,
      ingredients: [
        { name: 'Protein powder', amount: '1', unit: 'scoop', category: 'protein' },
        { name: 'Banana', amount: '1', unit: 'whole', category: 'produce' },
        { name: 'Almond milk', amount: '1', unit: 'cup', category: 'dairy' },
        { name: 'Peanut butter', amount: '1', unit: 'tbsp', category: 'pantry' },
      ],
      instructions: [
        'Combine all ingredients in blender',
        'Blend until smooth',
        'Pour into glass and serve',
      ],
      macros: { calories: 280, protein: 30, carbs: 28, fat: 9 },
    },
    {
      name: 'Grilled Chicken Bowl',
      type: 'lunch',
      prep_time_minutes: 20,
      ingredients: [
        { name: 'Chicken breast', amount: '6', unit: 'oz', category: 'protein' },
        { name: 'Brown rice', amount: '1', unit: 'cup', category: 'grains' },
        { name: 'Broccoli', amount: '1', unit: 'cup', category: 'produce' },
        { name: 'Olive oil', amount: '1', unit: 'tbsp', category: 'pantry' },
      ],
      instructions: [
        'Season and grill chicken breast until cooked through',
        'Cook brown rice according to package directions',
        'Steam broccoli until tender',
        'Assemble bowl with rice, chicken, and broccoli',
        'Drizzle with olive oil',
      ],
      macros: { calories: 550, protein: 50, carbs: 52, fat: 14 },
    },
    {
      name: 'Apple with Almond Butter',
      type: 'snack',
      prep_time_minutes: 2,
      ingredients: [
        { name: 'Apple', amount: '1', unit: 'whole', category: 'produce' },
        { name: 'Almond butter', amount: '2', unit: 'tbsp', category: 'pantry' },
      ],
      instructions: [
        'Slice apple into wedges',
        'Serve with almond butter for dipping',
      ],
      macros: { calories: 240, protein: 6, carbs: 28, fat: 14 },
    },
    {
      name: 'Salmon with Sweet Potato',
      type: 'dinner',
      prep_time_minutes: 30,
      ingredients: [
        { name: 'Salmon fillet', amount: '6', unit: 'oz', category: 'protein' },
        { name: 'Sweet potato', amount: '1', unit: 'whole', category: 'produce' },
        { name: 'Asparagus', amount: '1', unit: 'cup', category: 'produce' },
        { name: 'Olive oil', amount: '1', unit: 'tbsp', category: 'pantry' },
      ],
      instructions: [
        'Bake sweet potato at 400°F for 45 minutes',
        'Season salmon with salt, pepper, and garlic',
        'Bake salmon at 400°F for 12-15 minutes',
        'Roast asparagus with olive oil at 400°F for 10-12 minutes',
        'Serve together',
      ],
      macros: { calories: 580, protein: 42, carbs: 48, fat: 22 },
    },
  ];
}

export const FIXTURE_MEAL_PLAN: DayPlan[] = DAYS_OF_WEEK.map((day) => ({
  day,
  meals: createFixtureDayMeals(),
  daily_totals: { calories: 2000, protein: 153, carbs: 201, fat: 67 },
}));

export const FIXTURE_GROCERY_LIST: Ingredient[] = [
  { name: 'Chicken breast', amount: '2.5', unit: 'lb', category: 'protein' },
  { name: 'Salmon fillets', amount: '2.5', unit: 'lb', category: 'protein' },
  { name: 'Protein powder', amount: '1', unit: 'container', category: 'protein' },
  { name: 'Mixed berries', amount: '2', unit: 'containers', category: 'produce' },
  { name: 'Bananas', amount: '7', unit: 'whole', category: 'produce' },
  { name: 'Broccoli', amount: '2', unit: 'heads', category: 'produce' },
  { name: 'Sweet potatoes', amount: '7', unit: 'whole', category: 'produce' },
  { name: 'Asparagus', amount: '2', unit: 'bunches', category: 'produce' },
  { name: 'Apples', amount: '7', unit: 'whole', category: 'produce' },
  { name: 'Greek yogurt', amount: '2', unit: 'containers', category: 'dairy' },
  { name: 'Almond milk', amount: '1', unit: 'carton', category: 'dairy' },
  { name: 'Brown rice', amount: '1', unit: 'bag', category: 'grains' },
  { name: 'Granola', amount: '1', unit: 'bag', category: 'grains' },
  { name: 'Olive oil', amount: '1', unit: 'bottle', category: 'pantry' },
  { name: 'Almond butter', amount: '1', unit: 'jar', category: 'pantry' },
  { name: 'Peanut butter', amount: '1', unit: 'jar', category: 'pantry' },
  { name: 'Honey', amount: '1', unit: 'jar', category: 'other' },
];

export const FIXTURE_PREP_SESSIONS = {
  prepSessions: [],
  dailyAssembly: {},
};

// ============================================
// Test Mode Helpers
// ============================================

/**
 * Repeat a single day's meals across all 7 days
 */
export function repeatDayAcrossWeek(singleDayMeals: Meal[]): DayPlan[] {
  return DAYS_OF_WEEK.map(day => {
    const meals = singleDayMeals.map(meal => ({ ...meal }));
    const daily_totals: Macros = meals.reduce(
      (totals, meal) => ({
        calories: totals.calories + meal.macros.calories,
        protein: totals.protein + meal.macros.protein,
        carbs: totals.carbs + meal.macros.carbs,
        fat: totals.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return { day, meals, daily_totals };
  });
}

/**
 * Extract Monday meals from a single-day generation
 */
export function extractMondayMeals(
  mealsResult: { meals: Array<MealWithIngredientNutrition & { day?: DayOfWeek }> }
): Meal[] {
  return mealsResult.meals.map(meal => ({
    name: meal.name,
    type: meal.type,
    prep_time_minutes: meal.prep_time_minutes,
    ingredients: meal.ingredients,
    instructions: meal.instructions,
    macros: meal.macros,
  }));
}

/**
 * Modify a prompt to request only 1 day of meals instead of 7
 */
export function modifyPromptForSingleDay(prompt: string): string {
  return prompt
    .replace(/all 7 days/gi, 'Monday only (1 day)')
    .replace(/7-day/gi, '1-day')
    .replace(/entire week/gi, 'Monday')
    .replace(/Generate all \d+ meals for all 7 days/gi, 'Generate meals for Monday only')
    .replace(/Order by day \(monday first\), then by meal type/gi, 'All meals should be for Monday');
}

// ============================================
// Logging Helpers
// ============================================

export function logTestMode(config: TestConfig) {
  console.log('\n============================================');
  console.log('TEST MODE ENABLED');
  console.log('============================================');
  console.log(`Mode: ${config.mode.toUpperCase()}`);
  console.log(`Model: ${config.model}`);
  console.log(`Generate Full Week: ${config.generateFullWeek ? 'Yes' : 'No (1 day repeated)'}`);
  console.log(`Skip Prep Sessions: ${config.skipPrepSessions ? 'Yes' : 'No'}`);
  console.log(`Token Limits - Core: ${config.maxTokensCore}, Meals: ${config.maxTokensMeals}, Grocery: ${config.maxTokensGrocery}`);
  console.log('============================================\n');
}

export function logSavings(testConfig: TestConfig) {
  const prodConfig = TEST_CONFIGS.production;

  if (testConfig.mode === 'production') {
    return; // No savings in production mode
  }

  const tokenSavings = {
    core: ((prodConfig.maxTokensCore - testConfig.maxTokensCore) / prodConfig.maxTokensCore * 100).toFixed(0),
    meals: ((prodConfig.maxTokensMeals - testConfig.maxTokensMeals) / prodConfig.maxTokensMeals * 100).toFixed(0),
    grocery: ((prodConfig.maxTokensGrocery - testConfig.maxTokensGrocery) / prodConfig.maxTokensGrocery * 100).toFixed(0),
  };

  console.log('ESTIMATED SAVINGS');
  console.log('============================================');
  console.log(`Token Reduction:`);
  console.log(`  Core Ingredients: ~${tokenSavings.core}%`);
  console.log(`  Meals: ~${tokenSavings.meals}%`);
  console.log(`  Grocery List: ~${tokenSavings.grocery}%`);

  if (testConfig.mode.includes('haiku')) {
    console.log(`\nModel: Haiku vs Sonnet`);
    console.log(`  Cost: ~80-90% cheaper`);
    console.log(`  Speed: ~2-3x faster`);
  }

  if (testConfig.skipPrepSessions) {
    console.log(`\nPrep Sessions: Skipped (saves ~64000 tokens)`);
  }

  console.log('============================================\n');
}
