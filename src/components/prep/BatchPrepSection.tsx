'use client'

import { useState } from 'react'
import type { PrepSession, PrepTask, MealType, DayOfWeek } from '@/lib/types'
import { getSessionTasks, MEAL_TYPE_CONFIG, getMealTypeColorClasses, DAY_LABELS, DAYS_ORDER } from './prepUtils'
import PrepTaskCard from './PrepTaskCard'

interface BatchPrepSectionProps {
  session: PrepSession
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
  defaultExpanded?: boolean
}

interface MealGroup {
  mealType: MealType
  mealName: string
  tasks: PrepTask[]
  days: DayOfWeek[] // Days this meal feeds
}

// Extract meal type from meal_id (format: meal_monday_breakfast_0)
function getMealTypeFromMealId(mealId: string): MealType | null {
  const parts = mealId.split('_')
  if (parts.length >= 3) {
    const mealType = parts[2] as MealType
    if (['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
      return mealType
    }
  }
  return null
}

// Extract day from meal_id (format: meal_monday_breakfast_0)
function getDayFromMealId(mealId: string): DayOfWeek | null {
  const parts = mealId.split('_')
  if (parts.length >= 2) {
    const day = parts[1] as DayOfWeek
    if (DAYS_ORDER.includes(day)) {
      return day
    }
  }
  return null
}

// Group tasks by their primary meal type and name
function groupTasksByMeal(tasks: PrepTask[]): MealGroup[] {
  const mealGroups = new Map<string, MealGroup>()

  for (const task of tasks) {
    // Determine the meal type and days from meal_ids
    let mealType: MealType = 'dinner' // default
    const days = new Set<DayOfWeek>()

    if (task.meal_ids && task.meal_ids.length > 0) {
      for (const mealId of task.meal_ids) {
        const detectedType = getMealTypeFromMealId(mealId)
        if (detectedType) {
          mealType = detectedType
        }
        const day = getDayFromMealId(mealId)
        if (day) {
          days.add(day)
        }
      }
    }

    // Use task description as the meal name
    const mealName = task.description

    // Create a key based on meal type + name (normalized)
    const groupKey = `${mealType}_${mealName.toLowerCase().trim()}`

    if (!mealGroups.has(groupKey)) {
      mealGroups.set(groupKey, {
        mealType,
        mealName,
        tasks: [],
        days: [],
      })
    }

    const group = mealGroups.get(groupKey)!
    group.tasks.push(task)

    // Add days to the group
    for (const day of days) {
      if (!group.days.includes(day)) {
        group.days.push(day)
      }
    }
  }

  // Sort days within each group
  for (const group of mealGroups.values()) {
    group.days.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b))
  }

  // Convert to array and sort by meal type order
  const mealTypeOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
  const groups = Array.from(mealGroups.values())

  groups.sort((a, b) => {
    const aIndex = mealTypeOrder.indexOf(a.mealType)
    const bIndex = mealTypeOrder.indexOf(b.mealType)
    return aIndex - bIndex
  })

  return groups
}

interface MealGroupDropdownProps {
  group: MealGroup
  sessionId: string
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
}

function MealGroupDropdown({
  group,
  sessionId,
  completedTasks,
  completedSteps,
  onToggleTaskComplete,
  onToggleStepComplete,
}: MealGroupDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false) // Collapsed by default

  const completedCount = group.tasks.filter(t => completedTasks.has(t.id)).length
  const totalTasks = group.tasks.length
  const isAllComplete = completedCount === totalTasks && totalTasks > 0
  const totalMinutes = group.tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)

  const mealConfig = MEAL_TYPE_CONFIG[group.mealType]

  // Format days for display
  const formatDays = (days: DayOfWeek[]): string => {
    if (days.length === 0) return ''
    if (days.length === 7) return 'All week'
    if (days.length === 1) return DAY_LABELS[days[0]]

    // Check for consecutive days
    const indices = days.map(d => DAYS_ORDER.indexOf(d))
    const isConsecutive = indices.every((val, i, arr) =>
      i === 0 || val === arr[i - 1] + 1
    )

    if (isConsecutive && days.length >= 3) {
      return `${DAY_LABELS[days[0]].slice(0, 3)}-${DAY_LABELS[days[days.length - 1]].slice(0, 3)}`
    }

    return days.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')
  }

  return (
    <div className={`rounded-lg border ${isAllComplete ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'} overflow-hidden`}>
      {/* Meal Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {/* Completion indicator */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            isAllComplete ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {isAllComplete ? (
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-xs font-medium text-gray-500">{completedCount}/{totalTasks}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Meal type badge */}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getMealTypeColorClasses(group.mealType)}`}>
                {mealConfig.label}
              </span>
              {/* Meal name */}
              <span className={`font-medium text-gray-900 ${isAllComplete ? 'line-through text-gray-500' : ''}`}>
                {group.mealName}
              </span>
            </div>
            {/* Days and time estimate */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              {group.days.length > 0 && (
                <span>Feeds: {formatDays(group.days)}</span>
              )}
              {totalMinutes > 0 && (
                <>
                  <span>•</span>
                  <span>~{totalMinutes} min</span>
                </>
              )}
            </div>
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content - Prep Tasks */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
          {group.tasks.map(task => (
            <PrepTaskCard
              key={task.id}
              task={task}
              isCompleted={completedTasks.has(task.id)}
              onToggleComplete={() => onToggleTaskComplete(sessionId, task.id)}
              completedSteps={completedSteps}
              onToggleStep={(stepIndex) => onToggleStepComplete(task.id, stepIndex)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function BatchPrepSection({
  session,
  completedTasks,
  completedSteps,
  onToggleTaskComplete,
  onToggleStepComplete,
  defaultExpanded = true, // Batch prep sections should be expanded by default
}: BatchPrepSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Use "Sunday Batch Prep" as display name for weekly_batch sessions
  const displayName = session.session_type === 'weekly_batch'
    ? 'Sunday Batch Prep'
    : session.session_name

  const tasks = getSessionTasks(session)
  const totalTasks = tasks.length
  const completedCount = tasks.filter(t => completedTasks.has(t.id)).length
  const isAllComplete = completedCount === totalTasks && totalTasks > 0

  // Group tasks by meal type
  const mealGroups = groupTasksByMeal(tasks)

  if (totalTasks === 0) {
    return null
  }

  return (
    <div className="card overflow-hidden">
      {/* Batch Prep Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
            isAllComplete
              ? 'bg-green-100'
              : 'bg-teal-100'
          }`}>
            {isAllComplete ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span>📦</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {displayName}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                Batch prep
              </span>
              {isAllComplete && (
                <span className="text-green-600 text-sm font-normal">Complete</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{mealGroups.length} meal{mealGroups.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
              {session.estimated_minutes && session.estimated_minutes > 0 && (
                <>
                  <span>•</span>
                  <span>~{session.estimated_minutes} min</span>
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

      {/* Meal Groups */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
          {mealGroups.map((group, index) => (
            <MealGroupDropdown
              key={`${group.mealType}_${group.mealName}_${index}`}
              group={group}
              sessionId={session.id}
              completedTasks={completedTasks}
              completedSteps={completedSteps}
              onToggleTaskComplete={onToggleTaskComplete}
              onToggleStepComplete={onToggleStepComplete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
