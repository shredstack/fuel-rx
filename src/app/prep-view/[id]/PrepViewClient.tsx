'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { PrepSession, PrepStyle, DailyAssembly, DayPlan, DayPlanNormalized, HouseholdServingsPrefs } from '@/lib/types'
import { PREP_STYLE_LABELS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import {
  groupPrepDataByMealType,
  getSessionTasks,
} from '@/components/prep/prepUtils'
import MealTypeSection from '@/components/prep/MealTypeSection'
import BatchPrepSection from '@/components/prep/BatchPrepSection'
import { MealIdProvider } from '@/components/prep/MealIdContext'

interface PrepViewClientProps {
  mealPlan: {
    id: string
    week_start_date: string
  }
  days: DayPlanNormalized[]
  prepSessions: PrepSession[]
  prepStyle: string
  dailyAssembly?: DailyAssembly
  householdServings?: HouseholdServingsPrefs
}

// Helper function to convert DayPlanNormalized to legacy DayPlan format
function convertToLegacyDayPlan(day: DayPlanNormalized): DayPlan {
  return {
    day: day.day,
    meals: day.meals.map(slot => ({
      name: slot.meal.name,
      type: slot.meal.meal_type,
      prep_time_minutes: slot.meal.prep_time_minutes,
      ingredients: slot.meal.ingredients,
      instructions: slot.meal.instructions,
      macros: {
        calories: slot.meal.calories,
        protein: slot.meal.protein,
        carbs: slot.meal.carbs,
        fat: slot.meal.fat,
      },
    })),
    daily_totals: day.daily_totals,
  }
}

export default function PrepViewClient({
  mealPlan,
  days,
  prepSessions: initialPrepSessions,
  prepStyle,
  dailyAssembly: initialDailyAssembly,
  householdServings = DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
}: PrepViewClientProps) {
  const supabase = createClient()

  // Convert normalized days to legacy DayPlan format for prep utilities
  const mealPlanDays: DayPlan[] = days.map(convertToLegacyDayPlan)

  // Build a map from composite meal IDs (meal_monday_breakfast_0) to actual meal UUIDs
  // This is needed for the cooking assistant to look up meals in the database
  // Index is tracked per meal type (not global), matching prompt-builder.ts logic
  const mealIdMap: Record<string, { id: string; name: string }> = {}
  for (const day of days) {
    const mealTypeCounts: Record<string, number> = {}
    for (const slot of day.meals) {
      const mealType = slot.meal_type
      const index = mealTypeCounts[mealType] || 0
      mealTypeCounts[mealType] = index + 1
      const compositeId = `meal_${day.day}_${mealType}_${index}`
      mealIdMap[compositeId] = { id: slot.meal.id, name: slot.meal.name }
    }
  }

  // Note: We no longer trigger LLM regeneration when prep sessions are missing.
  // Instead, groupPrepDataByMealType() creates prep tasks directly from meal data.
  // This makes the prep view load instantly after meal swaps instead of waiting for LLM.
  // The meal's instructions and ingredients are already stored in the database.
  const prepSessions = initialPrepSessions
  const dailyAssembly = initialDailyAssembly

  // Separate batch sessions from day-of sessions
  // Note: For day_of prep style users, we should never show batch sessions even if LLM incorrectly generated them
  const batchSessions = prepStyle === 'day_of'
    ? []
    : prepSessions.filter(s => s.session_type === 'weekly_batch')
  const dayOfSessions = prepSessions.filter(s => s.session_type !== 'weekly_batch')

  // Use new meal-type grouping for day-of tasks
  const mealTypeGroups = groupPrepDataByMealType(mealPlanDays, dayOfSessions)

  // Track completed tasks - initialize from database
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => {
    const completed = new Set<string>()
    initialPrepSessions.forEach(session => {
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

  return (
    <MealIdProvider mealIdMap={mealIdMap}>
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

        {/* Main Content */}
        <div className="space-y-4">
          {/* Batch Prep Sessions (if any) */}
          {batchSessions.length > 0 && (
            <div className="space-y-4">
              {batchSessions.map(session => (
                <BatchPrepSection
                  key={session.id}
                  session={session}
                  completedTasks={completedTasks}
                  completedSteps={completedSteps}
                  onToggleTaskComplete={toggleTaskComplete}
                  onToggleStepComplete={toggleStepComplete}
                  defaultExpanded={batchSessions.length === 1}
                />
              ))}
            </div>
          )}

          {/* Meal Type Sections */}
          {mealTypeGroups.length > 0 && (
            <div className="space-y-4">
              {mealTypeGroups.map((group) => (
                <MealTypeSection
                  key={`${group.mealType}-${group.snackNumber || 0}`}
                  group={group}
                  completedTasks={completedTasks}
                  completedSteps={completedSteps}
                  onToggleTaskComplete={toggleTaskComplete}
                  onToggleStepComplete={toggleStepComplete}
                  defaultExpanded={false}
                  householdServings={householdServings}
                  prepStyle={prepStyle}
                  dailyAssembly={dailyAssembly}
                />
              ))}
            </div>
          )}
        </div>

        {/* Daily Assembly Guide is now shown inline within each meal in BatchPrepSection */}

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
    </MealIdProvider>
  )
}
