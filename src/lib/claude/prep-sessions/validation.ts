/**
 * Post-generation validation for prep sessions
 * Catches common LLM issues with batch prep output
 */

import type { DailyAssembly, PrepTask, PrepSessionType, DayOfWeek } from '../../types';

interface ValidationWarning {
  type: 'assembly_meal_batched' | 'missing_daily_assembly' | 'cooking_batched_item';
  message: string;
  mealId?: string;
  severity: 'warning' | 'error';
}

interface PrepSessionForValidation {
  session_name: string;
  session_type: PrepSessionType;
  prep_tasks: PrepTask[];
}

/**
 * Meal name patterns that should NEVER be batch prepped
 * These are assembly-only or quick-cook meals
 */
const NEVER_BATCH_PATTERNS = [
  /yogurt.*bowl/i,
  /yogurt.*parfait/i,
  /cottage cheese/i,
  /fresh.*fruit/i,
  /fruit.*salad/i,
  /toast/i,
  /avocado.*toast/i,
  /scrambled.*egg/i,
  /fried.*egg/i,
  /poached.*egg/i,
  /omelette/i,
  /omelet/i,
  /smoothie/i,
  /protein.*shake/i,
  /quesadilla/i,
  /grilled.*cheese/i,
];

/**
 * Keywords that indicate cooking instructions (not assembly/reheating)
 */
const COOKING_KEYWORDS = [
  'bake at',
  'cook for',
  'grill for',
  'sauté',
  'saute',
  'roast at',
  'heat to',
  'simmer for',
  'boil for',
  'fry for',
  'sear for',
  'internal temp',
  '°f',
  '°c',
  'minutes per side',
  'until golden',
  'until browned',
  'until crispy',
];

/**
 * Keywords that indicate assembly/reheating (these are OK for batch-prepped items)
 */
const ASSEMBLY_KEYWORDS = [
  'microwave',
  'reheat',
  'warm',
  'take from fridge',
  'remove from fridge',
  'prepped',
  'batch-prepped',
  'assemble',
  'top with',
  'drizzle',
  'garnish',
];

/**
 * Validate prep sessions for common batch prep issues
 * Returns warnings that can be logged for monitoring
 */
export function validatePrepSessions(
  prepSessions: PrepSessionForValidation[],
  dailyAssembly: DailyAssembly
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Find the batch prep session
  const batchSession = prepSessions.find(s => s.session_type === 'weekly_batch');
  if (!batchSession) {
    // No batch session means we're in day_of mode, skip validation
    return warnings;
  }

  const batchedMealIds = new Set<string>();

  // Check 1: Are assembly-only meals being batched?
  for (const task of batchSession.prep_tasks || []) {
    const description = task.description.toLowerCase();

    for (const pattern of NEVER_BATCH_PATTERNS) {
      if (pattern.test(description)) {
        warnings.push({
          type: 'assembly_meal_batched',
          message: `"${task.description}" appears to be an assembly-only meal and should not be batch prepped`,
          mealId: task.meal_ids?.[0],
          severity: 'warning',
        });
        break; // Only one warning per task
      }
    }

    // Track what's being batched
    for (const mealId of task.meal_ids || []) {
      batchedMealIds.add(mealId);
    }
  }

  // Check 2: Do all batched meals have daily assembly entries?
  for (const mealId of batchedMealIds) {
    // Parse mealId: "meal_monday_breakfast_0"
    const match = mealId.match(/meal_(\w+)_(\w+)_/);
    if (!match) continue;

    const [, day, mealType] = match;
    const assemblyDay = dailyAssembly?.[day as DayOfWeek];
    const assemblyEntry = assemblyDay?.[mealType as keyof typeof assemblyDay];

    if (!assemblyEntry) {
      warnings.push({
        type: 'missing_daily_assembly',
        message: `Batch-prepped meal "${mealId}" is missing a daily_assembly entry for ${day} ${mealType}`,
        mealId,
        severity: 'warning',
      });
    }
  }

  // Check 3: Do day-of tasks contain cooking instructions for batched items?
  const dayOfSessions = prepSessions.filter(s =>
    s.session_type === 'day_of_morning' || s.session_type === 'day_of_dinner'
  );

  for (const session of dayOfSessions) {
    for (const task of session.prep_tasks || []) {
      // Check if any of this task's meals were also batched
      const taskMealIds = task.meal_ids || [];
      const wasBatched = taskMealIds.some(id => batchedMealIds.has(id));

      if (wasBatched) {
        // Check if the task contains cooking instructions (not assembly/reheating)
        const steps = task.detailed_steps?.join(' ').toLowerCase() || '';
        const description = task.description.toLowerCase();
        const fullText = `${description} ${steps}`;

        // First check if it's clearly assembly/reheating
        const isAssembly = ASSEMBLY_KEYWORDS.some(keyword =>
          fullText.includes(keyword.toLowerCase())
        );

        // If it's not clearly assembly, check for cooking keywords
        if (!isAssembly) {
          for (const keyword of COOKING_KEYWORDS) {
            if (fullText.includes(keyword.toLowerCase())) {
              warnings.push({
                type: 'cooking_batched_item',
                message: `Day-of task "${task.description}" contains cooking instructions ("${keyword}") but meal was batch-prepped on Sunday`,
                mealId: taskMealIds[0],
                severity: 'error',
              });
              break; // Only one warning per task
            }
          }
        }
      }
    }
  }

  return warnings;
}

/**
 * Format validation warnings for logging
 */
export function formatValidationWarnings(warnings: ValidationWarning[]): string {
  if (warnings.length === 0) return 'No validation warnings';

  const lines = warnings.map(w => {
    const prefix = w.severity === 'error' ? '[ERROR]' : '[WARN]';
    return `${prefix} ${w.type}: ${w.message}`;
  });

  return lines.join('\n');
}
