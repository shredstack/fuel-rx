'use client'

import type { WorkoutTime, PreWorkoutPreference } from '@/lib/types'

interface WorkoutMealsValues {
  includeWorkoutMeals: boolean
  workoutTime: WorkoutTime
  preWorkoutPreference: PreWorkoutPreference
}

interface Props {
  values: WorkoutMealsValues
  onChange: (values: WorkoutMealsValues) => void
}

const WORKOUT_TIME_OPTIONS: { value: WorkoutTime; label: string; desc: string }[] = [
  { value: 'morning', label: 'Morning', desc: '6-10am' },
  { value: 'midday', label: 'Midday', desc: '11am-2pm' },
  { value: 'evening', label: 'Evening', desc: '5-8pm' },
  { value: 'varies', label: 'Varies', desc: 'Changes daily' },
]

const PRE_WORKOUT_OPTIONS: { value: PreWorkoutPreference; label: string; desc: string; example: string }[] = [
  { value: 'light', label: 'Light', desc: '~100-150 cal', example: 'Banana' },
  { value: 'moderate', label: 'Moderate', desc: '~200-300 cal', example: 'Toast + banana' },
  { value: 'substantial', label: 'Substantial', desc: '~400-500 cal', example: 'Small meal' },
]

export default function WorkoutMealsEditor({ values, onChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Toggle for workout meals */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium text-gray-900">Include workout meals</p>
          <p className="text-sm text-gray-500">
            Add pre & post-workout nutrition to your plan
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...values, includeWorkoutMeals: !values.includeWorkoutMeals })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            values.includeWorkoutMeals ? 'bg-primary-500' : 'bg-gray-300'
          }`}
          role="switch"
          aria-checked={values.includeWorkoutMeals}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              values.includeWorkoutMeals ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Conditional options when enabled */}
      {values.includeWorkoutMeals && (
        <div className="space-y-6 animate-fadeIn">
          {/* Workout time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              When do you usually work out?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {WORKOUT_TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...values, workoutTime: option.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    values.workoutTime === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-xs text-gray-500">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pre-workout preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pre-workout meal size?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRE_WORKOUT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...values, preWorkoutPreference: option.value })}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    values.preWorkoutPreference === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-xs text-gray-500">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Pre-workout meals are quick carbs for energy.
          Post-workout focuses on protein for recovery. Both help you hit your daily targets!
        </p>
      </div>
    </div>
  )
}
