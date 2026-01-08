'use client'

import { useState } from 'react'
import type { PrepSession } from '@/lib/types'
import { getSessionTasks } from './prepUtils'
import PrepTaskCard from './PrepTaskCard'

interface BatchPrepSectionProps {
  session: PrepSession
  completedTasks: Set<string>
  completedSteps: Set<string>
  onToggleTaskComplete: (sessionId: string, taskId: string) => void
  onToggleStepComplete: (taskId: string, stepIndex: number) => void
  defaultExpanded?: boolean
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

      {/* Tasks */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
          {tasks.map(task => (
            <PrepTaskCard
              key={task.id}
              task={task}
              isCompleted={completedTasks.has(task.id)}
              onToggleComplete={() => onToggleTaskComplete(session.id, task.id)}
              completedSteps={completedSteps}
              onToggleStep={(stepIndex) => onToggleStepComplete(task.id, stepIndex)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
