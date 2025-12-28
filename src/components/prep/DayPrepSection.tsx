'use client'

import { useState } from 'react'
import type { DayOfWeek, MealType } from '@/lib/types'
import { DAY_LABELS, MEAL_TYPES_ORDER, type PrepTaskWithSession } from './prepUtils'
import MealPrepSection from './MealPrepSection'

interface DayPrepSectionProps {
  day: DayOfWeek
  meals: Partial<Record<MealType, PrepTaskWithSession[]>>
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
  defaultExpanded?: boolean
}

export default function DayPrepSection({
  day,
  meals,
  completedTasks,
  completedSteps,
  onToggleTaskComplete,
  onToggleStepComplete,
  defaultExpanded = false,
}: DayPrepSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Count total tasks for the day
  const allTasks = MEAL_TYPES_ORDER.flatMap(mealType => meals[mealType] || [])
  const totalTasks = allTasks.length
  const completedCount = allTasks.filter(t => completedTasks.has(t.id)).length
  const isAllComplete = completedCount === totalTasks && totalTasks > 0

  // Calculate total estimated time
  const totalMinutes = allTasks.reduce((sum, task) => sum + (task.estimated_minutes || 0), 0)

  // Don't render if no tasks for this day
  if (totalTasks === 0) {
    return null
  }

  return (
    <div className="card overflow-hidden">
      {/* Day Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            isAllComplete
              ? 'bg-green-100 text-green-600'
              : 'bg-primary-100 text-primary-600'
          }`}>
            {isAllComplete ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              DAY_LABELS[day].charAt(0)
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {DAY_LABELS[day]}
              {isAllComplete && (
                <span className="ml-2 text-green-600 text-sm font-normal">Complete</span>
              )}
            </h3>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
              {totalMinutes > 0 && (
                <>
                  <span>•</span>
                  <span>~{totalMinutes} min</span>
                </>
              )}
              {!isAllComplete && completedCount > 0 && (
                <>
                  <span>•</span>
                  <span>{completedCount}/{totalTasks} done</span>
                </>
              )}
            </div>
          </div>
        </div>

        <svg
          className={`w-6 h-6 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Meal Sections */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
          {MEAL_TYPES_ORDER.map(mealType => {
            const tasks = meals[mealType]
            if (!tasks || tasks.length === 0) return null

            return (
              <MealPrepSection
                key={mealType}
                mealType={mealType}
                tasks={tasks}
                completedTasks={completedTasks}
                completedSteps={completedSteps}
                onToggleTaskComplete={onToggleTaskComplete}
                onToggleStepComplete={onToggleStepComplete}
                defaultExpanded={false}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
