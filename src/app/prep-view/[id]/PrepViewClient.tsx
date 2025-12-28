'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { PrepSession, PrepStyle, DayOfWeek, MealType, DailyAssembly, DayPlan } from '@/lib/types'
import { PREP_STYLE_LABELS } from '@/lib/types'
import {
  groupPrepDataFromMealPlan,
  getSessionTasks,
  DAYS_ORDER,
  DAY_LABELS,
  MEAL_TYPES_ORDER,
  MEAL_TYPE_CONFIG,
} from '@/components/prep/prepUtils'
import DayPrepSection from '@/components/prep/DayPrepSection'
import BatchPrepSection from '@/components/prep/BatchPrepSection'

interface PrepViewClientProps {
  mealPlan: {
    id: string
    week_start_date: string
    plan_data: DayPlan[] | null  // plan_data is directly an array of DayPlan
  }
  prepSessions: PrepSession[]
  prepStyle: string
  dailyAssembly?: DailyAssembly
}

export default function PrepViewClient({
  mealPlan,
  prepSessions,
  prepStyle,
  dailyAssembly,
}: PrepViewClientProps) {
  const supabase = createClient()

  // Get meal plan days from plan_data (plan_data is directly the array of days)
  const mealPlanDays: DayPlan[] = mealPlan.plan_data || []

  // Group prep data using meal plan as source of truth
  // This ensures every meal (including multiple snacks) appears as a task
  const groupedData = groupPrepDataFromMealPlan(mealPlanDays, prepSessions)

  // Track completed tasks - initialize from database
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => {
    const completed = new Set<string>()
    prepSessions.forEach(session => {
      const tasks = getSessionTasks(session)
      tasks.forEach(task => {
        if (task.completed) {
          completed.add(task.id)
        }
      })
    })
    return completed
  })

  // Track completed steps within tasks (local state for real-time cooking)
  // Key format: "taskId_stepIndex"
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const toggleStepComplete = (taskId: string, stepIndex: number) => {
    const stepKey = `${taskId}_${stepIndex}`
    const newCompletedSteps = new Set(completedSteps)
    if (newCompletedSteps.has(stepKey)) {
      newCompletedSteps.delete(stepKey)
    } else {
      newCompletedSteps.add(stepKey)
    }
    setCompletedSteps(newCompletedSteps)
  }

  const toggleTaskComplete = async (sessionId: string, taskId: string) => {
    const newCompleted = new Set(completedTasks)
    const isNowCompleted = !newCompleted.has(taskId)

    if (isNowCompleted) {
      newCompleted.add(taskId)
    } else {
      newCompleted.delete(taskId)
    }
    setCompletedTasks(newCompleted)

    // Update in database
    const session = prepSessions.find((s) => s.id === sessionId)
    if (session && session.prep_tasks?.tasks) {
      const updatedTasks = session.prep_tasks.tasks.map((task) =>
        task.id === taskId ? { ...task, completed: isNowCompleted } : task
      )

      await supabase
        .from('prep_sessions')
        .update({
          prep_tasks: { tasks: updatedTasks },
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    }
  }

  // Calculate overall progress
  const totalTasks = prepSessions.reduce((sum, s) => sum + getSessionTasks(s).length, 0)
  const totalCompleted = completedTasks.size

  // Check if there are any day-of tasks
  const hasDayOfTasks = DAYS_ORDER.some(day => {
    const dayMeals = groupedData.days[day]
    if (!dayMeals) return false
    return MEAL_TYPES_ORDER.some(mealType => {
      const tasks = dayMeals[mealType]
      return tasks && tasks.length > 0
    })
  })

  // Determine which day to auto-expand
  const today = new Date()
  const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as DayOfWeek
  const expandedDay = DAYS_ORDER.find(day => {
    const dayMeals = groupedData.days[day]
    if (!dayMeals) return false
    // Check if this day has any tasks
    return MEAL_TYPES_ORDER.some(mealType => {
      const tasks = dayMeals[mealType]
      return tasks && tasks.length > 0
    })
  }) || null

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/meal-plan/${mealPlan.id}`} className="text-primary-600 hover:text-primary-800 text-sm mb-2 inline-block">
            &larr; Back to Meal Plan
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Prep View
          </h1>
          <p className="text-gray-600">
            Week of {new Date(mealPlan.week_start_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Prep Style: <span className="font-medium">{PREP_STYLE_LABELS[prepStyle as PrepStyle]?.title || prepStyle}</span>
          </p>
        </div>

        {/* Overall Progress */}
        {totalTasks > 0 && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Weekly Progress</h3>
              <span className="text-sm text-gray-600">
                {totalCompleted} of {totalTasks} tasks complete
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-300"
                style={{ width: `${totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {prepSessions.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-600 mb-4">
              No prep sessions found for this meal plan.
            </p>
            <p className="text-sm text-gray-500">
              Prep sessions are generated automatically when you create a meal plan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Batch Prep Sessions */}
            {groupedData.batchSessions.length > 0 && (
              <div className="space-y-4">
                {groupedData.batchSessions.map(session => (
                  <BatchPrepSection
                    key={session.id}
                    session={session}
                    completedTasks={completedTasks}
                    completedSteps={completedSteps}
                    onToggleTaskComplete={toggleTaskComplete}
                    onToggleStepComplete={toggleStepComplete}
                    defaultExpanded={groupedData.batchSessions.length === 1}
                  />
                ))}
              </div>
            )}

            {/* Day-of Prep Sections */}
            {hasDayOfTasks && (
              <div className="space-y-4">
                {DAYS_ORDER.map(day => {
                  const dayMeals = groupedData.days[day]
                  if (!dayMeals) return null

                  // Check if this day has any tasks
                  const hasTasks = MEAL_TYPES_ORDER.some(mealType => {
                    const tasks = dayMeals[mealType]
                    return tasks && tasks.length > 0
                  })

                  if (!hasTasks) return null

                  return (
                    <DayPrepSection
                      key={day}
                      day={day}
                      meals={dayMeals}
                      completedTasks={completedTasks}
                      completedSteps={completedSteps}
                      onToggleTaskComplete={toggleTaskComplete}
                      onToggleStepComplete={toggleStepComplete}
                      defaultExpanded={day === expandedDay}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Daily Assembly Guide - shown for batch prep and night-before styles */}
        {dailyAssembly && Object.keys(dailyAssembly).length > 0 && (prepStyle === 'traditional_batch' || prepStyle === 'night_before') && (
          <div className="card mt-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Daily Assembly Guide</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Quick reference for assembling your prepped meals each day.
            </p>
            <div className="space-y-4">
              {DAYS_ORDER.map((day) => {
                const dayAssembly = dailyAssembly[day]
                if (!dayAssembly) return null

                const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

                return (
                  <div key={day} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                    <h4 className="font-medium text-gray-900 capitalize mb-2">{DAY_LABELS[day]}</h4>
                    <div className="space-y-2">
                      {mealTypes.map((mealType) => {
                        const mealAssembly = dayAssembly[mealType]
                        if (!mealAssembly) return null

                        return (
                          <div key={mealType} className="flex items-start gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${MEAL_TYPE_CONFIG[mealType].color}`}>
                              {mealType}
                            </span>
                            <div className="flex-1">
                              <span className="text-xs text-gray-500 mr-2">{mealAssembly.time}</span>
                              <span className="text-sm text-gray-700">{mealAssembly.instructions}</span>
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

        {/* Bottom Action */}
        <div className="mt-8 flex gap-4">
          <Link
            href={`/meal-plan/${mealPlan.id}`}
            className="btn-outline flex-1 text-center"
          >
            &larr; Back to Meal Plan
          </Link>
          <Link
            href={`/grocery-list/${mealPlan.id}`}
            className="btn-primary flex-1 text-center"
          >
            View Grocery List &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
