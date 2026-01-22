export type DietaryPreference =
  | 'no_restrictions'
  | 'paleo'
  | 'vegetarian'
  | 'gluten_free'
  | 'dairy_free';

export type PrepTime = 5 | 15 | 30 | 45 | 60;

export type MealsPerDay = 3 | 4 | 5 | 6;

export type MealType = 'breakfast' | 'pre_workout' | 'lunch' | 'post_workout' | 'snack' | 'dinner';

// Workout time preference
export type WorkoutTime = 'morning' | 'midday' | 'evening' | 'varies';

// Pre-workout meal size preference
export type PreWorkoutPreference = 'light' | 'moderate' | 'substantial';

// Meal type configuration for display and calorie allocation
export const MEAL_TYPE_CONFIG: Record<MealType, {
  label: string;
  shortLabel: string;
  icon: string;
  displayOrder: number;
  caloriePercentRange: [number, number]; // [min%, max%] of daily calories
  isWorkoutMeal: boolean;
  // Tailwind color classes for badges/tags
  colorClasses: string;
  // Hex color for charts
  colorHex: string;
}> = {
  breakfast: {
    label: 'Breakfast',
    shortLabel: 'Bfast',
    icon: '🌅',
    displayOrder: 1,
    caloriePercentRange: [0.20, 0.25],
    isWorkoutMeal: false,
    colorClasses: 'bg-yellow-100 text-yellow-800',
    colorHex: '#f59e0b', // amber-500
  },
  pre_workout: {
    label: 'Pre-Workout',
    shortLabel: 'Pre-WO',
    icon: '⚡',
    displayOrder: 2,
    caloriePercentRange: [0.05, 0.10],
    isWorkoutMeal: true,
    colorClasses: 'bg-orange-100 text-orange-800',
    colorHex: '#f97316', // orange-500
  },
  lunch: {
    label: 'Lunch',
    shortLabel: 'Lunch',
    icon: '☀️',
    displayOrder: 3,
    caloriePercentRange: [0.25, 0.30],
    isWorkoutMeal: false,
    colorClasses: 'bg-teal-100 text-teal-800',
    colorHex: '#14b8a6', // teal-500
  },
  post_workout: {
    label: 'Post-Workout',
    shortLabel: 'Post-WO',
    icon: '💪',
    displayOrder: 4,
    caloriePercentRange: [0.08, 0.12],
    isWorkoutMeal: true,
    colorClasses: 'bg-lime-100 text-lime-800',
    colorHex: '#84cc16', // lime-500
  },
  snack: {
    label: 'Snack',
    shortLabel: 'Snack',
    icon: '🍎',
    displayOrder: 5,
    caloriePercentRange: [0.08, 0.12],
    isWorkoutMeal: false,
    colorClasses: 'bg-purple-100 text-purple-800',
    colorHex: '#a855f7', // purple-500
  },
  dinner: {
    label: 'Dinner',
    shortLabel: 'Dinner',
    icon: '🌙',
    displayOrder: 6,
    caloriePercentRange: [0.30, 0.35],
    isWorkoutMeal: false,
    colorClasses: 'bg-blue-100 text-blue-800',
    colorHex: '#3b82f6', // blue-500
  },
};

// Helper to get meal type color classes
export const getMealTypeColorClasses = (mealType: MealType): string => {
  return MEAL_TYPE_CONFIG[mealType]?.colorClasses ?? 'bg-gray-100 text-gray-800';
};

// Helper to get meal type hex color (for charts)
export const getMealTypeColorHex = (mealType: MealType): string => {
  return MEAL_TYPE_CONFIG[mealType]?.colorHex ?? '#9ca3af';
};

// Helper to get meals in display order
export const getMealTypesInOrder = (): MealType[] => {
  return Object.entries(MEAL_TYPE_CONFIG)
    .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
    .map(([type]) => type as MealType);
};

// Helper to check if a meal type is workout-related
export const isWorkoutMeal = (type: MealType): boolean => {
  return MEAL_TYPE_CONFIG[type]?.isWorkoutMeal ?? false;
};

// Helper to get standard (non-workout) meal types
export const getStandardMealTypes = (): MealType[] => {
  return ['breakfast', 'lunch', 'dinner', 'snack'];
};

export type MealConsistency = 'consistent' | 'varied';

export type MealConsistencyPrefs = Record<MealType, MealConsistency>;

// Prep style preferences
export type PrepStyle = 'traditional_batch' | 'day_of';

export type MealComplexity = 'quick_assembly' | 'minimal_prep' | 'full_recipe';

export const PREP_STYLE_LABELS: Record<PrepStyle, { title: string; description: string }> = {
  traditional_batch: {
    title: 'Traditional Batch Prep',
    description: 'Prep all meals on Sunday - spend 2 hours once, enjoy quick meals all week',
  },
  day_of: {
    title: 'Day-Of Fresh Cooking',
    description: 'Cook each meal fresh when you eat it - maximum freshness and flexibility',
  },
};

export const MEAL_COMPLEXITY_LABELS: Record<MealComplexity, { title: string; time: string; example: string }> = {
  quick_assembly: {
    title: 'Quick Assembly',
    time: '2-10 min',
    example: '2 eggs, avocado, tomatoes',
  },
  minimal_prep: {
    title: 'Minimal Prep',
    time: '10-20 min',
    example: 'Veggie omelet, overnight oats',
  },
  full_recipe: {
    title: 'Full Recipe',
    time: '20-45 min',
    example: 'Breakfast burrito bowl, frittata',
  },
};

export const DEFAULT_PREP_STYLE: PrepStyle = 'day_of';

export interface MealComplexityPrefs {
  breakfast: MealComplexity;
  lunch: MealComplexity;
  dinner: MealComplexity;
}

export const DEFAULT_MEAL_COMPLEXITY_PREFS: MealComplexityPrefs = {
  breakfast: 'minimal_prep',
  lunch: 'quick_assembly',
  dinner: 'full_recipe',
};

export const DEFAULT_MEAL_CONSISTENCY_PREFS: MealConsistencyPrefs = {
  breakfast: 'consistent',
  pre_workout: 'consistent',
  lunch: 'consistent',
  post_workout: 'consistent',
  snack: 'consistent',
  dinner: 'varied',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  pre_workout: 'Pre-Workout',
  lunch: 'Lunch',
  post_workout: 'Post-Workout',
  snack: 'Snack',
  dinner: 'Dinner',
};

// Selectable meal types (excludes 'snack' which is controlled by snack_count)
export type SelectableMealType = 'breakfast' | 'pre_workout' | 'lunch' | 'post_workout' | 'dinner';

// Default selected meal types for new users
export const DEFAULT_SELECTED_MEAL_TYPES: SelectableMealType[] = ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'dinner'];

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  weight: number | null;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_calories: number;
  dietary_prefs: DietaryPreference[];
  // Legacy field - kept for backward compatibility
  meals_per_day: MealsPerDay;
  // New meal type selection
  selected_meal_types: SelectableMealType[];
  snack_count: number;
  prep_time: PrepTime;
  meal_consistency_prefs: MealConsistencyPrefs;
  ingredient_variety_prefs: IngredientVarietyPrefs;
  // Prep style preferences
  prep_style: PrepStyle;
  breakfast_complexity: MealComplexity;
  lunch_complexity: MealComplexity;
  dinner_complexity: MealComplexity;
  // Household servings preferences
  household_servings: HouseholdServingsPrefs;
  // Legacy workout meal preferences - kept for backward compatibility
  include_workout_meals: boolean;
  workout_time: WorkoutTime;
  pre_workout_preference: PreWorkoutPreference;
  social_feed_enabled: boolean;
  display_name: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  category: 'produce' | 'protein' | 'dairy' | 'grains' | 'pantry' | 'frozen' | 'other';
  // Optional nutrition data (populated by LLM, can be overridden by user)
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

