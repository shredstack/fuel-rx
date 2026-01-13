'use client'

import { useState } from 'react'
import type { MealType } from '@/lib/types'
import { MEAL_TYPE_CONFIG, getMealTypeColorClasses, type PrepTaskWithSession } from './prepUtils'
import PrepTaskCard from './PrepTaskCard'

interface MealPrepSectionProps {
  mealType: MealType
  tasks: PrepTaskWithSession[]
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
  defaultExpanded?: boolean
}

export default function MealPrepSection({
  mealType,
  tasks,
  completedTasks,
  completedSteps,
  onToggleTaskComplete,
  onToggleStepComplete,
  defaultExpanded = false,
}: MealPrepSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Don't render if no tasks
  if (tasks.length === 0) {
    return null
  }

  const config = MEAL_TYPE_CONFIG[mealType]
  const completedCount = tasks.filter(t => completedTasks.has(t.id)).length
  const isAllComplete = completedCount === tasks.length

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Meal Type Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getMealTypeColorClasses(mealType)}`}>
            {config.label}
          </span>
          <span className="text-sm text-gray-600">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {isAllComplete && (
              <span className="ml-2 text-green-600">- Complete</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isAllComplete && completedCount > 0 && (
            <span className="text-xs text-gray-500">
              {completedCount}/{tasks.length}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Tasks */}
      {isExpanded && (
        <div className="p-3 space-y-3 bg-white">
          {tasks.map(task => (
            <PrepTaskCard
              key={task.id}
              task={task}
              isCompleted={completedTasks.has(task.id)}
              onToggleComplete={() => onToggleTaskComplete(task.sessionId, task.id)}
              completedSteps={completedSteps}
              onToggleStep={(stepIndex) => onToggleStepComplete(task.id, stepIndex)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
