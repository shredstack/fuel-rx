'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'
import MacroInput from '@/components/ui/MacroInput'

interface NutritionGoalsCardProps {
  profile: UserProfile
}

export default function NutritionGoalsCard({ profile }: NutritionGoalsCardProps) {
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Local state for editing
  const [calories, setCalories] = useState(profile.target_calories)
  const [protein, setProtein] = useState(profile.target_protein)
  const [carbs, setCarbs] = useState(profile.target_carbs)
  const [fat, setFat] = useState(profile.target_fat)

  // Calculate percentages for visual bars
  const totalMacroCalories = (protein * 4) + (carbs * 4) + (fat * 9)
  const proteinPercent = totalMacroCalories > 0 ? Math.round((protein * 4 / totalMacroCalories) * 100) : 0
  const carbsPercent = totalMacroCalories > 0 ? Math.round((carbs * 4 / totalMacroCalories) * 100) : 0
  const fatPercent = totalMacroCalories > 0 ? Math.round((fat * 9 / totalMacroCalories) * 100) : 0

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('user_profiles')
        .update({
          target_calories: calories,
          target_protein: protein,
          target_carbs: carbs,
          target_fat: fat,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save nutrition goals:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset to original values
    setCalories(profile.target_calories)
    setProtein(profile.target_protein)
    setCarbs(profile.target_carbs)
    setFat(profile.target_fat)
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>💪</span> My Nutrition Goals
        </h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-green-600 text-sm font-medium hover:text-green-700"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="text-gray-500 text-sm font-medium hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-green-600 text-sm font-medium hover:text-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        /* Edit Mode */
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Calories
            </label>
            <MacroInput
              macroType="calories"
              value={calories}
              onChange={setCalories}
              size="lg"
              showLabel={false}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protein (g)
              </label>
              <MacroInput
                macroType="protein"
                value={protein}
                onChange={setProtein}
                showLabel={false}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Carbs (g)
              </label>
              <MacroInput
                macroType="carbs"
                value={carbs}
                onChange={setCarbs}
                showLabel={false}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fat (g)
              </label>
              <MacroInput
                macroType="fat"
                value={fat}
                onChange={setFat}
                showLabel={false}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Calculated: {(protein * 4) + (carbs * 4) + (fat * 9)} cal from macros
          </p>
        </div>
      ) : (
        /* View Mode */
        <div>
          <div className="text-center mb-4">
            <span className="text-3xl font-bold text-gray-900">{calories.toLocaleString()}</span>
            <span className="text-gray-500 text-lg ml-1">cal/day</span>
          </div>

          {/* Visual macro breakdown */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-semibold text-gray-900">{protein}g</div>
              <div className="text-sm text-gray-500 mb-2">Protein</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${proteinPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{proteinPercent}%</div>
            </div>

            <div>
              <div className="text-xl font-semibold text-gray-900">{carbs}g</div>
              <div className="text-sm text-gray-500 mb-2">Carbs</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${carbsPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{carbsPercent}%</div>
            </div>

            <div>
              <div className="text-xl font-semibold text-gray-900">{fat}g</div>
              <div className="text-sm text-gray-500 mb-2">Fat</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${fatPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{fatPercent}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
