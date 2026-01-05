'use client'

import { useState } from 'react'
import type { PrepItem, DailyAssembly, DayOfWeek, MealType, DayPlan, PrepSession } from '@/lib/types'
import {
  groupPrepDataByMealType,
  DAYS_ORDER,
  DAY_LABELS,
  MEAL_TYPE_CONFIG,
} from './prep/prepUtils'
import MealTypeSection from './prep/MealTypeSection'

interface LegacyPrepSession {
  id?: string
  sessionName: string
  sessionOrder: number
  estimatedMinutes: number
  instructions: string
  prepItems: PrepItem[]
}

interface Props {
  mealPlanDays: DayPlan[]
  prepSessions: LegacyPrepSession[]
  dailyAssembly: DailyAssembly
}

// Convert legacy format to PrepSession format for grouping
function convertToFullPrepSession(session: LegacyPrepSession, index: number): PrepSession {
  return {
    id: session.id || `session_${index}`,
    meal_plan_id: '',
    session_name: session.sessionName,
    session_order: session.sessionOrder,
    estimated_minutes: session.estimatedMinutes,
    prep_items: session.prepItems,
    feeds_meals: session.prepItems.flatMap(item => item.feeds || []),
    instructions: session.instructions,
    daily_assembly: null,
    session_type: 'day_of_dinner', // Default, will be overridden by feeds
    session_day: null,
    session_time_of_day: null,
    prep_for_date: null,
    prep_tasks: { tasks: [] },
    display_order: index,
    created_at: new Date().toISOString(),
  }
}

export default function PrepModeView({ mealPlanDays, prepSessions, dailyAssembly }: Props) {
  // Convert legacy sessions to full format
  const fullSessions = prepSessions.map((s, i) => convertToFullPrepSession(s, i))

  // Group by meal type instead of day
  const mealTypeGroups = groupPrepDataByMealType(mealPlanDays, fullSessions)

  // Local state for completed tasks and steps (no database persistence in this view)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [showDailyAssembly, setShowDailyAssembly] = useState(false)

  const toggleTaskComplete = (sessionId: string, taskId: string) => {
    const newCompleted = new Set(completedTasks)
    if (newCompleted.has(taskId)) {
      newCompleted.delete(taskId)
    } else {
      newCompleted.add(taskId)
    }
    setCompletedTasks(newCompleted)
  }

  const toggleStepComplete = (taskId: string, stepIndex: number) => {
    const stepKey = `${taskId}_${stepIndex}`
    const newCompleted = new Set(completedSteps)
    if (newCompleted.has(stepKey)) {
      newCompleted.delete(stepKey)
    } else {
      newCompleted.add(stepKey)
    }
    setCompletedSteps(newCompleted)
  }

  if (!prepSessions || prepSessions.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-gray-500">No prep sessions available for this meal plan.</p>
        <p className="text-sm text-gray-400 mt-2">
          Prep mode will be generated automatically for new meal plans.
        </p>
      </div>
    )
  }

  // Check if there are any meal type groups
  const hasMealTypeGroups = mealTypeGroups.length > 0

  return (
    <div className="space-y-6">
      {/* Meal type sections */}
      {hasMealTypeGroups && (
        <div className="space-y-4">
          {mealTypeGroups.map((group, index) => (
            <MealTypeSection
              key={`${group.mealType}-${group.snackNumber || 0}`}
              group={group}
              completedTasks={completedTasks}
              completedSteps={completedSteps}
              onToggleTaskComplete={toggleTaskComplete}
              onToggleStepComplete={toggleStepComplete}
              defaultExpanded={false}
            />
          ))}
        </div>
      )}

      {/* Daily Assembly Guide - Collapsible at bottom */}
      {dailyAssembly && Object.keys(dailyAssembly).length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowDailyAssembly(!showDailyAssembly)}
            className="w-full text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Daily Assembly Guide</h3>
                <p className="text-sm text-gray-500">Quick instructions for each meal</p>
              </div>
            </div>
            <svg
              className={`w-6 h-6 text-gray-400 transition-transform ${showDailyAssembly ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDailyAssembly && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="space-y-4">
                {DAYS_ORDER.map((day) => {
                  const dayAssembly = dailyAssembly[day]
                  if (!dayAssembly) return null

                  return (
                    <div key={day} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <h4 className="font-semibold text-gray-900 mb-2">{DAY_LABELS[day]}</h4>
                      <div className="space-y-2">
                        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mealType) => {
                          const meal = dayAssembly[mealType]
                          if (!meal) return null

                          return (
                            <div key={mealType} className="flex items-start gap-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize shrink-0 ${MEAL_TYPE_CONFIG[mealType].color}`}>
                                {mealType}
                              </span>
                              <div className="text-sm">
                                <span className="text-gray-500">({meal.time})</span>{' '}
                                <span className="text-gray-700">{meal.instructions}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
