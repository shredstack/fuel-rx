'use client'

import { useState } from 'react'
import type { DailyAssembly, DayOfWeek, MealType, DayPlanNormalized } from '@/lib/types'
import { MEAL_TYPE_CONFIG, getMealTypeColorClasses } from '@/lib/types'

// Day order and labels
const DAYS_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

interface DailyAssemblyByMealTypeProps {
  dailyAssembly: DailyAssembly
  days: DayPlanNormalized[]
  completedSteps?: Set<string>
  onToggleStep?: (stepId: string) => void
}

interface AssemblyStep {
  id: string
  text: string
  isAdvancePrep: boolean // Things to do night before or in advance
  isReheating: boolean   // Reheating instructions
}

interface MealAssemblyInfo {
  mealName: string
  mealType: MealType
  days: DayOfWeek[]
  assemblyTime: string
  steps: AssemblyStep[]
  tips: string[]
}

interface MealTypeGroup {
  mealType: MealType
  meals: MealAssemblyInfo[]
  totalTimePerDay: string
}

/**
 * Parse assembly instructions into individual steps
 */
function parseAssemblyInstructions(instructions: string, mealId: string): { steps: AssemblyStep[], tips: string[] } {
  const steps: AssemblyStep[] = []
  const tips: string[] = []

  // Split on common delimiters: periods, exclamation marks, newlines, numbered steps
  const rawSteps = instructions
    .split(/(?:[.!]\s+|\n|(?=\d+\.\s))/)
    .map(s => s.trim())
    .filter(s => s.length > 5) // Filter out very short fragments

  // Keywords indicating advance prep
  const advancePrepKeywords = [
    'night before', 'evening before', 'the night', 'ahead of time',
    'in advance', 'thaw', 'defrost', 'soak overnight',
    'move to fridge', 'refrigerator to thaw', 'take out of freezer'
  ]

  // Patterns that indicate advance prep (checked separately)
  const advancePrepPatterns = [
    /marinate.*night/i,           // "marinate chicken Monday night"
    /\bmonday night\b/i,          // Any "Monday night" reference
    /\btuesday night\b/i,
    /\bwednesday night\b/i,
    /\bthursday night\b/i,
    /\bfriday night\b/i,
    /\bsaturday night\b/i,
    /\bsunday night\b/i,
    /night for best/i,            // "Monday night for best flavor"
    /the night before/i,
    /overnight/i,                 // "soak overnight", "marinate overnight"
    /\bday before\b/i,
    /\bhours? (before|ahead)\b/i, // "2 hours before", "hours ahead"
  ]

  // Keywords indicating reheating
  const reheatingKeywords = [
    'microwave', 'reheat', 'warm up', 'heat', 'oven', '°f', '°c',
    'stovetop', 'pan', 'skillet', 'air fryer', 'toaster'
  ]

  // Keywords indicating tips
  const tipKeywords = [
    'tip:', 'note:', 'pro tip', 'optional:', 'for best results',
    'if you prefer', 'alternatively'
  ]

  rawSteps.forEach((text, idx) => {
    const lowerText = text.toLowerCase()

    // Check if it's a tip
    if (tipKeywords.some(kw => lowerText.includes(kw))) {
      tips.push(text.replace(/^(tip:|note:|pro tip:?)\s*/i, ''))
      return
    }

    const isAdvancePrep = advancePrepKeywords.some(kw => lowerText.includes(kw)) ||
      advancePrepPatterns.some(pattern => pattern.test(text))
    const isReheating = reheatingKeywords.some(kw => lowerText.includes(kw))

    steps.push({
      id: `${mealId}_step_${idx}`,
      text: text.replace(/^\d+\.\s*/, ''), // Remove leading numbers
      isAdvancePrep,
      isReheating,
    })
  })

  // If no steps were parsed, create a single step from the full instructions
  if (steps.length === 0 && instructions.trim()) {
    steps.push({
      id: `${mealId}_step_0`,
      text: instructions.trim(),
      isAdvancePrep: false,
      isReheating: false,
    })
  }

  return { steps, tips }
}

/**
 * Group daily assembly instructions by meal type, consolidating identical meals
 */
