'use client'

import { useState } from 'react'
import type { PrepTask } from '@/lib/types'
import { formatCookingTemps, formatCookingTimes } from './prepUtils'

interface PrepTaskCardProps {
  task: PrepTask
  isCompleted: boolean
  onToggleComplete: () => void
  completedSteps: Set<string>
  onToggleStep: (stepIndex: number) => void
}

export default function PrepTaskCard({
  task,
  isCompleted,
  onToggleComplete,
  completedSteps,
  onToggleStep,
}: PrepTaskCardProps) {
  const cookingTemps = formatCookingTemps(task.cooking_temps)
  const cookingTimes = formatCookingTimes(task.cooking_times)
  const hasDetails = (task.detailed_steps && task.detailed_steps.length > 0) ||
    cookingTemps.length > 0 ||
    cookingTimes.length > 0 ||
    (task.tips && task.tips.length > 0) ||
    (task.equipment_needed && task.equipment_needed.length > 0) ||
    (task.ingredients_to_prep && task.ingredients_to_prep.length > 0)

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

  return (
    <div
      className={`bg-white rounded-lg border ${
        isCompleted ? 'border-green-200 bg-green-50/50' : 'border-gray-200'
      } overflow-hidden`}
    >
      {/* Task Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox */}
        <button
          onClick={onToggleComplete}
          className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all mt-0.5 ${
            isCompleted
              ? 'bg-teal-500 border-teal-500'
              : 'border-gray-300 hover:border-teal-400'
          }`}
        >
          {isCompleted && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Task Title and Meta */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-medium text-gray-900 ${
              isCompleted ? 'line-through text-gray-500' : ''
            }`}
          >
            {task.description}
          </p>

          {/* Quick info badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {task.estimated_minutes > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {task.estimated_minutes} min
              </span>
            )}
            {cookingTemps.map((temp, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                {temp}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Steps - expandable section */}
      {hasDetails && !isCompleted && (
        <div className="border-t border-gray-100 bg-white px-4 py-4">

          {/* Equipment Needed */}
          {task.equipment_needed && task.equipment_needed.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Equipment Needed
              </h5>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {task.equipment_needed.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-teal-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ingredients to Prep/Gather */}
          {task.ingredients_to_prep && task.ingredients_to_prep.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Ingredients to Gather
              </h5>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {task.ingredients_to_prep.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-teal-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Divider before method if we have equipment or ingredients */}
          {((task.equipment_needed && task.equipment_needed.length > 0) || (task.ingredients_to_prep && task.ingredients_to_prep.length > 0)) && task.detailed_steps && task.detailed_steps.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mt-2"></div>
          )}

          {/* Step-by-step instructions as checklist */}
          {task.detailed_steps && task.detailed_steps.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Method</h5>
                <span className="text-xs text-gray-400">
                  {stepProgress.completed}/{stepProgress.total} done
                </span>
              </div>
              <ol className="space-y-2">
                {task.detailed_steps.map((step, idx) => {
                  const stepCompleted = completedSteps.has(`${task.id}_${idx}`)
                  return (
                    <li key={idx} className="flex gap-2 text-sm">
                      <button
                        onClick={() => onToggleStep(idx)}
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

          {/* Cooking times breakdown */}
          {cookingTimes.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Timing</h5>
              <div className="flex flex-wrap gap-2">
                {cookingTimes.map((time, i) => (
                  <span key={i} className="text-sm text-gray-600">
                    {time}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pro tips */}
          {task.tips && task.tips.length > 0 && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Pro Tips
              </h5>
              <ul className="space-y-1">
                {task.tips.map((tip, idx) => (
                  <li key={idx} className="text-xs text-amber-800">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Storage instructions */}
          {task.storage && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
              <h5 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Storage
              </h5>
              <p className="text-xs text-blue-800">{task.storage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
