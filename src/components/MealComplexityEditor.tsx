'use client'

import type { MealComplexity } from '@/lib/types'
import { MEAL_COMPLEXITY_LABELS } from '@/lib/types'

interface ComplexityValues {
  breakfast: MealComplexity
  lunch: MealComplexity
  dinner: MealComplexity
}

interface Props {
  values: ComplexityValues
  onChange: (values: ComplexityValues) => void
}

function ComplexityOptions({
  label,
  value,
  onSelect
}: {
  label: string
  value: MealComplexity
  onSelect: (value: MealComplexity) => void
}) {
  return (
    <div>
      <label className="block font-medium text-gray-900 mb-2">{label}</label>
      <div className="grid gap-2">
        {(Object.keys(MEAL_COMPLEXITY_LABELS) as MealComplexity[]).map((complexity) => (
          <button
            key={complexity}
            type="button"
            onClick={() => onSelect(complexity)}
            className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${
              value === complexity
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">
              {MEAL_COMPLEXITY_LABELS[complexity].title} ({MEAL_COMPLEXITY_LABELS[complexity].time})
            </div>
            <div className="text-gray-600">
              Example: {MEAL_COMPLEXITY_LABELS[complexity].example}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MealComplexityEditor({ values, onChange }: Props) {
  return (
    <div className="space-y-6">
      <ComplexityOptions
        label="Breakfast"
        value={values.breakfast}
        onSelect={(v) => onChange({ ...values, breakfast: v })}
      />
      <ComplexityOptions
        label="Lunch"
        value={values.lunch}
        onSelect={(v) => onChange({ ...values, lunch: v })}
      />
      <ComplexityOptions
        label="Dinner"
        value={values.dinner}
        onSelect={(v) => onChange({ ...values, dinner: v })}
      />
    </div>
  )
}
