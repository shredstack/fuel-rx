/**
 * JSON Schemas for LLM Tool Use
 *
 * These schemas are used with Claude's tool use feature to guarantee
 * valid JSON output. The API enforces schema compliance, eliminating
 * JSON parsing errors.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages';

// ============================================
// Core Ingredients Schema (Stage 1)
// ============================================

export const coreIngredientsSchema: Tool = {
  name: 'select_core_ingredients',
  description: 'Select core ingredients for a weekly meal plan based on user preferences and macro targets',
  input_schema: {
    type: 'object' as const,
    properties: {
      proteins: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of protein sources (e.g., "Chicken breast", "Salmon", "Eggs")',
      },
      vegetables: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of vegetables (e.g., "Broccoli", "Spinach", "Bell peppers")',
      },
      fruits: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of fruits (e.g., "Bananas", "Mixed berries", "Apples")',
      },
      grains: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of grains and starches including legumes (e.g., "Brown rice", "Quinoa", "Black beans")',
      },
      fats: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of healthy fats (e.g., "Avocado", "Olive oil", "Almonds")',
      },
      dairy: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of dairy products (e.g., "Greek yogurt", "Cottage cheese")',
      },
    },
    required: ['proteins', 'vegetables', 'fruits', 'grains', 'fats', 'dairy'],
  },
};

// ============================================
// Meals Schema (Stage 2)
// ============================================

const ingredientWithNutritionSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Ingredient name' },
    amount: { type: 'string', description: 'Amount as a string (e.g., "1", "0.5", "2")' },
    unit: { type: 'string', description: 'Unit of measurement (e.g., "cup", "oz", "tbsp")' },
    category: {
      type: 'string',
      enum: ['produce', 'protein', 'dairy', 'grains', 'fats', 'frozen', 'other'],
      description: 'Ingredient category for grocery organization',
    },
    calories: { type: 'number', description: 'Calories for this amount' },
    protein: { type: 'number', description: 'Protein in grams for this amount' },
    carbs: { type: 'number', description: 'Carbohydrates in grams for this amount' },
    fat: { type: 'number', description: 'Fat in grams for this amount' },
  },
  required: ['name', 'amount', 'unit', 'category', 'calories', 'protein', 'carbs', 'fat'],
};

const macrosSchema = {
  type: 'object' as const,
  properties: {
    calories: { type: 'number', description: 'Total calories' },
    protein: { type: 'number', description: 'Total protein in grams' },
    carbs: { type: 'number', description: 'Total carbohydrates in grams' },
    fat: { type: 'number', description: 'Total fat in grams' },
  },
  required: ['calories', 'protein', 'carbs', 'fat'],
};

const mealSchema = {
  type: 'object' as const,
  properties: {
    day: {
      type: 'string',
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      description: 'Day of the week',
    },
    type: {
      type: 'string',
      enum: ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'],
      description: 'Meal type',
    },
    snack_number: {
      type: 'number',
      description: 'For days with multiple snacks, which snack this is (1, 2, or 3)',
    },
    name: { type: 'string', description: 'Descriptive meal name' },
    ingredients: {
      type: 'array',
      items: ingredientWithNutritionSchema,
      description: 'List of ingredients with nutrition data',
    },
    instructions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Step-by-step cooking instructions',
    },
    prep_time_minutes: { type: 'number', description: 'Preparation time in minutes' },
    macros: macrosSchema,
  },
  required: ['day', 'type', 'name', 'ingredients', 'instructions', 'prep_time_minutes', 'macros'],
};

export const mealsSchema: Tool = {
  name: 'generate_meals',
  description: 'Generate a 7-day meal plan with detailed nutrition information',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'A creative, descriptive title for this meal plan (e.g., "Mediterranean Power Week", "High-Protein Summer Eats"). Should reflect the theme or overall character of the meals.',
      },
      meals: {
        type: 'array',
        items: mealSchema,
        description: 'Array of all meals for the week, ordered by day then meal type',
      },
    },
    required: ['title', 'meals'],
  },
};

// ============================================
// Prep Sessions Schema (Stage 3)
// ============================================

const cookingTempsSchema = {
  type: 'object' as const,
  properties: {
    oven: { type: 'string', description: 'Oven temperature (e.g., "400°F")' },
    stovetop: { type: 'string', description: 'Stovetop heat level (e.g., "medium-high heat")' },
    internal_temp: { type: 'string', description: 'Target internal temperature (e.g., "165°F for chicken")' },
    grill: { type: 'string', description: 'Grill temperature (e.g., "medium-high, 400-450°F")' },
  },
  required: [],
};

const cookingTimesSchema = {
  type: 'object' as const,
  properties: {
    prep_time: { type: 'string', description: 'Preparation time (e.g., "10 min")' },
    cook_time: { type: 'string', description: 'Cooking time (e.g., "20-25 min")' },
    rest_time: { type: 'string', description: 'Resting time if applicable (e.g., "5 min")' },
    total_time: { type: 'string', description: 'Total time (e.g., "35 min")' },
  },
  required: [],
};

const prepTaskSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Unique task identifier (e.g., "meal_monday_breakfast_0")' },
    description: { type: 'string', description: 'Task title (e.g., "Monday Breakfast: Overnight Oats")' },
    equipment_needed: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of equipment/cookware needed',
    },
    ingredients_to_prep: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of ingredients with amounts to gather before starting',
    },
    detailed_steps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Step-by-step cooking instructions with specific details',
    },
    cooking_temps: cookingTempsSchema,
    cooking_times: cookingTimesSchema,
    tips: {
      type: 'array',
      items: { type: 'string' },
      description: 'Pro tips for this task',
    },
    storage: { type: 'string', description: 'Storage instructions (e.g., "Refrigerate up to 5 days")' },
    estimated_minutes: { type: 'number', description: 'Estimated time in minutes' },
    meal_ids: {
      type: 'array',
      items: { type: 'string' },
      description: 'Meal IDs this task prepares (e.g., ["meal_monday_breakfast_0"])',
    },
    completed: { type: 'boolean', description: 'Whether task is completed (always false initially)' },
    prep_category: {
      type: 'string',
      enum: ['sunday_batch', 'day_of_quick', 'day_of_cooking'],
      description: 'Category for batch prep: sunday_batch (prep Sunday), day_of_quick (<10 min fresh), day_of_cooking (longer fresh cooking)',
    },
  },
  required: ['id', 'description', 'detailed_steps', 'estimated_minutes', 'meal_ids', 'completed'],
};

const prepSessionSchema = {
  type: 'object' as const,
  properties: {
    session_name: { type: 'string', description: 'Session name (e.g., "Monday Morning Prep")' },
    session_type: {
      type: 'string',
      enum: ['weekly_batch', 'night_before', 'day_of_morning', 'day_of_dinner'],
      description: 'Type of prep session',
    },
    session_day: {
      type: 'string',
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      description: 'Day of the prep session',
    },
    session_time_of_day: {
      type: 'string',
      enum: ['morning', 'afternoon', 'night'],
      description: 'Time of day for the session',
    },
    prep_for_date: { type: 'string', description: 'ISO date string for when the prep is for' },
    estimated_minutes: { type: 'number', description: 'Total estimated time for session' },
    prep_tasks: {
      type: 'array',
      items: prepTaskSchema,
      description: 'List of prep tasks in this session',
    },
    display_order: { type: 'number', description: 'Order to display this session (1-based)' },
  },
  required: ['session_name', 'session_type', 'estimated_minutes', 'prep_tasks', 'display_order'],
};

const dailyAssemblyEntrySchema = {
  type: 'object' as const,
  properties: {
    time: { type: 'string', description: 'Time estimate (e.g., "5 min")' },
    instructions: { type: 'string', description: 'Assembly/reheating instructions' },
  },
  required: ['time', 'instructions'],
};

const dailyAssemblyDaySchema = {
  type: 'object' as const,
  properties: {
    breakfast: dailyAssemblyEntrySchema,
    pre_workout: dailyAssemblyEntrySchema,
    lunch: dailyAssemblyEntrySchema,
    post_workout: dailyAssemblyEntrySchema,
    snack: dailyAssemblyEntrySchema,
    dinner: dailyAssemblyEntrySchema,
  },
  required: [],
};

export const prepSessionsSchema: Tool = {
  name: 'generate_prep_sessions',
  description: 'Generate meal prep sessions with detailed cooking instructions',
  input_schema: {
    type: 'object' as const,
    properties: {
      prep_sessions: {
        type: 'array',
        items: prepSessionSchema,
        description: 'Array of prep sessions for the week',
      },
      daily_assembly: {
        type: 'object',
        properties: {
          monday: dailyAssemblyDaySchema,
          tuesday: dailyAssemblyDaySchema,
          wednesday: dailyAssemblyDaySchema,
          thursday: dailyAssemblyDaySchema,
          friday: dailyAssemblyDaySchema,
          saturday: dailyAssemblyDaySchema,
          sunday: dailyAssemblyDaySchema,
        },
        description: 'Assembly/reheating instructions for each day',
        required: [],
      },
    },
    required: ['prep_sessions'],
  },
};

// ============================================
// Grocery List Schema
// ============================================

const groceryItemSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Ingredient name (capitalized)' },
    amount: { type: 'string', description: 'Quantity as string (e.g., "2", "1.5")' },
    unit: { type: 'string', description: 'Shopping unit (e.g., "lb", "whole", "bag", "container")' },
    category: {
      type: 'string',
      enum: ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other'],
      description: 'Grocery category for organization',
    },
  },
  required: ['name', 'amount', 'unit', 'category'],
};

export const groceryListSchema: Tool = {
  name: 'generate_grocery_list',
  description: 'Generate a consolidated grocery shopping list with practical quantities',
  input_schema: {
    type: 'object' as const,
    properties: {
      grocery_list: {
        type: 'array',
        items: groceryItemSchema,
        description: 'Array of grocery items sorted by category',
      },
    },
    required: ['grocery_list'],
  },
};

// ============================================
// Legacy Schemas (for backward compatibility)
// ============================================

// Simple ingredient schema without nutrition (for legacy grocery consolidation)
const simpleIngredientSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Ingredient name' },
    amount: { type: 'string', description: 'Amount as a string' },
    unit: { type: 'string', description: 'Unit of measurement' },
    category: {
      type: 'string',
      enum: ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other'],
      description: 'Ingredient category',
    },
  },
  required: ['name', 'amount', 'unit', 'category'],
};

// Simple meal schema without ingredient nutrition (for legacy meal generation)
const simpleMealSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Meal name' },
    type: {
      type: 'string',
      enum: ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'],
      description: 'Meal type',
    },
    prep_time_minutes: { type: 'number', description: 'Preparation time in minutes' },
    ingredients: {
      type: 'array',
      items: simpleIngredientSchema,
      description: 'List of ingredients',
    },
    instructions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Step-by-step cooking instructions',
    },
    macros: macrosSchema,
  },
  required: ['name', 'type', 'prep_time_minutes', 'ingredients', 'instructions', 'macros'],
};

export const simpleMealsSchema: Tool = {
  name: 'generate_simple_meals',
  description: 'Generate meals for a specific meal type',
  input_schema: {
    type: 'object' as const,
    properties: {
      meals: {
        type: 'array',
        items: simpleMealSchema,
        description: 'Array of meals',
      },
    },
    required: ['meals'],
  },
};

export const consolidatedGrocerySchema: Tool = {
  name: 'consolidate_grocery_list',
  description: 'Consolidate raw ingredients into a practical shopping list',
  input_schema: {
    type: 'object' as const,
    properties: {
      grocery_list: {
        type: 'array',
        items: simpleIngredientSchema,
        description: 'Consolidated grocery list',
      },
    },
    required: ['grocery_list'],
  },
};