// Extended ingredient with required nutrition data
export interface IngredientWithNutrition extends Omit<Ingredient, 'calories' | 'protein' | 'carbs' | 'fat'> {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  name: string;
  type: MealType;
  prep_time_minutes: number;
  ingredients: Ingredient[];
  instructions: string[];
  macros: Macros;
}

// Meal with ingredient-level nutrition data
export interface MealWithIngredientNutrition {
  name: string;
  type: MealType;
  prep_time_minutes: number;
  ingredients: IngredientWithNutrition[];
  instructions: string[];
  macros: Macros;
}

export interface DayPlan {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  meals: Meal[];
  daily_totals: Macros;
}

export interface MealPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  title: string | null;
  days: DayPlan[];
  grocery_list: Ingredient[];
  is_favorite: boolean;
  created_at: string;
}

export type MealPreferenceType = 'liked' | 'disliked';

export interface MealPreference {
  id: string;
  user_id: string;
  meal_name: string;
  preference: MealPreferenceType;
  created_at: string;
}

export interface OnboardingData {
  name: string;
  weight: number | null;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_calories: number;
  dietary_prefs: DietaryPreference[];
  // New meal type selection
  selected_meal_types: SelectableMealType[];
  snack_count: number;
  prep_time: PrepTime;
  meal_consistency_prefs: MealConsistencyPrefs;
  ingredient_variety_prefs: IngredientVarietyPrefs;
  // Prep style preferences
  prep_style: PrepStyle;
  breakfast_complexity: MealComplexity;
  lunch_complexity: MealComplexity;
  dinner_complexity: MealComplexity;
  // Household servings preferences
  household_servings: HouseholdServingsPrefs;
  profile_photo_url: string | null;
}

export const DIETARY_PREFERENCE_LABELS: Record<DietaryPreference, string> = {
  no_restrictions: 'No Restrictions',
  paleo: 'Paleo',
  vegetarian: 'Vegetarian',
  gluten_free: 'Gluten-Free',
  dairy_free: 'Dairy-Free',
};

export const PREP_TIME_OPTIONS: { value: PrepTime; label: string }[] = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
];

export const MEALS_PER_DAY_OPTIONS: MealsPerDay[] = [3, 4, 5, 6];

