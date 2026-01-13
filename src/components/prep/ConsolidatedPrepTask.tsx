'use client'

import { useState } from 'react'
import type { ConsolidatedMeal } from './prepUtils'
import { formatDayRange, formatCookingTemps, formatCookingTimes, formatHouseholdContextForDays, generateHouseholdScalingGuide } from './prepUtils'
import type { HouseholdServingsPrefs, DailyAssembly } from '@/lib/types'
import { DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import { CookingAssistantButton } from '@/components/CookingAssistant'

interface Props {
  meal: ConsolidatedMeal
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
  householdServings?: HouseholdServingsPrefs
  prepStyle?: string
  dailyAssembly?: DailyAssembly
}

export default function ConsolidatedPrepTask({
  meal,
  completedTasks,
  completedSteps,
  onToggleTaskComplete,
  onToggleStepComplete,
  householdServings = DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
  prepStyle = 'mixed',
  dailyAssembly,
}: Props) {
  // Consolidated meals (same meal across multiple days) start expanded since they're batch prep
  const [isExpanded, setIsExpanded] = useState(true)

  // Use first task as the primary task (for consolidated meals, they should be similar)
  const primaryTask = meal.tasks[0]
  if (!primaryTask) return null

  // Check if ALL tasks for this meal are completed
  const allTasksCompleted = meal.tasks.every(t => completedTasks.has(t.id))
  const someTasksCompleted = meal.tasks.some(t => completedTasks.has(t.id))

  // Calculate step progress from primary task
  const totalSteps = primaryTask.detailed_steps?.length || 0
  const completedStepsCount = primaryTask.detailed_steps?.filter((_, i) =>
    completedSteps.has(`${primaryTask.id}_${i}`)
  ).length || 0

  // Get cooking info
  const cookingTemps = formatCookingTemps(primaryTask.cooking_temps)
  const cookingTimes = formatCookingTimes(primaryTask.cooking_times)

  // Get household context for this meal
  const householdContext = formatHouseholdContextForDays(householdServings, meal.days, meal.mealType)
  const scalingGuide = generateHouseholdScalingGuide(householdServings, meal.days, meal.mealType)

  // Get prep category label for batch prep users
  const getPrepCategoryLabel = (): string | null => {
    if (prepStyle !== 'traditional_batch') return null

    const prepCategory = primaryTask.prep_category

    switch (prepCategory) {
      case 'sunday_batch':
        return 'Batch prep'
      case 'day_of_quick':
        return 'Quick day-of'
      case 'day_of_cooking':
        return 'Day-of cooking'
      default:
        // For traditional_batch users, if no prep_category is set, these are day-of meals
        return 'Day-of'
    }
  }

  const prepCategoryLabel = getPrepCategoryLabel()

  const hasDetails = (primaryTask.detailed_steps && primaryTask.detailed_steps.length > 0) ||
    cookingTemps.length > 0 ||
    cookingTimes.length > 0 ||
    (primaryTask.tips && primaryTask.tips.length > 0) ||
    (primaryTask.equipment_needed && primaryTask.equipment_needed.length > 0) ||
    (primaryTask.ingredients_to_prep && primaryTask.ingredients_to_prep.length > 0)

  // Toggle all tasks at once for consolidated view
  const handleToggleComplete = () => {
    for (const task of meal.tasks) {
      onToggleTaskComplete(task.sessionId, task.id)
    }
  }

  return (
    <div className={`bg-gray-50 rounded-lg overflow-hidden ${allTasksCompleted ? 'opacity-60' : ''}`}>
      {/* Clickable header to expand/collapse */}
      <div
        className={`flex items-center gap-3 p-4 ${hasDetails && !allTasksCompleted ? 'cursor-pointer hover:bg-gray-100' : ''}`}
        onClick={() => hasDetails && !allTasksCompleted && setIsExpanded(!isExpanded)}
      >
        {/* Checkbox - stop propagation so clicking it doesn't toggle expand */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleComplete()
          }}
          className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
            allTasksCompleted
              ? 'bg-teal-500 border-teal-500'
              : someTasksCompleted
              ? 'bg-teal-200 border-teal-400'
              : 'border-gray-300 hover:border-teal-400'
          }`}
        >
          {allTasksCompleted && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {someTasksCompleted && !allTasksCompleted && (
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
            </svg>
          )}
        </button>

        {/* Meal info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className={`font-semibold text-gray-900 ${allTasksCompleted ? 'line-through' : ''}`}>
              {meal.mealName}
            </span>
            <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
              {formatDayRange(meal.days)}
            </span>
            <span className="text-xs text-gray-400">
              {prepCategoryLabel
                ? prepCategoryLabel
                : prepStyle === 'day_of'
                  ? `1 serving${meal.totalServings > 1 ? `, made ${meal.totalServings}x` : ''}`
                  : `${meal.totalServings} serving${meal.totalServings !== 1 ? 's' : ''}`
              }
              {primaryTask.estimated_minutes && primaryTask.estimated_minutes > 0 && (
                <span className="ml-1">~{primaryTask.estimated_minutes} min</span>
              )}
            </span>
            {primaryTask.meal_ids && primaryTask.meal_ids.length > 0 && !allTasksCompleted && (
              <CookingAssistantButton
                mealId={primaryTask.meal_ids[0]}
                mealName={meal.mealName}
                batchContext={{
                  totalServings: meal.totalServings,
                  days: meal.days,
                }}
              />
            )}
          </div>

          {/* Progress indicator shown in header when collapsed */}
          {totalSteps > 0 && !allTasksCompleted && !isExpanded && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${(completedStepsCount / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {completedStepsCount}/{totalSteps}
              </span>
            </div>
          )}
        </div>

        {/* Expand/collapse chevron */}
        {hasDetails && !allTasksCompleted && (
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && !allTasksCompleted && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200">
          {/* Quick info badges */}
          {cookingTemps.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-3">
              {cookingTemps.map((temp, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  {temp}
                </span>
              ))}
            </div>
          )}

          {/* Progress indicator if steps exist */}
          {totalSteps > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${(completedStepsCount / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-xs">
                {completedStepsCount}/{totalSteps} steps
              </span>
            </div>
          )}

          {/* Batch Prep Assembly Guide - show if this meal has batch-prepped components */}
          {(() => {
            // Get assembly instructions from the first day (since it's the same meal all week)
            const firstDay = meal.days[0]
            const assemblyEntry = dailyAssembly?.[firstDay]?.[meal.mealType]

            if (!assemblyEntry) return null

            // Parse instructions into steps (split by period, but keep abbreviations intact)
            const parseAssemblySteps = (instructions: string): string[] => {
              // Split by period followed by space and capital letter, or by period at end
              const steps = instructions
                .split(/\.(?:\s+(?=[A-Z])|\s*$)/)
                .map(s => s.trim())
                .filter(s => s.length > 0)
              return steps
            }

            const assemblySteps = parseAssemblySteps(assemblyEntry.instructions)
            const assemblyStepsCompleted = assemblySteps.filter((_, i) =>
              completedSteps.has(`${primaryTask.id}_assembly_${i}`)
            ).length

            return (
              <div className="bg-teal-50 border border-teal-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-semibold text-teal-800 uppercase tracking-wide flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Batch Prep Assembly
                    <span className="text-teal-600 font-normal ml-1">({assemblyEntry.time})</span>
                  </h5>
                  <span className="text-xs text-teal-600">
                    {assemblyStepsCompleted}/{assemblySteps.length} done
                  </span>
                </div>
                <ol className="space-y-2">
                  {assemblySteps.map((step, i) => {
                    const stepKey = `${primaryTask.id}_assembly_${i}`
                    const stepCompleted = completedSteps.has(stepKey)

                    return (
                      <li key={i} className="flex items-start gap-2">
                        <button
                          onClick={() => onToggleStepComplete(primaryTask.id, -1 - i)} // Use negative indices for assembly steps
                          className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 ${
                            stepCompleted
                              ? 'bg-teal-500 border-teal-500'
                              : 'border-teal-400 hover:border-teal-500 bg-white'
                          }`}
                        >
                          {stepCompleted && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 text-sm ${stepCompleted ? 'line-through text-teal-600' : 'text-teal-800'}`}>
                          {step}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })()}

          <div className="pl-3 border-l-2 border-teal-200 space-y-4">
            {/* Equipment needed */}
            {primaryTask.equipment_needed && primaryTask.equipment_needed.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Equipment
                </h5>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {primaryTask.equipment_needed.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-teal-500 mt-0.5">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ingredients to prep */}
            {primaryTask.ingredients_to_prep && primaryTask.ingredients_to_prep.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Ingredients
                </h5>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {primaryTask.ingredients_to_prep.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-teal-500 mt-0.5">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Household scaling guide - show when cooking for household */}
            {householdContext.hasHousehold && (
              <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                <div className="flex items-start gap-2 mb-2">
                  <svg className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-purple-800">
                      Household Scaling Guide
                    </p>
                    <p className="text-xs text-purple-600">
                      {prepStyle === 'traditional_batch'
                        ? `Quantities below are for 1 serving. For your Sunday batch, multiply by ${meal.totalServings}x for the week:`
                        : 'Quantities below are for 1 serving. Multiply as needed:'
                      }
                    </p>
                  </div>
                </div>
                <div className="ml-6 space-y-1">
                  {scalingGuide.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-purple-700 min-w-[60px]">{entry.days}:</span>
                      <span className="text-purple-800 font-semibold">{entry.multiplier}</span>
                      <span className="text-purple-600 text-xs">({entry.description})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed steps */}
            {primaryTask.detailed_steps && primaryTask.detailed_steps.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Method</h5>
                  <span className="text-xs text-gray-400">
                    {completedStepsCount}/{totalSteps} done
                  </span>
                </div>
                <ol className="space-y-2">
                  {primaryTask.detailed_steps.map((step, i) => {
                    const stepKey = `${primaryTask.id}_${i}`
                    const stepCompleted = completedSteps.has(stepKey)

                    return (
                      <li key={i} className="flex items-start gap-2">
                        <button
                          onClick={() => onToggleStepComplete(primaryTask.id, i)}
                          className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 ${
                            stepCompleted
                              ? 'bg-teal-500 border-teal-500'
                              : 'border-gray-300 hover:border-teal-400'
                          }`}
                        >
                          {stepCompleted && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 text-sm ${stepCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {step}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}

            {/* Cooking times */}
            {cookingTimes.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Timing</h5>
                <div className="flex flex-wrap gap-2">
                  {cookingTimes.map((time, i) => (
                    <span key={i} className="text-sm text-gray-600">{time}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Storage instructions */}
            {primaryTask.storage && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h5 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Storage
                </h5>
                <p className="text-sm text-blue-800">{primaryTask.storage}</p>
              </div>
            )}

            {/* Tips */}
            {primaryTask.tips && primaryTask.tips.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Pro Tips
                </h5>
                <ul className="space-y-1">
                  {primaryTask.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-amber-800">{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