function groupAssemblyByMealType(
  dailyAssembly: DailyAssembly,
  days: DayPlanNormalized[]
): MealTypeGroup[] {
  const mealTypeOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
  const groups: MealTypeGroup[] = []

  for (const mealType of mealTypeOrder) {
    // Collect all meals of this type across all days
    const mealsByKey = new Map<string, MealAssemblyInfo>()

    for (const day of days) {
      const dayKey = day.day as DayOfWeek
      const mealSlots = day.meals.filter(slot => slot.meal_type === mealType)

      for (const slot of mealSlots) {
        const mealName = slot.meal.name

        // Get assembly instructions for this day/meal type
        const dayAssembly = dailyAssembly[dayKey]
        const mealAssembly = dayAssembly?.[mealType as keyof typeof dayAssembly]

        const instructions = mealAssembly?.instructions || ''
        const time = mealAssembly?.time || '5 min'

        // Create a unique ID for this meal instance
        const mealId = `assembly_${dayKey}_${mealType}_${mealName.toLowerCase().replace(/\s+/g, '_')}`

        // Parse instructions into steps
        const { steps, tips } = parseAssemblyInstructions(instructions, mealId)

        // Create a key based on meal name + instructions (to group identical meals)
        const groupKey = `${mealName.toLowerCase()}_${instructions.toLowerCase()}`

        if (mealsByKey.has(groupKey)) {
          // Add this day to existing meal group
          const existing = mealsByKey.get(groupKey)!
          if (!existing.days.includes(dayKey)) {
            existing.days.push(dayKey)
          }
        } else {
          // Create new meal group
          mealsByKey.set(groupKey, {
            mealName,
            mealType,
            days: [dayKey],
            assemblyTime: time,
            steps,
            tips,
          })
        }
      }
    }

    // Sort days within each meal group
    const meals = Array.from(mealsByKey.values())
    meals.forEach(meal => {
      meal.days.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b))
    })

    // Only add groups that have meals with actual steps
    const mealsWithContent = meals.filter(m => m.steps.length > 0)
    if (mealsWithContent.length > 0) {
      // Calculate average/typical time
      const times = mealsWithContent.map(m => parseInt(m.assemblyTime) || 5)
      const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length)

      groups.push({
        mealType,
        meals: mealsWithContent,
        totalTimePerDay: `~${avgTime} min`,
      })
    }
  }

  return groups
}

/**
 * Format days for display
 */
function formatDays(days: DayOfWeek[]): string {
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

  // Check for weekdays only
  const weekdays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  if (days.length === 5 && weekdays.every(d => days.includes(d))) {
    return 'Weekdays'
  }

  return days.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')
}