export interface ValidatedMealIngredient {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type CustomMealPrepTime = '5_or_less' | '15' | '30' | 'more_than_30';

export const CUSTOM_MEAL_PREP_TIME_OPTIONS: { value: CustomMealPrepTime; label: string }[] = [
  { value: '5_or_less', label: '5 minutes or less' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: 'more_than_30', label: 'More than 30 minutes' },
];

export interface ValidatedMeal {
  id: string;
  user_id: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: ValidatedMealIngredient[] | null;
  is_user_created: boolean;
  image_url: string | null;
  share_with_community: boolean;
  prep_time: CustomMealPrepTime | null;
  meal_prep_instructions: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Saved Meal Types (for My Meals page)
// ============================================

export type SavedMealSourceType = 'user_created' | 'quick_cook' | 'party_meal';

/**
 * Base interface for all saved meals
 */
export interface SavedMealBase {
  id: string;
  name: string;
  source_type: SavedMealSourceType;
  source_user_id: string;
  is_public: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  /** If this meal was saved from the community feed, this is the original post ID */
  source_community_post_id: string | null;
}

/**
 * User-created meal (manual entry)
 */
export interface SavedUserMeal extends SavedMealBase {
  source_type: 'user_created';
  meal_type: MealType | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: ValidatedMealIngredient[] | null;
  instructions: string[] | null;
  prep_time_minutes: number;
  prep_instructions: string | null;
}

/**
 * Quick Cook single meal (AI-generated)
 */
export interface SavedQuickCookMeal extends SavedMealBase {
  source_type: 'quick_cook';
  meal_type: MealType;
  emoji: string | null;
  description: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: IngredientWithNutrition[];
  instructions: string[];
  prep_time_minutes: number;
  cook_time_minutes: number | null;
  servings: number | null;
  tips: string[] | null;
}

/**
 * Party meal (AI-generated party prep guide)
 */
export interface SavedPartyMeal extends SavedMealBase {
  source_type: 'party_meal';
  description: string | null;
  party_data: PartyPrepGuide;
}

/**
 * Union type for all saved meal types
 */
export type SavedMeal = SavedUserMeal | SavedQuickCookMeal | SavedPartyMeal;

/**
 * Type guard to check if a saved meal is a user-created meal
 */
export function isSavedUserMeal(meal: SavedMeal): meal is SavedUserMeal {
  return meal.source_type === 'user_created';
}

/**
 * Type guard to check if a saved meal is a quick cook meal
 */
export function isSavedQuickCookMeal(meal: SavedMeal): meal is SavedQuickCookMeal {
  return meal.source_type === 'quick_cook';
}

/**
 * Type guard to check if a saved meal is a party meal
 */
export function isSavedPartyMeal(meal: SavedMeal): meal is SavedPartyMeal {
  return meal.source_type === 'party_meal';
}

// Social Feed Types

export type SocialFeedSourceType = 'custom_meal' | 'favorited_meal' | 'quick_cook' | 'party_meal' | 'liked_meal' | 'cooked_meal';

export interface SocialFeedPost {
  id: string;
  user_id: string;
  source_type: SocialFeedSourceType;
  source_meal_id: string | null;
  source_meal_plan_id: string | null;
  source_meals_table_id: string | null; // For quick_cook and party_meal types
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image_url: string | null;
  prep_time: CustomMealPrepTime | null;
  ingredients: ValidatedMealIngredient[] | null;
  instructions: string[] | null;
  meal_prep_instructions: string | null;
  meal_type: MealType | null;
  party_data: PartyPrepGuide | null; // For party_meal posts
  cooked_photo_url: string | null; // For cooked_meal posts
  user_notes: string | null; // For cooked_meal posts
  created_at: string;
  // Joined fields from queries
  author?: {
    id: string;
    display_name: string | null;
    name: string | null;
  };
  is_saved?: boolean;
  is_own_post?: boolean;
}

export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface SavedCommunityMeal {
  id: string;
  user_id: string;
  source_post_id: string;
  original_author_id: string;
  created_at: string;
}

export interface SocialUser {
  id: string;
  display_name: string | null;
  name: string | null;
  social_feed_enabled: boolean;
  is_following?: boolean;
  follower_count?: number;
  following_count?: number;
  post_count?: number;
}

// ============================================
// Two-Stage Generation & Prep Mode Types
// ============================================

// Ingredient categories for core ingredient selection
export type IngredientCategory = 'proteins' | 'vegetables' | 'fruits' | 'grains' | 'fats' | 'dairy';

// User preferences for how many ingredients per category
export interface IngredientVarietyPrefs {
  proteins: number;
  vegetables: number;
  fruits: number;
  grains: number;
  fats: number;
  dairy: number;
}

export const DEFAULT_INGREDIENT_VARIETY_PREFS: IngredientVarietyPrefs = {
  proteins: 3,
  vegetables: 5,
  fruits: 2,
  grains: 2,
  fats: 3,
  dairy: 2,
};

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  proteins: 'Proteins',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  grains: 'Grains & Starches',
  fats: 'Healthy Fats',
  dairy: 'Dairy',
};

export const INGREDIENT_VARIETY_RANGES: Record<IngredientCategory, { min: number; max: number }> = {
  proteins: { min: 1, max: 5 },
  vegetables: { min: 2, max: 8 },
  fruits: { min: 1, max: 5 },
  grains: { min: 1, max: 4 },
  fats: { min: 1, max: 5 },
  dairy: { min: 0, max: 4 },
};

// Core ingredient can be a simple string or an object with swapped flag
export type CoreIngredientItem = string | { name: string; swapped: true };

// Helper to get the name from a CoreIngredientItem
export function getCoreIngredientName(item: CoreIngredientItem): string {
  return typeof item === 'string' ? item : item.name;
}

// Helper to check if a core ingredient was swapped in
export function isCoreIngredientSwapped(item: CoreIngredientItem): boolean {
  return typeof item !== 'string' && item.swapped === true;
}

// Core ingredients selected in Stage 1
export interface CoreIngredients {
  proteins: CoreIngredientItem[];
  vegetables: CoreIngredientItem[];
  fruits: CoreIngredientItem[];
  grains: CoreIngredientItem[];
  fats: CoreIngredientItem[];
  dairy: CoreIngredientItem[];
}

/**
 * Normalize core ingredients to handle legacy 'pantry' field
 * Converts 'pantry' to 'dairy' for backwards compatibility with old data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCoreIngredients(ingredients: any): CoreIngredients | null {
  if (!ingredients) return null;

  // Handle legacy 'pantry' field - merge into dairy
  const pantryItems = ingredients.pantry || [];
  const dairyItems = ingredients.dairy || [];

  return {
    proteins: ingredients.proteins || [],
    vegetables: ingredients.vegetables || [],
    fruits: ingredients.fruits || [],
    grains: ingredients.grains || [],
    fats: ingredients.fats || [],
    dairy: [...dairyItems, ...pantryItems],
  };
}

// Individual ingredient stored in meal_plan_ingredients table
export interface MealPlanIngredient {
  id: string;
  meal_plan_id: string;
  category: IngredientCategory;
  ingredient_name: string;
  quantity: string | null;
  notes: string | null;
  created_at: string;
}

// Day reference for prep mode
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Household servings preferences - how many additional people to feed per day/meal
export interface HouseholdServingCount {
  adults: number;   // Additional adults beyond the main user (each counts as 1x portion)
  children: number; // Children (each counts as ~0.6x portion)
}

export interface DayHouseholdServings {
  breakfast: HouseholdServingCount;
  lunch: HouseholdServingCount;
  dinner: HouseholdServingCount;
  snacks: HouseholdServingCount;
}

export type HouseholdServingsPrefs = Record<DayOfWeek, DayHouseholdServings>;

export const DEFAULT_HOUSEHOLD_SERVING_COUNT: HouseholdServingCount = {
  adults: 0,
  children: 0,
};

export const DEFAULT_DAY_HOUSEHOLD_SERVINGS: DayHouseholdServings = {
  breakfast: { adults: 0, children: 0 },
  lunch: { adults: 0, children: 0 },
  dinner: { adults: 0, children: 0 },
  snacks: { adults: 0, children: 0 },
};

export const DEFAULT_HOUSEHOLD_SERVINGS_PREFS: HouseholdServingsPrefs = {
  monday: { ...DEFAULT_DAY_HOUSEHOLD_SERVINGS },
  tuesday: { ...DEFAULT_DAY_HOUSEHOLD_SERVINGS },
  wednesday: { ...DEFAULT_DAY_HOUSEHOLD_SERVINGS },
  thursday: { ...DEFAULT_DAY_HOUSEHOLD_SERVINGS },
  friday: { ...DEFAULT_DAY_HOUSEHOLD_SERVINGS },
  saturday: { ...DEFAULT_DAY_HOUSEHOLD_SERVINGS },
  sunday: { ...DEFAULT_DAY_HOUSEHOLD_SERVINGS },
};

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Child portion multiplier (children typically eat 60% of adult portions)
export const CHILD_PORTION_MULTIPLIER = 0.6;

// Prep item in a prep session
export interface PrepItem {
  item: string;
  quantity: string;
  ingredients?: string[];
  method?: string;
  storage: string;
  feeds: Array<{ day: DayOfWeek; meal: MealType }>;
}

// Daily assembly instructions for a single day
export interface DailyAssemblyDay {
  breakfast?: { time: string; instructions: string };
  pre_workout?: { time: string; instructions: string };
  lunch?: { time: string; instructions: string };
  post_workout?: { time: string; instructions: string };
  snack?: { time: string; instructions: string };
  dinner?: { time: string; instructions: string };
}

// Daily assembly for all days
export type DailyAssembly = Partial<Record<DayOfWeek, DailyAssemblyDay>>;

// Cooking temperature information for prep tasks
export interface CookingTemps {
  oven?: string;          // e.g., "400°F" or "200°C"
  stovetop?: string;      // e.g., "medium-high heat"
  internal_temp?: string; // e.g., "145°F for salmon"
  grill?: string;         // e.g., "medium-high, 400-450°F"
}

// Cooking time information for prep tasks
export interface CookingTimes {
  prep_time?: string;     // e.g., "5 min"
  cook_time?: string;     // e.g., "15-20 min"
  rest_time?: string;     // e.g., "5 min before serving"
  total_time?: string;    // e.g., "25-30 min"
}

// Prep category for batch vs day-of cooking decisions
export type PrepCategory = 'sunday_batch' | 'day_of_quick' | 'day_of_cooking';

// Prep task for the new collapsible prep view
export interface PrepTask {
  id: string;
  description: string;              // Brief task title
  detailed_steps: string[];         // Step-by-step instructions with specifics
  cooking_temps?: CookingTemps;     // Temperature information if applicable
  cooking_times?: CookingTimes;     // Time breakdowns
  tips?: string[];                  // Pro tips for the task
  storage?: string;                 // Storage instructions (e.g., "Refrigerate in airtight container for up to 5 days")
  estimated_minutes: number;
  meal_ids: string[];
  completed: boolean;
  // NEW: Equipment and ingredients needed before starting
  equipment_needed?: string[];      // e.g., ["Large skillet", "Medium pot", "Baking sheet"]
  ingredients_to_prep?: string[];   // e.g., ["1.5 lbs ground turkey", "8 oz mushrooms, sliced"]
  // Prep category for batch prep users (helps distinguish batch vs day-of tasks)
  prep_category?: PrepCategory;     // sunday_batch = prep ahead, day_of_quick = <10min fresh, day_of_cooking = longer fresh cooking
}

// Session type for prep scheduling
export type PrepSessionType = 'weekly_batch' | 'night_before' | 'day_of_morning' | 'day_of_dinner';

// Prep session stored in prep_sessions table
export interface PrepSession {
  id: string;
  meal_plan_id: string;
  session_name: string;
  session_order: number;
  estimated_minutes: number | null;
  prep_items: PrepItem[];
  feeds_meals: Array<{ day: DayOfWeek; meal: MealType }>;
  instructions: string | null;
  daily_assembly: DailyAssembly | null;
  // New fields for collapsible prep view
  session_type: PrepSessionType;
  session_day: DayOfWeek | null;
  session_time_of_day: 'morning' | 'afternoon' | 'night' | null;
  prep_for_date: string | null;
  prep_tasks: { tasks: PrepTask[] };
  display_order: number;
  created_at: string;
  updated_at?: string;
}

// Extended meal plan with two-stage generation data
export interface MealPlanWithPrepMode extends MealPlan {
  core_ingredients: CoreIngredients | null;
  prep_sessions?: PrepSession[];
}

// Response from Stage 1 LLM call
export interface Stage1Response {
  proteins: string[];
  vegetables: string[];
  fruits: string[];
  grains: string[];
  fats: string[];
  dairy: string[];
}

// Response from Stage 3 (Prep Mode) LLM call
export interface PrepModeResponse {
  prepSessions: Array<{
    sessionName: string;
    sessionOrder: number;
    estimatedMinutes: number;
    instructions: string;
    prepItems: PrepItem[];
  }>;
  dailyAssembly: DailyAssembly;
}

// ============================================
// Ingredient Types
// ============================================

// Ingredient category for the dimension table
export type IngredientCategoryType = 'protein' | 'vegetable' | 'fruit' | 'grain' | 'fat' | 'dairy' | 'pantry' | 'other';

// Ingredient dimension table - unique ingredient identity
export interface IngredientRecord {
  id: string;
  name: string;
  name_normalized: string;
  category: IngredientCategoryType | null;
  description?: string;
  is_user_added?: boolean;
  added_by_user_id?: string;
  added_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Ingredient Nutrition Cache Types
// ============================================

export interface IngredientNutrition {
  id: string;
  ingredient_id: string; // FK to ingredients table
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  source: 'llm_estimated' | 'usda' | 'user_corrected' | 'barcode_scan';
  usda_fdc_id?: string;
  barcode?: string;
  confidence_score?: number;
  validated?: boolean;
  // USDA matching fields
  usda_match_status?: 'pending' | 'matched' | 'no_match' | 'manual_override';
  usda_matched_at?: string;
  usda_match_confidence?: number;
  usda_match_reasoning?: string;
  usda_calories_per_100g?: number;
  usda_protein_per_100g?: number;
  usda_carbs_per_100g?: number;
  usda_fat_per_100g?: number;
  created_at: string;
  updated_at: string;
}

// Extended nutrition with ingredient details (from view)
export interface IngredientNutritionWithDetails extends IngredientNutrition {
  ingredient_name: string;
  name_normalized: string;
  category: IngredientCategoryType | null;
}

// User override for ingredient nutrition (pending expert validation)
export type IngredientOverrideValidationStatus = 'pending' | 'approved' | 'rejected';

export interface IngredientNutritionUserOverride {
  id: string;
  user_id: string;
  ingredient_name: string;
  ingredient_name_normalized: string;
  serving_size: number;
  serving_unit: string;
  original_calories?: number;
  original_protein?: number;
  original_carbs?: number;
  original_fat?: number;
  override_calories: number;
  override_protein: number;
  override_carbs: number;
  override_fat: number;
  meal_plan_id?: string;
  meal_name?: string;
  validation_status: IngredientOverrideValidationStatus;
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string;
  created_at: string;
  updated_at: string;
}

// Ingredient preference (like/dislike)
export type IngredientPreferenceType = 'liked' | 'disliked';

// Ingredient usage mode for single meal generation
export type IngredientUsageMode = 'include_with_additions' | 'only_selected';

export interface IngredientPreference {
  id: string;
  user_id: string;
  ingredient_id: string;
  preference: IngredientPreferenceType;
  created_at: string;
  updated_at: string;
}

// Extended ingredient preference with ingredient details (from view)
export interface IngredientPreferenceWithDetails extends IngredientPreference {
  ingredient_name: string;
  name_normalized: string;
  category: IngredientCategoryType | null;
  description?: string;
}

// Core ingredient with quantity estimation for weekly calorie targets
export interface CoreIngredientWithQuantity {
  name: string;
  category: IngredientCategory;
  weeklyQuantity: string; // e.g., "4 lbs", "2 dozen"
  estimatedWeeklyCalories: number;
  estimatedWeeklyProtein: number;
  estimatedWeeklyCarbs: number;
  estimatedWeeklyFat: number;
}

// ============================================
// Theme Types
// ============================================

export interface ThemeIngredientGuidance {
  proteins: string[];
  vegetables: string[];
  fruits: string[];
  grains: string[];
  fats: string[];
  seasonings: string[];
  flavor_profile: string;
}

export interface MealPlanTheme {
  id: string;
  name: string;
  display_name: string;
  description: string;
  emoji: string | null;
  ingredient_guidance: ThemeIngredientGuidance;
  cooking_style_guidance: string;
  meal_name_style: string | null;
  compatible_diets: string[];
  incompatible_diets: string[];
  peak_seasons: number[];
  is_system_theme: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ThemePreferenceType = 'preferred' | 'blocked';

export interface UserThemePreference {
  id: string;
  user_id: string;
  theme_id: string;
  preference: ThemePreferenceType;
  created_at: string;
}

export interface UserThemePreferenceWithTheme extends UserThemePreference {
  theme: MealPlanTheme;
}

// For theme selection logic
export interface ThemeSelectionContext {
  userDietaryPrefs: string[];
  recentThemeIds: string[]; // Last 2-3 theme IDs to exclude
  preferredThemeIds: string[];
  blockedThemeIds: string[];
  dislikedMealPatterns?: string[]; // Cuisines to avoid based on disliked meals
  currentMonth: number; // 1-12
  userOverrideThemeId?: string; // If user explicitly selected a theme
}

export interface SelectedTheme {
  theme: MealPlanTheme;
  selectionReason: string; // For display/debugging
}

// ============================================
// Meal Entity Types (Normalized Meal Storage)
// ============================================

export type MealSourceType = 'ai_generated' | 'user_created' | 'community_shared';

/**
 * MealEntity represents a normalized meal record from the meals table.
 * This is the new structure that replaces embedded JSONB meals in plan_data.
 */
export interface MealEntity {
  id: string;
  name: string;
  name_normalized: string;
  meal_type: MealType;
  ingredients: IngredientWithNutrition[];
  instructions: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prep_time_minutes: number;
  prep_instructions?: string;

