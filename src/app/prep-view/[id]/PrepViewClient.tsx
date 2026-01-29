'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PrepSession, PrepStyle, DailyAssembly, DayPlan, DayPlanNormalized, HouseholdServingsPrefs, PrepModeResponse, BatchPrepStatus } from '@/lib/types'
import { PREP_STYLE_LABELS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import {
  groupPrepDataByMealType,
  getSessionTasks,
} from '@/components/prep/prepUtils'
import MealTypeSection from '@/components/prep/MealTypeSection'
import BatchPrepSection from '@/components/prep/BatchPrepSection'
import DailyAssemblyByMealType from '@/components/prep/DailyAssemblyByMealType'
import { MealIdProvider } from '@/components/prep/MealIdContext'
import NutritionDisclaimer from '@/components/NutritionDisclaimer'
import { useBatchPrepStatus } from '@/hooks/queries/useBatchPrepStatus'

type PrepViewTab = 'fresh' | 'batch'

const PREP_VIEW_TAB_STORAGE_KEY = 'fuelrx-prep-view-tab'

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
  // New props for split prep sessions
  prepSessionsDayOf?: PrepModeResponse | null
  prepSessionsBatch?: PrepModeResponse | null
  batchPrepStatus?: BatchPrepStatus
  /** Whether this plan has day-of prep data needed to generate batch prep */
  canGenerateBatchPrep?: boolean
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

// Helper function to convert PrepModeResponse to PrepSession[] format
// Handles both camelCase (new format) and snake_case (legacy stored data)
function convertPrepModeResponseToSessions(response: PrepModeResponse | null | undefined): PrepSession[] {
  if (!response) return []

  // Handle both camelCase and snake_case formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawResponse = response as any
  const sessions = rawResponse.prepSessions || rawResponse.prep_sessions
  const dailyAssembly = rawResponse.dailyAssembly || rawResponse.daily_assembly

  if (!sessions || !Array.isArray(sessions)) return []

  return sessions.map((session: Record<string, unknown>, index: number) => {
    // Handle both camelCase and snake_case session properties
    const sessionName = (session.sessionName || session.session_name) as string
    const sessionOrder = (session.sessionOrder ?? session.session_order ?? session.display_order ?? index) as number
    const estimatedMinutes = (session.estimatedMinutes ?? session.estimated_minutes ?? 0) as number
    const prepItems = (session.prepItems || session.prep_items || []) as PrepSession['prep_items']
    const instructions = (session.instructions || '') as string
    const sessionType = (session.sessionType || session.session_type || 'weekly_batch') as PrepSession['session_type']
    const sessionDay = (session.sessionDay ?? session.session_day ?? null) as PrepSession['session_day']
    const sessionTimeOfDay = (session.sessionTimeOfDay ?? session.session_time_of_day ?? null) as PrepSession['session_time_of_day']
    const prepForDate = (session.prepForDate ?? session.prep_for_date ?? null) as string | null
    const prepTasks = session.prepTasks || session.prep_tasks
    const displayOrder = (session.displayOrder ?? session.display_order ?? index) as number

    return {
      id: `batch-session-${index}`,
      meal_plan_id: '',
      session_name: sessionName,
      session_order: sessionOrder,
      estimated_minutes: estimatedMinutes,
      prep_items: prepItems,
      feeds_meals: [],
      instructions: instructions,
      daily_assembly: dailyAssembly || null,
      session_type: sessionType,
      session_day: sessionDay,
      session_time_of_day: sessionTimeOfDay,
      prep_for_date: prepForDate,
      prep_tasks: prepTasks ? { tasks: Array.isArray(prepTasks) ? prepTasks : (prepTasks as { tasks: unknown[] }).tasks || [] } : { tasks: [] },
      display_order: displayOrder,
      created_at: new Date().toISOString(),
    } as PrepSession
  })
}

export default function PrepViewClient({
  mealPlan,
  days,
  prepSessions: initialPrepSessions,
  prepStyle,
  dailyAssembly: initialDailyAssembly,
  householdServings = DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
  prepSessionsDayOf,
  prepSessionsBatch,
  batchPrepStatus: initialBatchPrepStatus = 'not_started',
  canGenerateBatchPrep: initialCanGenerateBatchPrep = false,
}: PrepViewClientProps) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const focusMealParam = searchParams.get('focusMeal')
  const focusMealName = focusMealParam ? decodeURIComponent(focusMealParam) : null

  // Tab state - default to 'fresh' (day-of cooking) view
  const [activeTabState, setActiveTabState] = useState<PrepViewTab>('fresh')

  // State for triggering batch prep generation
  const [isTriggering, setIsTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  // Persist active tab to localStorage
  const setActiveTab = useCallback((tab: PrepViewTab) => {
    setActiveTabState(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREP_VIEW_TAB_STORAGE_KEY, tab)
    }
  }, [])

  // On mount, restore active tab from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PREP_VIEW_TAB_STORAGE_KEY) as PrepViewTab | null
      if (saved === 'fresh' || saved === 'batch') {
        setActiveTabState(saved)
      }
    }
  }, [])

  // Alias for reading the state
  const activeTab = activeTabState

  // Poll batch prep status if it's actively generating (not for not_started)
  const { data: batchPrepStatusData, refetch: refetchBatchPrepStatus } = useBatchPrepStatus(
    initialBatchPrepStatus === 'pending' || initialBatchPrepStatus === 'generating' || isTriggering
      ? mealPlan.id
      : null
  )

  // Use polled status if available, otherwise use initial
  const batchPrepStatus = batchPrepStatusData?.status ?? initialBatchPrepStatus
  const canGenerateBatchPrep = batchPrepStatusData?.canGenerateBatchPrep ?? initialCanGenerateBatchPrep

  // Handle triggering batch prep generation
  const handleGenerateBatchPrep = async () => {
    setIsTriggering(true)
    setTriggerError(null)

    try {
      const response = await fetch(`/api/trigger-batch-prep/${mealPlan.id}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        if (data.code === 'NO_DAY_OF_PREP') {
          setTriggerError('This older meal plan doesn\'t have the data needed to generate batch prep instructions. Try creating a new meal plan instead.')
        } else {
          setTriggerError(data.error || 'Failed to start batch prep generation')
        }
        setIsTriggering(false)
        return
      }

      // Start polling for status updates
      refetchBatchPrepStatus()
    } catch (error) {
      setTriggerError('Failed to connect to server. Please try again.')
      setIsTriggering(false)
    }
  }

  // Reset triggering state when generation completes or fails
  useEffect(() => {
    if (batchPrepStatus === 'completed' || batchPrepStatus === 'failed') {
      setIsTriggering(false)
    }
  }, [batchPrepStatus])

  // Ref for scrolling to focused meal section
  const focusedSectionRef = useRef<HTMLDivElement>(null)

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
  // Use dailyAssembly from batch prep data if available, otherwise use legacy
  // Handle both camelCase and snake_case formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBatchData = prepSessionsBatch as any
  const dailyAssembly = rawBatchData?.dailyAssembly || rawBatchData?.daily_assembly || initialDailyAssembly

  // Get batch sessions from new prep_sessions_batch column, or fall back to legacy prep_sessions table
  const batchSessionsFromNewColumn = convertPrepModeResponseToSessions(prepSessionsBatch)
  const batchSessionsFromLegacy = prepSessions.filter(s => s.session_type === 'weekly_batch')

  // Use new column data if available, otherwise fall back to legacy
  const batchSessions = batchSessionsFromNewColumn.length > 0
    ? batchSessionsFromNewColumn
    : batchSessionsFromLegacy

  // Day-of sessions come from the legacy prep_sessions table
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

  // Scroll to focused meal section after mount
  useEffect(() => {
    if (focusMealName && focusedSectionRef.current) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        focusedSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    }
  }, [focusMealName])

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
            &larr; View Meal Plan
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Cooking Instructions
          </h1>
          <p className="text-gray-600">
            Week of {new Date(mealPlan.week_start_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Prep Style Tabs */}
        <div className="flex mb-6 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('fresh')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'fresh'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Fresh Cooking
            </span>
            <span className="text-xs opacity-80 block mt-0.5">Cook meals day-of</span>
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'batch'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Batch Prep
              {batchPrepStatus === 'generating' && (
                <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </span>
            <span className="text-xs opacity-80 block mt-0.5">
              {batchPrepStatus === 'generating' ? 'Generating...' : 'Prep ahead on Sunday'}
            </span>
          </button>
        </div>

        {/* How to Use This Page */}
        <div className="card mb-6 bg-gradient-to-r from-primary-50 to-teal-50 border-primary-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                {activeTab === 'fresh' ? 'Fresh Cooking Mode' : 'Batch Prep Mode'}
              </h3>
              {activeTab === 'fresh' ? (
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold mt-0.5">1.</span>
                    <span><strong>Expand any meal</strong> to see step-by-step cooking instructions with temperatures, times, and tips.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold mt-0.5">2.</span>
                    <span><strong>Check off steps</strong> as you complete them to track your progress.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold mt-0.5">3.</span>
                    <span><strong>Need help?</strong> Tap the chat icon on any meal to ask the AI Cooking Assistant questions.</span>
                  </li>
                </ul>
              ) : (
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold mt-0.5">1.</span>
                    <span><strong>Sunday Batch Prep:</strong> Prepare proteins, grains, and batch-friendly items that keep well.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold mt-0.5">2.</span>
                    <span><strong>Daily Assembly:</strong> Quick 5-10 minute reheating and assembly instructions for each meal.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold mt-0.5">3.</span>
                    <span><strong>Fresh items:</strong> Some items (fish, eggs) are flagged as &quot;cook day-of&quot; for best quality.</span>
                  </li>
                </ul>
              )}
            </div>
          </div>
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

        {/* Nutrition Disclaimer - Required by Apple App Store Guideline 1.4.1 */}
        <NutritionDisclaimer className="mb-6" />

        {/* Main Content */}
        <div className="space-y-4">
          {/* Fresh Cooking Tab Content */}
          {activeTab === 'fresh' && (
            <>
              {/* Meal Type Sections - Day-of cooking instructions */}
              {mealTypeGroups.length > 0 && (
                <div className="space-y-4">
                  {mealTypeGroups.map((group) => {
                    const containsFocusedMeal = focusMealName
                      ? group.consolidatedMeals.some(
                          (m) => m.mealName.toLowerCase() === focusMealName.toLowerCase()
                        )
                      : false

                    return (
                      <div
                        key={`${group.mealType}-${group.snackNumber || 0}`}
                        ref={containsFocusedMeal ? focusedSectionRef : undefined}
                      >
                        <MealTypeSection
                          group={group}
                          completedTasks={completedTasks}
                          completedSteps={completedSteps}
                          onToggleTaskComplete={toggleTaskComplete}
                          onToggleStepComplete={toggleStepComplete}
                          defaultExpanded={containsFocusedMeal}
                          householdServings={householdServings}
                          prepStyle={prepStyle}
                          focusMealName={focusMealName}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Batch Prep Tab Content */}
          {activeTab === 'batch' && (
            <>
              {/* Not Started State - Offer to generate batch prep */}
              {batchPrepStatus === 'not_started' && !isTriggering && (
                <div className="card text-center py-8 bg-gradient-to-br from-teal-50 to-blue-50 border-teal-200">
                  <svg className="w-12 h-12 text-teal-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Generate Batch Prep Instructions
                  </h3>
                  {canGenerateBatchPrep ? (
                    <>
                      <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                        Transform your meal plan into an efficient Sunday batch prep session with daily assembly instructions.
                      </p>
                      {triggerError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-md mx-auto">
                          {triggerError}
                        </div>
                      )}
                      <button
                        onClick={handleGenerateBatchPrep}
                        className="btn-primary"
                      >
                        Generate Batch Prep
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 text-sm mb-4 max-w-md mx-auto">
                        This older meal plan doesn&apos;t have the data needed for batch prep generation.
                        Batch prep is available for new meal plans.
                      </p>
                      <button
                        onClick={() => setActiveTab('fresh')}
                        className="btn-outline"
                      >
                        Use Fresh Cooking Instead
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Loading State */}
              {(batchPrepStatus === 'pending' || batchPrepStatus === 'generating' || isTriggering) && (
                <div className="card text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {batchPrepStatus === 'pending' || isTriggering ? 'Preparing batch prep instructions...' : 'Generating batch prep plan...'}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    We&apos;re optimizing your meals for efficient Sunday batch prep.
                    This usually takes 1-2 minutes.
                  </p>
                </div>
              )}

              {/* Failed State */}
              {batchPrepStatus === 'failed' && !isTriggering && (
                <div className="card text-center py-8 border-red-200 bg-red-50">
                  <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Batch prep generation failed
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Don&apos;t worry - you can still use the Fresh Cooking tab for day-of cooking instructions.
                  </p>
                  <div className="flex gap-3 justify-center">
                    {canGenerateBatchPrep && (
                      <button
                        onClick={handleGenerateBatchPrep}
                        className="btn-outline"
                      >
                        Try Again
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('fresh')}
                      className="btn-primary"
                    >
                      Switch to Fresh Cooking
                    </button>
                  </div>
                </div>
              )}

              {/* Batch Prep Content */}
              {batchPrepStatus === 'completed' && (
                <div className="space-y-6">
                  {/* Sunday Batch Prep Section */}
                  {batchSessions.length > 0 && (
                    <div className="space-y-4">
                      {batchSessions
                        .filter(session => session.session_type === 'weekly_batch')
                        .map(session => (
                          <BatchPrepSection
                            key={session.id}
                            session={session}
                            completedTasks={completedTasks}
                            completedSteps={completedSteps}
                            onToggleTaskComplete={toggleTaskComplete}
                            onToggleStepComplete={toggleStepComplete}
                            defaultExpanded={true}
                          />
                        ))}
                    </div>
                  )}

                  {/* Daily Assembly by Meal Type */}
                  {dailyAssembly && Object.keys(dailyAssembly).length > 0 && (
                    <DailyAssemblyByMealType
                      dailyAssembly={dailyAssembly}
                      days={days}
                    />
                  )}

                  {/* If batch prep completed but no content found */}
                  {batchSessions.length === 0 && (!dailyAssembly || Object.keys(dailyAssembly).length === 0) && (
                    <div className="card text-center py-8 bg-gray-50">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No batch prep instructions yet
                      </h3>
                      <p className="text-gray-600 text-sm mb-4">
                        Batch prep instructions will appear here once generated.
                        Use the Fresh Cooking tab for day-of cooking instructions.
                      </p>
                      <button
                        onClick={() => setActiveTab('fresh')}
                        className="btn-outline"
                      >
                        Switch to Fresh Cooking
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Action */}
        <div className="mt-8 flex gap-4">
          <Link
            href={`/meal-plan/${mealPlan.id}`}
            className="btn-outline flex-1 text-center"
          >
            &larr; View Meal Plan
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