interface MealAssemblyCardProps {
  meal: MealAssemblyInfo
  completedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

function MealAssemblyCard({ meal, completedSteps, onToggleStep }: MealAssemblyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Separate advance prep steps from regular steps
  const advancePrepSteps = meal.steps.filter(s => s.isAdvancePrep)
  const regularSteps = meal.steps.filter(s => !s.isAdvancePrep)

  const completedCount = meal.steps.filter(s => completedSteps.has(s.id)).length
  const isAllComplete = completedCount === meal.steps.length && meal.steps.length > 0

  return (
    <div className={`rounded-lg border ${isAllComplete ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'} overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Completion checkbox indicator */}
          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
            isAllComplete ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {isAllComplete ? (
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-xs font-medium text-gray-500">{completedCount}/{meal.steps.length}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-gray-900 ${isAllComplete ? 'line-through text-gray-500' : ''}`}>
                {meal.mealName}
              </span>
              {advancePrepSteps.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                  Night before
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span className="font-medium text-primary-600">{formatDays(meal.days)}</span>
              <span>•</span>
              <span>{meal.assemblyTime}</span>
              <span>•</span>
              <span>{meal.steps.length} step{meal.steps.length !== 1 ? 's' : ''}</span>
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

      {isExpanded && (
        <div className="border-t border-gray-100 p-3 bg-gray-50/50 space-y-4">
          {/* Night Before / Advance Prep Section */}
          {advancePrepSteps.length > 0 && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <h5 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Night Before
              </h5>
              <ol className="space-y-2">
                {advancePrepSteps.map((step) => {
                  const isCompleted = completedSteps.has(step.id)
                  return (
                    <li key={step.id} className="flex gap-2 text-sm">
                      <button
                        onClick={() => onToggleStep(step.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 ${
                          isCompleted
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-purple-300 hover:border-purple-400 bg-white'
                        }`}
                      >
                        {isCompleted && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 ${isCompleted ? 'line-through text-purple-400' : 'text-purple-800'}`}>
                        {step.text}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {/* Assembly Steps */}
          {regularSteps.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Assembly Steps
              </h5>
              <ol className="space-y-2">
                {regularSteps.map((step) => {
                  const isCompleted = completedSteps.has(step.id)
                  return (
                    <li key={step.id} className="flex gap-2 text-sm">
                      <button
                        onClick={() => onToggleStep(step.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 ${
                          isCompleted
                            ? 'bg-teal-500 border-teal-500'
                            : 'border-gray-300 hover:border-teal-400 bg-white'
                        }`}
                      >
                        {isCompleted && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 ${isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {step.isReheating && (
                          <span className="inline-flex items-center gap-1 mr-1">
                            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                            </svg>
                          </span>
                        )}
                        {step.text}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {/* Tips */}
          {meal.tips.length > 0 && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
              <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Tips
              </h5>
              <ul className="space-y-1">
                {meal.tips.map((tip, idx) => (
                  <li key={idx} className="text-xs text-amber-800">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface MealTypeGroupSectionProps {
  group: MealTypeGroup
  defaultExpanded?: boolean
  completedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

function MealTypeGroupSection({ group, defaultExpanded = false, completedSteps, onToggleStep }: MealTypeGroupSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const mealConfig = MEAL_TYPE_CONFIG[group.mealType]
  const colorClasses = getMealTypeColorClasses(group.mealType)

  // Check if all meals in this group cover all week (likely consistent meals)
  const isConsistent = group.meals.length === 1 && group.meals[0].days.length === 7

  // Calculate total steps and completed across all meals
  const totalSteps = group.meals.reduce((sum, m) => sum + m.steps.length, 0)
  const completedCount = group.meals.reduce(
    (sum, m) => sum + m.steps.filter(s => completedSteps.has(s.id)).length,
    0
  )
  const isAllComplete = completedCount === totalSteps && totalSteps > 0

  // Check if any meals have advance prep
  const hasAdvancePrep = group.meals.some(m => m.steps.some(s => s.isAdvancePrep))

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
            isAllComplete
              ? 'bg-green-100'
              : colorClasses.replace('text-', 'bg-').replace('-800', '-100')
          }`}>
            {isAllComplete ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span>{mealConfig.icon}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900">
                {mealConfig.label} Assembly
              </h3>
              {isConsistent && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Same all week
                </span>
              )}
              {hasAdvancePrep && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  Has night-before prep
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{group.meals.length} meal{group.meals.length !== 1 ? ' variation' : ''}s</span>
              <span>•</span>
              <span>{group.totalTimePerDay}/day</span>
              {!isAllComplete && completedCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-teal-600">{completedCount}/{totalSteps} done</span>
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

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
          {group.meals.map((meal, index) => (
            <MealAssemblyCard
              key={`${meal.mealName}_${index}`}
              meal={meal}
              completedSteps={completedSteps}
              onToggleStep={onToggleStep}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DailyAssemblyByMealType({
  dailyAssembly,
  days,
  completedSteps: externalCompletedSteps,
  onToggleStep: externalOnToggleStep,
}: DailyAssemblyByMealTypeProps) {
  // Local state for completed steps if not provided externally
  const [localCompletedSteps, setLocalCompletedSteps] = useState<Set<string>>(new Set())

  const completedSteps = externalCompletedSteps ?? localCompletedSteps
  const onToggleStep = externalOnToggleStep ?? ((stepId: string) => {
    setLocalCompletedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  })

  const groups = groupAssemblyByMealType(dailyAssembly, days)

  if (groups.length === 0) {
    return null
  }

  // Calculate overall progress
  const totalSteps = groups.reduce((sum, g) =>
    sum + g.meals.reduce((mSum, m) => mSum + m.steps.length, 0), 0
  )
  const completedCount = groups.reduce((sum, g) =>
    sum + g.meals.reduce((mSum, m) => mSum + m.steps.filter(s => completedSteps.has(s.id)).length, 0), 0
  )

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍽️</span>
          <h2 className="text-lg font-semibold text-gray-900">Daily Assembly</h2>
        </div>
        {totalSteps > 0 && (
          <span className="text-sm text-gray-500">
            {completedCount}/{totalSteps} steps done
          </span>
        )}
      </div>

      {/* Quick tip */}
      <div className="px-1">
        <p className="text-sm text-gray-600">
          Quick 5-10 min prep per meal. <span className="text-purple-600 font-medium">Purple items</span> should be done the night before.
        </p>
      </div>

      {/* Meal Type Groups */}
      {groups.map((group) => (
        <MealTypeGroupSection
          key={group.mealType}
          group={group}
          defaultExpanded={groups.length <= 2}
          completedSteps={completedSteps}
          onToggleStep={onToggleStep}
        />
      ))}
    </div>
  )
}