  // User flags (migrated from validated_meals_by_user)
  is_user_created: boolean;
  is_nutrition_edited_by_user: boolean;

  source_type: MealSourceType;
  source_user_id?: string;
  source_meal_plan_id?: string;
  is_public: boolean;
  theme_id?: string;
  theme_name?: string;
  times_used: number;
  times_swapped_in: number;
  times_swapped_out: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * MealPlanMeal represents a junction table record linking meals to meal plan slots.
 * This enables meal swapping by simply updating the meal_id reference.
 */
export interface MealPlanMeal {
  id: string;
  meal_plan_id: string;
  meal_id: string;
  day: DayOfWeek;
  meal_type: MealType;
  snack_number?: number;
  position: number;
  is_original: boolean;
  swapped_from_meal_id?: string;
  swapped_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Normalized Meal Plan Types
// ============================================

/**
 * MealSlot represents a meal in a specific slot with junction table info.
 * Used for display in the meal plan view.
 */
export interface MealSlot {
  id: string;            // meal_plan_meals.id (for swap operations)
  meal: MealEntity;      // Full meal data
  meal_type: MealType;
  snack_number?: number;
  position: number;
  is_original: boolean;
  swapped_at?: string;
}

/**
 * DayPlanNormalized replaces the old DayPlan for normalized meal plans.
 */
export interface DayPlanNormalized {
  day: DayOfWeek;
  meals: MealSlot[];
  daily_totals: Macros;
}

/**
 * MealPlanNormalized is the new structure for meal plans with normalized meals.
 * Replaces MealPlan for the new architecture.
 */
export interface MealPlanNormalized {
  id: string;
  user_id: string;
  week_start_date: string;
  title?: string;
  theme_id?: string;
  theme?: MealPlanTheme;
  core_ingredients?: CoreIngredients;
  is_favorite: boolean;
  created_at: string;
  days: DayPlanNormalized[];
  grocery_list: Ingredient[];  // Legacy format - computed on-demand
  contextual_grocery_list?: GroceryItemWithContext[];  // New contextual format
  prep_sessions?: PrepSession[];
}

// ============================================
// Swap Types
// ============================================

export type SwapCandidateSource = 'custom' | 'community' | 'previous';

/**
 * SwapCandidate represents a meal that can be swapped into a meal plan slot.
 */
export interface SwapCandidate {
  meal: MealEntity;
  source: SwapCandidateSource;
}

/**
 * SwapRequest is the payload for the swap API endpoint.
 */
export interface SwapRequest {
  mealPlanMealId: string;  // The meal_plan_meals.id to replace
  newMealId: string;       // The meals.id to swap in
}

/**
 * GroceryListDelta shows what changed in the grocery list after a swap.
 * Not currently used since we do full recomputation, but kept for future use.
 */
export interface GroceryListDelta {
  added: Ingredient[];
  removed: Ingredient[];
  modified: Array<{
    name: string;
    unit: string;
    oldAmount: string;
    newAmount: string;
  }>;
}

// ============================================
// Contextual Grocery List Types
// ============================================

/**
 * Grocery item category type (matches grocery list categories)
 */
export type GroceryCategory = 'produce' | 'protein' | 'dairy' | 'grains' | 'pantry' | 'frozen' | 'other';

/**
 * A meal reference for a grocery item, showing where/how it's used
 */
export interface GroceryMealReference {
  day: DayOfWeek;
  meal_type: MealType;
  meal_name: string;
  amount: string;      // e.g., "1", "0.5", "2"
  unit: string;        // e.g., "whole", "cup", "oz"
  meal_plan_meal_id: string;  // For linking to meal details
}

/**
 * A grocery item with contextual meal references instead of calculated totals.
 * This gives shoppers agency to scale appropriately for their household.
 */
export interface GroceryItemWithContext {
  name: string;
  category: GroceryCategory;
  meals: GroceryMealReference[];
}

/**
 * Household information for display in grocery list
 */
export interface GroceryListHouseholdInfo {
  hasHousehold: boolean;
  description: string;  // e.g., "2 adults + 1 child"
  avgMultiplier: number;
}

/**
 * The full contextual grocery list with optional household context
 */
export interface ContextualGroceryList {
  items: GroceryItemWithContext[];
  householdInfo?: GroceryListHouseholdInfo;
}

/**
 * SwapResponse is returned from the swap API endpoint.
 */
export interface SwapResponse {
  success: boolean;
  swappedCount: number;  // >1 if consistent meal type (same meal all week)
  mealPlanMeals: MealPlanMeal[];
  newMeal: MealEntity;  // The new meal that was swapped in
  updatedDailyTotals: Record<DayOfWeek, Macros>;
  groceryList: Ingredient[];  // Legacy format - kept for backwards compatibility
  contextualGroceryList?: GroceryItemWithContext[];  // New contextual format
  updatedCoreIngredients?: CoreIngredients;  // Updated core ingredients (if new ingredients were added)
  message?: string;
}

/**
 * SwapCandidatesQuery is the query params for the swap candidates endpoint.
 */
export interface SwapCandidatesQuery {
  mealPlanId: string;
  mealType?: MealType;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * SwapCandidatesResponse is returned from the swap candidates endpoint.
 */
export interface SwapCandidatesResponse {
  candidates: SwapCandidate[];
  total: number;
  hasMore: boolean;
}

// ============================================
// Quick Cook Types
// ============================================

export type PartyType = 'casual_gathering' | 'dinner_party' | 'game_day' | 'holiday' | 'potluck_contribution';

export const PARTY_TYPE_LABELS: Record<PartyType, { title: string; description: string }> = {
  casual_gathering: {
    title: 'Casual Gathering',
    description: 'Relaxed get-together with friends or family',
  },
  dinner_party: {
    title: 'Dinner Party',
    description: 'Elevated dining experience with multiple courses',
  },
  game_day: {
    title: 'Game Day',
    description: 'Sports viewing party with finger foods and shareables',
  },
  holiday: {
    title: 'Holiday Celebration',
    description: 'Special occasion with traditional or festive dishes',
  },
  potluck_contribution: {
    title: 'Potluck Contribution',
    description: 'Single impressive dish to bring to a shared meal',
  },
};

export interface SingleMealRequest {
  mealType: MealType;
  themeId?: string;
  customInstructions?: string;
}

export interface GeneratedMeal {
  name: string;
  emoji: string;
  type: MealType;
  description: string;
  ingredients: IngredientWithNutrition[];
  instructions: string[];
  macros: Macros;
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  tips?: string[];
}

export interface SingleMealResponse {
  meal: GeneratedMeal;
}

export interface PartyMealRequest {
  guestCount: number;
  partyType: PartyType;
  themeId?: string;
  customInstructions?: string;
  dietaryConsiderations?: string[];
}

export interface PartyDish {
  name: string;
  role: 'main' | 'side' | 'appetizer' | 'dessert' | 'beverage';
  description: string;
}

export interface PartyPrepTask {
  title: string;
  steps: string[];
  duration?: string;
  notes?: string;
}

export interface PartyPrepPhase {
  title: string;
  tasks: PartyPrepTask[];
}

export interface PartyTimeline {
  days_before?: PartyPrepPhase;
  day_of_morning?: PartyPrepPhase;
  hours_before?: PartyPrepPhase;
  right_before?: PartyPrepPhase;
}

export interface PartyShoppingItem {
  item: string;
  quantity: string;
  notes?: string;
}

export interface PartyPrepGuide {
  name: string;
  description: string;
  serves: number;
  dishes: PartyDish[];
  timeline: PartyTimeline;
  shopping_list: PartyShoppingItem[];
  pro_tips: string[];
  estimated_total_prep_time: string;
  estimated_active_time: string;
}

export interface PartyMealResponse {
  guide: PartyPrepGuide;
}

// ============================================
// Onboarding State Types
// ============================================

export type OnboardingMilestone =
  | 'profile_completed'
  | 'first_plan_started'
  | 'first_plan_completed'
  | 'first_plan_viewed'
  | 'grocery_list_viewed'
  | 'prep_view_visited'
  | 'first_meal_liked'
  | 'first_meal_swapped';

export type OnboardingTipId =
  | 'meal_plan_day_selector'
  | 'meal_like_dislike'
  | 'ingredient_edit_nutrition'
  | 'meal_swap'
  | 'grocery_list_checklist'
  | 'prep_view_schedule'
  | 'core_ingredients_card'
  | 'theme_badge'
  | 'community_share';

export type FeatureDiscoveryId =
  | 'quick_cook'
  | 'community_feed'
  | 'theme_preferences'
  | 'ingredient_preferences'
  | 'household_servings'
  | 'meal_history'
  | 'meal_logging';

export interface UserOnboardingState {
  id: string;
  user_id: string;

