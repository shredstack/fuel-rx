'use client'

import NumericInput from './NumericInput'

interface MacroValues {
  target_protein: number
  target_carbs: number
  target_fat: number
  target_calories: number
}

interface Props {
  values: MacroValues
  onChange: (values: MacroValues) => void
}

export default function MacrosEditor({ values, onChange }: Props) {
  const handleChange = (field: keyof Omit<MacroValues, 'target_calories'>, value: number) => {
    const newValues = { ...values, [field]: value }
    // Auto-calculate calories
    newValues.target_calories = (newValues.target_protein * 4) + (newValues.target_carbs * 4) + (newValues.target_fat * 9)
    onChange(newValues)
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Protein (g)
        </label>
        <NumericInput
          value={values.target_protein}
          onChange={(val) => handleChange('target_protein', val)}
          className="input-field"
          min={50}
          max={500}
          allowEmpty={false}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Carbs (g)
        </label>
        <NumericInput
          value={values.target_carbs}
          onChange={(val) => handleChange('target_carbs', val)}
          className="input-field"
          min={50}
          max={600}
          allowEmpty={false}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fat (g)
        </label>
        <NumericInput
          value={values.target_fat}
          onChange={(val) => handleChange('target_fat', val)}
          className="input-field"
          min={20}
          max={300}
          allowEmpty={false}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Calories (calculated)
        </label>
        <input
          type="text"
          value={values.target_calories}
          className="input-field bg-gray-100"
          disabled
        />
      </div>
    </div>
  )
}
