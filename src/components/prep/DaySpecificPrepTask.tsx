'use client'

import { useState } from 'react'
import type { ConsolidatedMeal } from './prepUtils'
import { DAY_LABELS, formatCookingTemps, formatCookingTimes } from './prepUtils'
import type { DayOfWeek } from '@/lib/types'

interface Props {
  meal: ConsolidatedMeal
  day: DayOfWeek
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
}

export default function DaySpecificPrepTask({
  meal,
  day,
  completedTasks,
  completedSteps,
  onToggleTaskComplete,
  onToggleStepComplete,
}: Props) {
  // Start collapsed for single-day items (variety meals) - click header to expand
  const [isExpanded, setIsExpanded] = useState(false)

  const primaryTask = meal.tasks[0]
  if (!primaryTask) return null

  const isCompleted = completedTasks.has(primaryTask.id)

  // Get cooking info
  const cookingTemps = formatCookingTemps(primaryTask.cooking_temps)
  const cookingTimes = formatCookingTimes(primaryTask.cooking_times)

  const hasDetails = (primaryTask.detailed_steps && primaryTask.detailed_steps.length > 0) ||
    cookingTemps.length > 0 ||
    cookingTimes.length > 0 ||
    (primaryTask.tips && primaryTask.tips.length > 0) ||
    (primaryTask.equipment_needed && primaryTask.equipment_needed.length > 0) ||
    (primaryTask.ingredients_to_prep && primaryTask.ingredients_to_prep.length > 0)

  // Calculate step progress
  const totalSteps = primaryTask.detailed_steps?.length || 0
  const completedStepsCount = primaryTask.detailed_steps?.filter((_, i) =>
    completedSteps.has(`${primaryTask.id}_${i}`)
  ).length || 0

  return (
    <div className={`bg-gray-50 rounded-lg overflow-hidden ${isCompleted ? 'opacity-60' : ''}`}>
      {/* Clickable header to expand/collapse */}
      <div
        className={`flex items-center gap-3 p-4 ${hasDetails && !isCompleted ? 'cursor-pointer hover:bg-gray-100' : ''}`}
        onClick={() => hasDetails && !isCompleted && setIsExpanded(!isExpanded)}
      >
        {/* Checkbox - stop propagation so clicking it doesn't toggle expand */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleTaskComplete(primaryTask.sessionId, primaryTask.id)
          }}
          className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-teal-500 border-teal-500'
              : 'border-gray-300 hover:border-teal-400'
          }`}
        >
          {isCompleted && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Meal info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-gray-900 ${isCompleted ? 'line-through' : ''}`}>
              {meal.mealName}
            </span>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
              {DAY_LABELS[day].slice(0, 3)}
            </span>
            {primaryTask.estimated_minutes && primaryTask.estimated_minutes > 0 && (
              <span className="text-xs text-gray-400">~{primaryTask.estimated_minutes} min</span>
            )}
          </div>

          {/* Progress indicator shown in header when collapsed */}
          {totalSteps > 0 && !isCompleted && !isExpanded && (
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
        {hasDetails && !isCompleted && (
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
      {isExpanded && hasDetails && !isCompleted && (
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

          <div className="pl-3 border-l-2 border-teal-200 space-y-4">
            {/* Equipment needed */}
            {primaryTask.equipment_needed && primaryTask.equipment_needed.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Equipment</h5>
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
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Ingredients</h5>
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
                <h5 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Storage</h5>
                <p className="text-sm text-blue-800">{primaryTask.storage}</p>
              </div>
            )}

            {/* Tips */}
            {primaryTask.tips && primaryTask.tips.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Pro Tips</h5>
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
