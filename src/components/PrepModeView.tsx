'use client'

import { useState } from 'react'
import type { PrepItem, DailyAssembly, DayOfWeek, MealType, DayPlan, PrepSession } from '@/lib/types'
import {
  groupPrepDataFromMealPlan,
  DAYS_ORDER,
  DAY_LABELS,
  MEAL_TYPES_ORDER,
  MEAL_TYPE_CONFIG,
  type PrepTaskWithSession,
} from './prep/prepUtils'

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

  // Group using meal plan as source of truth to ensure all meals appear
  const groupedData = groupPrepDataFromMealPlan(mealPlanDays, fullSessions)

  // Local state for completed tasks and steps (no database persistence in this view)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [expandedDays, setExpandedDays] = useState<Set<DayOfWeek>>(() => {
    // Auto-expand first day with tasks
    const firstDay = DAYS_ORDER.find(day => {
      const dayMeals = groupedData.days[day]
      if (!dayMeals) return false
      return MEAL_TYPES_ORDER.some(mealType => {
        const tasks = dayMeals[mealType]
        return tasks && tasks.length > 0
      })
    })
    return new Set(firstDay ? [firstDay] : [])
  })
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set())
  const [showDailyAssembly, setShowDailyAssembly] = useState(false)

  const toggleDay = (day: DayOfWeek) => {
    const newExpanded = new Set(expandedDays)
    if (newExpanded.has(day)) {
      newExpanded.delete(day)
    } else {
      newExpanded.add(day)
    }
    setExpandedDays(newExpanded)
  }

  const toggleMeal = (key: string) => {
    const newExpanded = new Set(expandedMeals)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedMeals(newExpanded)
  }

  const toggleTask = (taskId: string) => {
    const newCompleted = new Set(completedTasks)
    if (newCompleted.has(taskId)) {
      newCompleted.delete(taskId)
    } else {
      newCompleted.add(taskId)
    }
    setCompletedTasks(newCompleted)
  }

  const toggleStep = (taskId: string, stepIndex: number) => {
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

  // Check if there are any grouped tasks
  const hasDayTasks = DAYS_ORDER.some(day => {
    const dayMeals = groupedData.days[day]
    if (!dayMeals) return false
    return MEAL_TYPES_ORDER.some(mealType => {
      const tasks = dayMeals[mealType]
      return tasks && tasks.length > 0
    })
  })

  return (
    <div className="space-y-6">
      {/* Day-based Prep Sections */}
      {hasDayTasks && (
        <div className="space-y-4">
          {DAYS_ORDER.map(day => {
            const dayMeals = groupedData.days[day]
            if (!dayMeals) return null

            // Get all tasks for this day
            const allDayTasks = MEAL_TYPES_ORDER.flatMap(mealType => dayMeals[mealType] || [])
            if (allDayTasks.length === 0) return null

            const isExpanded = expandedDays.has(day)
            const completedCount = allDayTasks.filter(t => completedTasks.has(t.id)).length
            const totalMinutes = allDayTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
            const isAllComplete = completedCount === allDayTasks.length

            return (
              <div key={day} className="card">
                <button
                  onClick={() => toggleDay(day)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between">
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
                        </h3>
                        <p className="text-sm text-gray-500">
                          {allDayTasks.length} task{allDayTasks.length !== 1 ? 's' : ''}
                          {totalMinutes > 0 && ` • ~${totalMinutes} min`}
                          {completedCount > 0 && !isAllComplete && ` • ${completedCount}/${allDayTasks.length} done`}
                        </p>
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
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    {MEAL_TYPES_ORDER.map(mealType => {
                      const tasks = dayMeals[mealType]
                      if (!tasks || tasks.length === 0) return null

                      const mealKey = `${day}_${mealType}`
                      const isMealExpanded = expandedMeals.has(mealKey)
                      const mealCompletedCount = tasks.filter(t => completedTasks.has(t.id)).length
                      const isMealComplete = mealCompletedCount === tasks.length
                      const config = MEAL_TYPE_CONFIG[mealType]

                      return (
                        <div key={mealType} className="border border-gray-100 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleMeal(mealKey)}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                                {config.label}
                              </span>
                              <span className="text-sm text-gray-600">
                                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                                {isMealComplete && <span className="ml-2 text-green-600">- Complete</span>}
                              </span>
                            </div>
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${isMealExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {isMealExpanded && (
                            <div className="p-3 space-y-3 bg-white">
                              {tasks.map(task => (
                                <PrepItemCardSimple
                                  key={task.id}
                                  task={task}
                                  isCompleted={completedTasks.has(task.id)}
                                  onToggleComplete={() => toggleTask(task.id)}
                                  completedSteps={completedSteps}
                                  onToggleStep={(stepIndex) => toggleStep(task.id, stepIndex)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Daily Assembly Toggle */}
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
    </div>
  )
}

// Simplified prep item card for the dashboard view
function PrepItemCardSimple({
  task,
  isCompleted,
  onToggleComplete,
  completedSteps,
  onToggleStep,
}: {
  task: PrepTaskWithSession
  isCompleted: boolean
  onToggleComplete: () => void
  completedSteps: Set<string>
  onToggleStep: (stepIndex: number) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getStepProgress = () => {
    if (!task.detailed_steps) return { completed: 0, total: 0 }
    let completed = 0
    for (let i = 0; i < task.detailed_steps.length; i++) {
      if (completedSteps.has(`${task.id}_${i}`)) {
        completed++
      }
    }
    return { completed, total: task.detailed_steps.length }
  }

  const stepProgress = getStepProgress()
  const hasSteps = task.detailed_steps && task.detailed_steps.length > 0

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleComplete}
          className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 ${
            isCompleted
              ? 'bg-teal-500 border-teal-500'
              : 'border-gray-300 hover:border-teal-400'
          }`}
        >
          {isCompleted && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1">
          <button
            onClick={() => hasSteps && setIsExpanded(!isExpanded)}
            className={`w-full text-left ${hasSteps ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className={`font-medium text-gray-900 ${isCompleted ? 'line-through' : ''}`}>
                  {task.description}
                </h4>
                {task.estimated_minutes > 0 && (
                  <p className="text-sm text-gray-500">~{task.estimated_minutes} min</p>
                )}
              </div>
              {hasSteps && (
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
          </button>

          {isExpanded && hasSteps && !isCompleted && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Method</p>
                <span className="text-xs text-gray-400">
                  {stepProgress.completed}/{stepProgress.total} done
                </span>
              </div>
              <ol className="space-y-2">
                {task.detailed_steps!.map((step, idx) => {
                  const stepCompleted = completedSteps.has(`${task.id}_${idx}`)
                  return (
                    <li key={idx} className="flex gap-2 text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleStep(idx)
                        }}
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
                      <span className={`flex-1 ${stepCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {step}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
