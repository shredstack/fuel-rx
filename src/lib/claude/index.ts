/**
 * Claude Module - Modular architecture for meal plan generation
 *
 * This module provides a clean, modular API for generating meal plans using Claude.
 * Each stage of meal plan generation is separated into its own file for better
 * testability, maintainability, and readability.
 *
 * Module Structure:
 * - client.ts: Anthropic client, LLM calling utilities
 * - core-ingredients.ts: Stage 1 - Generate core ingredients
 * - meals-generation.ts: Stage 2 - Generate meals from ingredients
 * - grocery-list.ts: Generate grocery lists
 * - prep-sessions/: Stage 3 - Generate prep sessions
 * - orchestrator.ts: Main orchestration functions
 * - helpers.ts: Utility functions
 * - ingredient-cache.ts: Ingredient nutrition caching
 */

// Main orchestration functions
export {
  generateMealPlanWithProgress,
  generateMealPlanTwoStage,
  generatePrepModeForExistingPlan,
  type ProgressCallback,
} from './orchestrator';

// Individual stage functions (for testing or direct use)
export { generateCoreIngredients } from './core-ingredients';
export { generateMealsFromCoreIngredients } from './meals-generation';
export { generateGroceryListFromCoreIngredients, consolidateGroceryListWithLLM } from './grocery-list';
export { generatePrepSessions } from './prep-sessions';

// Utility functions
export { organizeMealsIntoDays, collectRawIngredients, getMealTypesForPlan } from './helpers';

// LLM utilities (for advanced use cases)
export { callLLMWithToolUse, logLLMCall } from './client';