  // Milestone flags
  profile_completed: boolean;
  first_plan_started: boolean;
  first_plan_completed: boolean;
  first_plan_viewed: boolean;
  grocery_list_viewed: boolean;
  prep_view_visited: boolean;
  first_meal_liked: boolean;
  first_meal_swapped: boolean;

  // Milestone timestamps
  profile_completed_at: string | null;
  first_plan_started_at: string | null;
  first_plan_completed_at: string | null;
  first_plan_viewed_at: string | null;
  grocery_list_viewed_at: string | null;
  prep_view_visited_at: string | null;
  first_meal_liked_at: string | null;
  first_meal_swapped_at: string | null;

  // Feature discovery and tips
  features_discovered: FeatureDiscoveryId[];
  tips_dismissed: OnboardingTipId[];

  // First Plan Tour state
  first_plan_tour_completed: boolean;
  first_plan_tour_current_step: number;
  first_plan_tour_skipped: boolean;

  // Tutorial replay
  tutorial_replay_count: number;
  last_tutorial_replay_at: string | null;

  created_at: string;
  updated_at: string;
}

// First Plan Tour step definitions
export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export const FIRST_PLAN_TOUR_STEPS: TourStep[] = [
  {
    id: 'day_selector',
    targetSelector: '[data-tour="day-selector"]',
    title: 'Navigate Your Week',
    description: 'Click any day to see meals planned for that day. Your week starts on Monday.',
    position: 'bottom',
  },
  {
    id: 'daily_totals',
    targetSelector: '[data-tour="daily-totals"]',
    title: 'Track Your Macros',
    description: 'See your daily calorie, protein, carb, and fat totals at a glance.',
    position: 'bottom',
  },
  {
    id: 'meal_card',
    targetSelector: '[data-tour="meal-card"]',
    title: 'Explore Your Meals',
    description: 'Click any meal to expand it and see ingredients, instructions, and nutrition details.',
    position: 'top',
  },
  {
    id: 'like_dislike',
    targetSelector: '[data-tour="like-dislike"]',
    title: 'Rate Your Meals',
    description: 'Like or dislike meals to improve future meal plan recommendations.',
    position: 'left',
  },
  {
    id: 'swap_button',
    targetSelector: '[data-tour="swap-button"]',
    title: 'Swap Meals',
    description: 'Not feeling a meal? Swap it with your custom meals, community favorites, or previous meals.',
    position: 'left',
  },
  {
    id: 'grocery_list',
    targetSelector: '[data-tour="grocery-list-link"]',
    title: 'Your Grocery List',
    description: 'All ingredients aggregated and organized by category. Check items off as you shop!',
    position: 'bottom',
  },
  {
    id: 'prep_schedule',
    targetSelector: '[data-tour="prep-schedule-link"]',
    title: 'Prep Schedule',
    description: 'Step-by-step prep instructions organized by day, with detailed cooking tips.',
    position: 'bottom',
  },
];

// Milestone achievement messages for MotivationalToast
export interface MilestoneMessage {
  title: string;
  message: string;
  emoji: string;
}

export const MILESTONE_MESSAGES: Record<OnboardingMilestone, MilestoneMessage> = {
  profile_completed: {
    title: 'Profile Complete!',
    message: 'Your preferences are saved. Ready to generate your first personalized meal plan!',
    emoji: '🎉',
  },
  first_plan_started: {
    title: 'Plan Generation Started!',
    message: 'Your AI-powered meal plan is being created. This takes about 5 minutes.',
    emoji: '🚀',
  },
  first_plan_completed: {
    title: 'Your First Meal Plan is Ready!',
    message: 'Time to explore your personalized week of nutrition!',
    emoji: '✨',
  },
  first_plan_viewed: {
    title: 'Exploring Your Plan!',
    message: "Check out each day's meals and see how they fit your macro targets.",
    emoji: '👀',
  },
  grocery_list_viewed: {
    title: 'Shopping Made Easy!',
    message: 'Your organized grocery list is ready for your next shopping trip.',
    emoji: '🛒',
  },
  prep_view_visited: {
    title: 'Prep Like a Pro!',
    message: 'Follow the step-by-step schedule for efficient meal prep.',
    emoji: '👨‍🍳',
  },
  first_meal_liked: {
    title: 'First Rating Added!',
    message: "We'll use your feedback to suggest better meals in the future.",
    emoji: '👍',
  },
  first_meal_swapped: {
    title: 'First Meal Swapped!',
    message: 'Great job customizing your plan to your preferences!',
    emoji: '🔄',
  },
};

// Feature discovery content
export interface FeatureContent {
  title: string;
  description: string;
  cta: string;
  icon: string;
  href: string;
}

export const FEATURE_DISCOVERY_CONTENT: Record<FeatureDiscoveryId, FeatureContent> = {
  quick_cook: {
    title: 'Quick Cook',
    description: 'Need a single meal idea? Generate a quick meal or party menu based on your preferences.',
    cta: 'Try Quick Cook',
    icon: '⚡',
    href: '/quick-cook',
  },
  community_feed: {
    title: 'Community Feed',
    description: 'Discover meals shared by other FuelRx users. Save your favorites to swap into your plans!',
    cta: 'Browse Community',
    icon: '🌍',
    href: '/community',
  },
  theme_preferences: {
    title: 'Theme Preferences',
    description: 'Set preferred or blocked cuisine themes to customize your meal plan suggestions.',
    cta: 'Set Themes',
    icon: '🎨',
    href: '/settings/theme-preferences',
  },
  ingredient_preferences: {
    title: 'Ingredient Preferences',
    description: 'Like or dislike ingredients to improve future meal recommendations.',
    cta: 'Manage Ingredients',
    icon: '🥬',
    href: '/settings/ingredient-preferences',
  },
  household_servings: {
    title: 'Household Servings',
    description: 'Cooking for family? Adjust portion sizes while keeping your macros on track.',
    cta: 'Configure Household',
    icon: '👨‍👩‍👧‍👦',
    href: '/settings/household',
  },
  meal_history: {
    title: 'Meal History',
    description: 'Access all your past meal plans. Favorite the ones you want to remember!',
    cta: 'View History',
    icon: '📚',
    href: '/history',
  },
  meal_logging: {
    title: 'Log Your Meals',
    description: 'Track what you eat to hit your 800g fruit & veggie goal. Celebrate wins along the way!',
    cta: 'Start Logging',
    icon: '📝',
    href: '/log-meal',
  },
};

// ============================================
// Meal Plan Sharing Types
// ============================================

export interface CommunityUser {
  id: string;
  display_name: string | null;
  name: string | null;
  profile_photo_url: string | null;
  is_following: boolean;
}

export interface SharedMealPlan {
  id: string;
  original_meal_plan_id: string;
  recipient_meal_plan_id: string;
  sharer_user_id: string;
  recipient_user_id: string;
  shared_at: string;
}

export interface ShareMealPlanResponse {
  success: boolean;
  message: string;
  recipientMealPlanId: string;
}

// ============================================
// Meal Cooking Tracker Types
// ============================================

export type CookingStatus = 'not_cooked' | 'cooked_as_is' | 'cooked_with_modifications';

/**
 * Cooking status for a specific meal in a meal plan
 */
export interface MealPlanMealCookingStatus {
  id: string;
  meal_plan_meal_id: string;
  cooking_status: CookingStatus;
  cooked_at: string | null;
  modification_notes: string | null;
  cooked_photo_url: string | null;
  share_with_community: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Cooking status for saved meals (quick cook, party plans)
 */
export interface SavedMealCookingStatus {
  id: string;
  meal_id: string;
  user_id: string;
  cooking_status: CookingStatus;
  cooked_at: string | null;
  modification_notes: string | null;
  cooked_photo_url: string | null;
  share_with_community: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request payload for marking a meal as cooked
 */
export interface MarkMealCookedRequest {
  cooking_status: CookingStatus;
  modification_notes?: string;
  /** If modifications were made, optionally update prep_instructions on the meal */
  updated_instructions?: string[];
  /** URL to the photo of the cooked meal (uploaded separately) */
  cooked_photo_url?: string;
  /** Whether to share this cooked meal to the community feed (default: true) */
  share_with_community?: boolean;
}

/**
 * Extended MealSlot with cooking status
 */
export interface MealSlotWithCookingStatus extends MealSlot {
  cooking_status?: MealPlanMealCookingStatus;
}

/**
 * Labels and styling for cooking status display
 */
export const COOKING_STATUS_LABELS: Record<CookingStatus, { label: string; shortLabel: string; color: string }> = {
  not_cooked: { label: 'Not Cooked', shortLabel: 'Not Cooked', color: 'gray' },
  cooked_as_is: { label: 'Cooked', shortLabel: 'Cooked', color: 'green' },
  cooked_with_modifications: { label: 'Cooked (Modified)', shortLabel: 'Modified', color: 'blue' },
};

// ============================================
// Meal Consumption Tracking Types
// ============================================

export type ConsumptionEntryType = 'meal_plan' | 'custom_meal' | 'quick_cook' | 'ingredient';

/**
 * A logged consumption entry - represents something the user ate
 */
export interface ConsumptionEntry {
  id: string;
  user_id: string;
  entry_type: ConsumptionEntryType;

