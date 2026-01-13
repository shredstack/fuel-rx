'use client'

import { MacroInput } from './ui'

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
      <MacroInput
        macroType="protein"
        value={values.target_protein}
        onChange={(val) => handleChange('target_protein', val)}
        label="Protein (g)"
        min={50}
        max={500}
        size="md"
      />

      <MacroInput
        macroType="carbs"
        value={values.target_carbs}
        onChange={(val) => handleChange('target_carbs', val)}
        label="Carbs (g)"
        min={50}
        max={600}
        size="md"
      />

      <MacroInput
        macroType="fat"
        value={values.target_fat}
        onChange={(val) => handleChange('target_fat', val)}
        label="Fat (g)"
        min={20}
        max={300}
        size="md"
      />

      <MacroInput
        macroType="calories"
        value={values.target_calories}
        onChange={() => {}}
        label="Calories (calculated)"
        disabled
        size="md"
      />
    </div>
  )
}
