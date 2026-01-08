# Claude Module - Meal Plan Generation

This module handles all LLM-powered meal plan generation for FuelRx. It uses a multi-stage approach to generate complete weekly meal plans with grocery lists and prep instructions.

## Architecture Overview

```
src/lib/claude/
├── index.ts                    # Public API exports
├── client.ts                   # Anthropic client & LLM utilities
├── orchestrator.ts             # Main orchestration functions
├── core-ingredients.ts         # Stage 1: Ingredient selection
├── meals-generation.ts         # Stage 2: Meal creation
├── grocery-list.ts             # Grocery list generation
├── prep-sessions/              # Stage 3: Prep instructions
│   ├── index.ts                # Main generatePrepSessions function
│   ├── prompt-builder.ts       # Builds the complete prompt
│   ├── batch-prep-rules.ts     # Rules for traditional_batch style
│   └── day-of-rules.ts         # Rules for day_of style
├── helpers.ts                  # Utility functions
└── ingredient-cache.ts         # Nutrition caching
```

## Generation Pipeline

Meal plans are generated in 3 stages:

```
Stage 1: Core Ingredients     Stage 2: Meals              Stage 3: Prep + Grocery
─────────────────────────     ──────────────────          ───────────────────────
generateCoreIngredients() →   generateMealsFrom...() →    [parallel]
                                                          ├─ generatePrepSessions()
Selects proteins, veggies,    Creates 7 days of meals     └─ generateGroceryList...()
fruits, grains, fats, dairy   using ONLY selected
based on user macros/prefs    ingredients                 Prep style determines format
```

## Key Files

### `orchestrator.ts`
Entry point for meal plan generation. Contains:
- `generateMealPlanWithProgress()` - Main function with progress callbacks
- `generateMealPlanTwoStage()` - Wrapper without progress callbacks
- `generatePrepModeForExistingPlan()` - Regenerate prep for saved plans

### `client.ts`
LLM communication layer:
- `callLLMWithToolUse()` - Makes Claude API calls with tool use for guaranteed JSON
- `logLLMCall()` - Logs all LLM calls to database
- Handles test mode configuration and retry logic

### `core-ingredients.ts`
Stage 1 - Selects weekly ingredients based on:
- User's macro targets
- Dietary restrictions
- Ingredient variety preferences
- Theme (if selected)
- Recent meal history (for variety)
- Liked/disliked ingredients

### `meals-generation.ts`
Stage 2 - Creates meals constrained to selected ingredients:
- Respects meal consistency preferences (same breakfast daily vs. varied)
- Handles multiple snacks per day
- Applies meal complexity preferences per meal type
- Caches ingredient nutrition data for future use

### `grocery-list.ts`
Converts meal ingredients into practical shopping list:
- Consolidates similar ingredients
- Scales for household size
- Uses practical shopping units (bags, bunches, lbs)
- Caps unreasonable quantities

### `prep-sessions/`
Stage 3 - Generates cooking instructions based on prep style:

| Prep Style | Description | Key File |
|------------|-------------|----------|
| `traditional_batch` | Sunday meal prep + quick assembly during week | `batch-prep-rules.ts` |
| `day_of` | Cook fresh for each meal | `day-of-rules.ts` |

The `prompt-builder.ts` assembles the complete prompt with:
- Meal plan details
- Core ingredients
- Prep style specific rules
- Equipment and step formatting requirements

### `helpers.ts`
Utility functions:
- `organizeMealsIntoDays()` - Converts flat meal array to DayPlan structure
- `collectRawIngredients()` - Extracts all ingredients from meals
- `getMealTypesForPlan()` - Determines meal types based on meals per day
- Household serving calculations

### `ingredient-cache.ts`
Nutrition data caching:
- `fetchCachedNutrition()` - Gets cached nutrition for ingredients
- `cacheIngredientNutrition()` - Saves new nutrition data
- `buildNutritionReferenceSection()` - Creates prompt section with cached data

## Common Modifications

### Modifying a prompt
Each stage's prompt is built within its respective file:
- Core ingredients prompt: `core-ingredients.ts`
- Meals prompt: `meals-generation.ts`
- Prep sessions prompt: `prep-sessions/prompt-builder.ts`

### Adding a new prep style
1. Create new rules file in `prep-sessions/` (e.g., `new-style-rules.ts`)
2. Add the style to `prompt-builder.ts` conditional
3. Update `PrepStyle` type in `src/lib/types.ts`

### Changing LLM model or parameters
Edit `client.ts`:
- Default model is set in `callLLMWithToolUse()`
- Test mode overrides are in the same function
- Token limits per prompt type are mapped in the switch statement

### Adding new tool schemas
Tool schemas are defined in `src/lib/llm-schemas.ts` (not in this directory).

## Test Mode

The module supports test modes configured via `MEAL_PLAN_TEST_MODE` env var:
- `fixture` - Returns mock data, no API calls
- `haiku-minimal` - Uses faster/cheaper model with reduced tokens
- See `src/lib/claude_test.ts` for configuration

## Dependencies

- `@anthropic-ai/sdk` - Claude API client
- `../supabase/server` - Database client
- `../llm-schemas` - Tool schemas for structured output
- `../claude_test` - Test mode utilities
- `../types` - TypeScript type definitions
