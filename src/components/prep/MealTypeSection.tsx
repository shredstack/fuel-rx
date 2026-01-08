'use client'

import { useState } from 'react'
import type { MealTypeGroup } from './prepUtils'
import { MEAL_TYPE_CONFIG, formatDayRange } from './prepUtils'
import type { HouseholdServingsPrefs, DailyAssembly } from '@/lib/types'
import { DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import ConsolidatedPrepTask from './ConsolidatedPrepTask'
import DaySpecificPrepTask from './DaySpecificPrepTask'

interface Props {
  group: MealTypeGroup
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
  defaultExpanded?: boolean
  householdServings?: HouseholdServingsPrefs
  prepStyle?: string
  dailyAssembly?: DailyAssembly
}

export default function MealTypeSection({
  group,
  completedTasks,
  completedSteps,
  onToggleTaskComplete,
  onToggleStepComplete,
  defaultExpanded = false,
  householdServings = DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
  prepStyle = 'mixed',
  dailyAssembly,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Calculate completion stats
  const allTasks = group.consolidatedMeals.flatMap(m => m.tasks)
  const completedCount = allTasks.filter(t => completedTasks.has(t.id)).length
  const totalTasks = allTasks.length
  const isComplete = totalTasks > 0 && completedCount === totalTasks

  // Format meal type label
  const mealTypeLabel = group.snackNumber
    ? `Snack ${group.snackNumber}`
    : group.mealType.charAt(0).toUpperCase() + group.mealType.slice(1)

  // Get color for meal type
  const colorClass = MEAL_TYPE_CONFIG[group.mealType]?.color || 'bg-gray-100 text-gray-800'

  // Summarize what's in this section
  const getSummaryText = () => {
    if (group.consolidatedMeals.length === 1) {
      const meal = group.consolidatedMeals[0]
      if (meal.days.length > 1) {
        return `${meal.mealName} (${formatDayRange(meal.days)})`
      }
      return meal.mealName
    }
    return `${group.consolidatedMeals.length} different meals`
  }

  // Get prep category label for batch prep users
  const getPrepCategoryLabel = (): string | null => {
    if (prepStyle !== 'traditional_batch') return null

    // Get prep_category from the first meal's first task
    const firstMeal = group.consolidatedMeals[0]
    const prepCategory = firstMeal?.tasks[0]?.prep_category

    switch (prepCategory) {
      case 'sunday_batch':
        return 'Batch prep'
      case 'day_of_quick':
        return 'Quick day-of'
      case 'day_of_cooking':
        return 'Day-of cooking'
      default:
        // For traditional_batch users, if no prep_category is set, these are day-of meals
        // (batch prep meals are shown in BatchPrepSection, not here)
        return 'Day-of'
    }
  }

  const prepCategoryLabel = getPrepCategoryLabel()

  return (
    <div className="card">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-lg text-left"
      >
        <div className="flex items-center gap-3">
          {/* Completion indicator */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            isComplete
              ? 'bg-green-100 text-green-600'
              : 'bg-primary-100 text-primary-600'
          }`}>
            {isComplete ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                {mealTypeLabel.charAt(0)}
              </span>
            )}
          </div>

          {/* Summary info */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {mealTypeLabel}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                {prepCategoryLabel
                  ? prepCategoryLabel
                  : prepStyle === 'day_of'
                    ? `1 serving${group.totalServings > 1 ? `, made ${group.totalServings}x` : ''}`
                    : `${group.totalServings} serving${group.totalServings !== 1 ? 's' : ''}`
                }
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {getSummaryText()}
              {totalTasks > 0 && (
                <span className="ml-2">
                  {completedCount > 0 && !isComplete && `${completedCount}/${totalTasks} done`}
                  {isComplete && <span className="text-green-600">Complete</span>}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Expand/collapse icon */}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 mt-2 pt-4">
          {group.consolidatedMeals.map((meal, index) => (
            <div key={`${meal.mealName}-${index}`}>
              {/* If meal appears on multiple days with same name, show consolidated view */}
              {meal.days.length > 1 ? (
                <ConsolidatedPrepTask
                  meal={meal}
                  completedTasks={completedTasks}
                  completedSteps={completedSteps}
                  onToggleTaskComplete={onToggleTaskComplete}
                  onToggleStepComplete={onToggleStepComplete}
                  householdServings={householdServings}
                  prepStyle={prepStyle}
                  dailyAssembly={dailyAssembly}
                />
              ) : (
                /* Single day - show simple task */
                <DaySpecificPrepTask
                  meal={meal}
                  day={meal.days[0]}
                  completedTasks={completedTasks}
                  completedSteps={completedSteps}
                  onToggleTaskComplete={onToggleTaskComplete}
                  onToggleStepComplete={onToggleStepComplete}
                  householdServings={householdServings}
                  dailyAssembly={dailyAssembly}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