  // Source references (one will be set based on entry_type)
  meal_plan_meal_id?: string;
  meal_id?: string;
  ingredient_name?: string;

  // When consumed
  consumed_at: string;
  consumed_date: string;

  // Display info
  display_name: string;
  meal_type?: MealType;

  // For ingredients - amount consumed
  amount?: number;
  unit?: string;

  // 800g Challenge tracking
  grams?: number;  // Weight in grams (for fruit/vegetable tracking)
  ingredient_category?: IngredientCategoryType;  // Category for 800g calculation

  // Macro snapshot at time of logging
  calories: number;
  protein: number;
  carbs: number;
  fat: number;

  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Frequently logged ingredient for quick-add UI
 */
export interface FrequentIngredient {
  id: string;
  user_id: string;
  ingredient_name: string;
  ingredient_name_normalized: string;
  default_amount: number;
  default_unit: string;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  times_logged: number;
  last_logged_at: string;
  is_user_added?: boolean;
  ingredient_id?: string;
  // 800g Challenge tracking
  category?: IngredientCategoryType;
  default_grams?: number;
}

/**
 * 800g Challenge fruit/vegetable tracking
 */
export interface FruitVegProgress {
  currentGrams: number;
  goalGrams: number;  // 800 by default
  percentage: number;
  goalCelebrated: boolean;
}

/**
 * Daily consumption summary with progress toward targets
 */
export interface DailyConsumptionSummary {
  date: string;
  targets: Macros;
  consumed: Macros;
  remaining: Macros;
  percentages: Macros;
  entries: ConsumptionEntry[];
  entry_count: number;
  // 800g Challenge tracking
  fruitVeg?: FruitVegProgress;
}

/**
 * A meal available to log (from any source)
 */
export interface MealToLog {
  id: string;
  source: ConsumptionEntryType;
  source_id: string;  // meal_plan_meal_id or meal_id
  name: string;
  meal_type?: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  is_logged: boolean;
  logged_entry_id?: string;
  logged_at?: string;
}

/**
 * A meal from a meal plan with additional context (for historical plan search)
 */
export interface MealPlanMealToLog extends MealToLog {
  plan_week_start: string;      // e.g., "2026-01-06"
  plan_title?: string;          // e.g., "Mediterranean Week"
  day_of_week: string;          // e.g., "monday"
  day_label: string;            // e.g., "Mon"
  meal_id: string;              // The underlying meal id for deduplication
}

/**
 * An ingredient available to log
 */
export interface IngredientToLog {
  name: string;
  default_amount: number;
  default_unit: string;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  source: 'frequent' | 'meal_plan' | 'cache' | 'usda' | 'barcode' | 'manual';
  is_user_added?: boolean;
  is_validated?: boolean;  // true if nutrition data is FuelRx-validated
  is_pinned?: boolean;     // true if user has pinned this ingredient as a favorite
  barcode?: string;
  // 800g Challenge tracking
  category?: IngredientCategoryType;
  default_grams?: number;
}

/**
 * All available items to log, organized by source
 */
export interface AvailableMealsToLog {
  from_todays_plan: MealToLog[];
  from_week_plan: MealToLog[];
  latest_plan_meals: MealPlanMealToLog[];  // Meals from most recent plan (for Meal Plan Meals section)
  custom_meals: MealToLog[];
  quick_cook_meals: MealToLog[];
  recent_meals: MealToLog[];
  frequent_ingredients: IngredientToLog[];
  pinned_ingredients: IngredientToLog[];   // User's favorite/pinned ingredients
}

/**
 * Request payload for logging a meal
 */
export interface LogMealRequest {
  type: 'meal_plan' | 'custom_meal' | 'quick_cook';
  source_id: string;
  meal_id?: string; // Fallback meal ID for when meal_plan_meals record is deleted
  meal_type?: MealType; // Override the meal's default type
  consumed_at?: string;
  notes?: string;
}

/**
 * Request payload for logging an ingredient
 */
export interface LogIngredientRequest {
  type: 'ingredient';
  ingredient_name: string;
  amount: number;
  unit: string;
  meal_type: MealType; // What meal this ingredient was part of
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  consumed_at?: string;
  notes?: string;
  // 800g Challenge tracking
  grams?: number;
  category?: IngredientCategoryType;
}

export type LogConsumptionRequest = LogMealRequest | LogIngredientRequest;

// ============================================
// Period Consumption Summary Types (Weekly/Monthly)
// ============================================

export type ConsumptionPeriodType = 'daily' | 'weekly' | 'monthly';

/**
 * A single day's macro data for trend charts
 */
export interface DailyDataPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  entry_count: number;
  // Per-meal-type breakdown for filtering
  byMealType?: {
    breakfast: Macros;
    pre_workout: Macros;
    lunch: Macros;
    post_workout: Macros;
    snack: Macros;
    dinner: Macros;
  };
}

/**
 * Macro totals broken down by meal type
 */
export interface MealTypeBreakdown {
  breakfast: Macros;
  pre_workout: Macros;
  lunch: Macros;
  post_workout: Macros;
  snack: Macros;
  dinner: Macros;
  unassigned: Macros; // For legacy entries without meal_type
}

/**
 * Weekly or monthly consumption summary with trend data
 */
export interface PeriodConsumptionSummary {
  periodType: 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  dayCount: number;
  daysWithData: number;
  targets: Macros; // Daily targets * dayCount
  consumed: Macros; // Actual totals
  averagePerDay: Macros; // consumed / daysWithData
  percentages: Macros; // (consumed / targets) * 100
  dailyData: DailyDataPoint[]; // For line chart
  entry_count: number;
  byMealType: MealTypeBreakdown; // Breakdown by meal type
}

// ============================================
// Barcode Scanning Types
// ============================================

/**
 * Product data from Open Food Facts API
 */
export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  serving_size?: number;
  serving_unit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image_url?: string;
  found: boolean;
}

/**
 * Request to add a user-created ingredient
 */
export interface AddUserIngredientRequest {
  name: string;
  category?: IngredientCategoryType;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
}

// ============================================
// Meal Photo Analysis Types (Snap a Meal)
// ============================================

export type MealPhotoAnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

/**
 * Ingredient extracted from meal photo AI analysis
 */
export interface MealPhotoIngredient {
  id: string;
  meal_photo_id: string;
  name: string;
  estimated_amount: string;
  estimated_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence_score: number;
  category?: string;
  display_order: number;
}

/**
 * Meal photo record with analysis results
 */
export interface MealPhotoAnalysis {
  id: string;
  user_id: string;
  storage_path: string;
  image_url: string;
  analysis_status: MealPhotoAnalysisStatus;
  analysis_error?: string;
  analyzed_at?: string;
  raw_analysis?: MealPhotoAnalysisResult;
  meal_name?: string;
  meal_description?: string;
  total_calories?: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  confidence_score?: number;
  consumption_entry_id?: string;
  saved_meal_id?: string;
  ingredients: MealPhotoIngredient[];
  created_at: string;
  updated_at: string;
}

/**
 * Raw AI analysis result from Claude Vision
 */
export interface MealPhotoAnalysisResult {
  meal_name: string;
  meal_description?: string;
  ingredients: Array<{
    name: string;
    estimated_amount: string;
    estimated_unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence: number;
    category?: string;
  }>;
  total_macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  overall_confidence: number;
  analysis_notes?: string;
}

/**
 * Options for saving an analyzed meal photo
 */
export interface SaveMealPhotoOptions {
  saveTo: 'consumption' | 'library' | 'both';
  mealType?: MealType;
  editedName?: string;
  editedIngredients?: Array<{
    name: string;
    estimated_amount: string;
    estimated_unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    category?: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'fat' | 'dairy' | 'other';
  }>;
  notes?: string;
  consumedAt?: string;
}

// ============================================
// Cooking Assistant Types
// ============================================

/**
 * A chat session between a user and the cooking assistant for a specific meal
 */
export interface CookingChatSession {
  id: string;
  user_id: string;
  meal_id: string;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
}

/**
 * A single message in a cooking chat session
 */
export interface CookingChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/**
 * Response from creating/resuming a cooking assistant session
 */
export interface CookingAssistantSessionResponse {
  sessionId: string;
  messages: CookingChatMessage[];
  suggestedQuestions: string[];
}

/**
 * Response from sending a message to the cooking assistant
 */
export interface CookingAssistantMessageResponse {
  reply: string;
  created_at: string;
}

// ============================================
// Admin Types
// ============================================

/**
 * Admin ingredient with nutrition data joined
 */
export interface AdminIngredient {
  id: string;
  name: string;
  name_normalized: string;
  category: IngredientCategoryType | null;
  validated: boolean;
  is_user_added: boolean;
  added_by_user_id: string | null;
  added_at: string | null;
  created_at: string;
  updated_at: string;
  nutrition?: IngredientNutrition[];
}

/**
 * Paginated response for admin ingredient list
 */
export interface PaginatedAdminIngredients {
  data: AdminIngredient[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Admin ingredient filter options
 */
export interface AdminIngredientFilters {
  search?: string;
  category?: IngredientCategoryType;
  validated?: boolean;
  userAddedOnly?: boolean;
  usdaMatchStatus?: 'needs_review' | 'matched' | 'no_match' | 'pending';
  sortBy?: 'name' | 'category' | 'created_at' | 'validated';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * Admin action types for audit logging
 */
export type AdminActionType =
  | 'update_ingredient'
  | 'update_nutrition'
  | 'bulk_update_category'
  | 'bulk_update_validated'
  | 'delete_ingredient'
  | 'bulk_delete_ingredients'
  | 'delete_nutrition';

/**
 * Audit log entry for admin actions
 */
export interface AdminAuditLogEntry {
  id: string;
  admin_user_id: string;
  action: AdminActionType;
  entity_type: 'ingredient' | 'ingredient_nutrition';
  entity_id: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
}

/**
 * Request to update an ingredient (admin)
 */
export interface UpdateIngredientRequest {
  name?: string;
  category?: IngredientCategoryType;
  validated?: boolean;
}

/**
 * Request to update ingredient nutrition (admin)
 */
export interface UpdateIngredientNutritionRequest {
  serving_size?: number;
  serving_unit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/**
 * Request for bulk updating ingredients (admin)
 */
export interface BulkUpdateIngredientsRequest {
  ingredient_ids: string[];
  updates: {
    category?: IngredientCategoryType;
    validated?: boolean;
  };
}

// ============================================================================
// Subscription Types
// ============================================================================

/**
 * Subscription tier options
 * - basic_yearly: $5.99/year - AI features but NO meal plan generation
 * - pro_monthly: $3.99/month - All features including meal plan generation
 * - pro_yearly: $39.99/year - All features including meal plan generation
 */
export type SubscriptionTier = 'basic_yearly' | 'pro_monthly' | 'pro_yearly';

/**
 * Subscription status from RevenueCat
 */
export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'grace_period'
  | 'billing_retry';

/**
 * Payment store/provider where the subscription was purchased
 */
export type SubscriptionStore = 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';

/**
 * User subscription record from database
 */
export interface UserSubscription {
  id: string;
  user_id: string;
  revenuecat_customer_id: string | null;
  is_subscribed: boolean;
  subscription_tier: SubscriptionTier | null;
  subscription_status: SubscriptionStatus | null;
  has_ai_features: boolean;
  has_meal_plan_generation: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  original_purchase_date: string | null;
  free_plans_used: number;
  free_plan_limit: number;
  is_override: boolean;
  override_reason: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Subscription status response from API
 */
export interface SubscriptionStatusResponse {
  isSubscribed: boolean;
  subscriptionTier: SubscriptionTier | null;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  // Payment provider (for routing to correct management portal)
  store: SubscriptionStore | null;
  // Feature access
  hasAiFeatures: boolean;
  hasMealPlanGeneration: boolean;
  // Free tier tracking (only relevant for meal plan generation)
  freePlansUsed: number;
  freePlanLimit: number;
  freePlansRemaining: number;
  // Computed permission
  canGeneratePlan: boolean;
  canUseAiFeatures: boolean;
  // Override status
  isOverride: boolean;
}

// ============================================================================
// Protein Focus Types
// ============================================================================

/**
 * Meal types that can have a protein focus applied.
 * Uses simplified meal type names (not the full MealType union).
 */
export type FocusMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * How many meals of the selected type should feature the focused protein.
 */
export type FocusMealCount = '3-4' | '5-7' | 'all';

/**
 * Protein focus constraint for meal plan generation.
 * Allows users to specify a primary protein for a specific meal type
 * with optional cuisine variety enforcement.
 */
export interface ProteinFocusConstraint {
  /** Which meal type to apply the constraint to */
  mealType: FocusMealType;

  /** The protein to focus on (e.g., "shrimp", "chicken breast") */
  protein: string;

  /** How many meals of this type should feature the protein */
  count: FocusMealCount;

  /** Whether to enforce cuisine variety across the focused meals */
  varyCuisines: boolean;
}

/**
 * Protein focus history entry for tracking user's recent protein selections.
 */
export interface ProteinFocusHistoryEntry {
  id: string;
  user_id: string;
  protein: string;
  meal_type: FocusMealType;
  used_at: string;
}

// ============================================
// Grocery Staples Types
// ============================================

/**
 * Frequency options for grocery staples
 */
export type StapleFrequency = 'every_week' | 'as_needed';

/**
 * A user's grocery staple item (from user_grocery_staples table)
 */
export interface GroceryStaple {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  display_name: string;  // Computed column
  category: GroceryCategory;
  add_frequency: StapleFrequency;
  times_added: number;
  last_added_at: string | null;
  barcode: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating/updating a grocery staple
 */
export interface GroceryStapleInput {
  name: string;
  brand?: string | null;
  variant?: string | null;
  category: GroceryCategory;
  add_frequency: StapleFrequency;
}

/**
 * A staple linked to a specific meal plan (from meal_plan_staples table)
 */
export interface MealPlanStaple {
  id: string;
  meal_plan_id: string;
  staple_id: string;
  is_checked: boolean;
  created_at: string;
}

/**
 * Staple with full details (joined query result)
 */
export interface MealPlanStapleWithDetails extends MealPlanStaple {
  staple: GroceryStaple;
}

/**
 * A one-off custom item added to a specific meal plan (not a saved staple)
 */
export interface MealPlanCustomItem {
  id: string;
  meal_plan_id: string;
  name: string;
  is_checked: boolean;
  created_at: string;
}
