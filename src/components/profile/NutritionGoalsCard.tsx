'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'
import MacroInput from '@/components/ui/MacroInput'

interface NutritionGoalsCardProps {
  profile: UserProfile
}

// Helper to calculate percentages from macros
function calculatePercentages(protein: number, carbs: number, fat: number) {
  const totalMacroCalories = (protein * 4) + (carbs * 4) + (fat * 9)
  if (totalMacroCalories === 0) return { protein: 30, carbs: 40, fat: 30 }
  return {
    protein: Math.round((protein * 4 / totalMacroCalories) * 100),
    carbs: Math.round((carbs * 4 / totalMacroCalories) * 100),
    fat: Math.round((fat * 9 / totalMacroCalories) * 100),
  }
}

// Helper to calculate macros from calories and percentages
function calculateMacrosFromPercentages(
  calories: number,
  proteinPct: number,
  carbsPct: number,
  fatPct: number
) {
  return {
    protein: Math.round((calories * proteinPct / 100) / 4),
    carbs: Math.round((calories * carbsPct / 100) / 4),
    fat: Math.round((calories * fatPct / 100) / 9),
  }
}

export default function NutritionGoalsCard({ profile }: NutritionGoalsCardProps) {
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingPercentages, setEditingPercentages] = useState(false)

  // Local state for editing
  const [calories, setCalories] = useState(profile.target_calories)
  const [protein, setProtein] = useState(profile.target_protein)
  const [carbs, setCarbs] = useState(profile.target_carbs)
  const [fat, setFat] = useState(profile.target_fat)

  // Track percentages separately for when editing percentages directly
  const currentPercentages = useMemo(
    () => calculatePercentages(protein, carbs, fat),
    [protein, carbs, fat]
  )
  const [proteinPercent, setProteinPercent] = useState(currentPercentages.protein)
  const [carbsPercent, setCarbsPercent] = useState(currentPercentages.carbs)
  const [fatPercent, setFatPercent] = useState(currentPercentages.fat)

  // Sync percentages when macros change (when not editing percentages)
  const proteinPctDisplay = editingPercentages ? proteinPercent : currentPercentages.protein
  const carbsPctDisplay = editingPercentages ? carbsPercent : currentPercentages.carbs
  const fatPctDisplay = editingPercentages ? fatPercent : currentPercentages.fat

  // Handle calorie changes - adjust macros to maintain current percentages
  const handleCaloriesChange = (newCalories: number) => {
    setCalories(newCalories)
    // Calculate new macros based on current percentages
    const newMacros = calculateMacrosFromPercentages(
      newCalories,
      currentPercentages.protein,
      currentPercentages.carbs,
      currentPercentages.fat
    )
    setProtein(newMacros.protein)
    setCarbs(newMacros.carbs)
    setFat(newMacros.fat)
  }

  // Handle individual macro changes - update percentages
  const handleProteinChange = (value: number) => {
    setProtein(value)
    if (!editingPercentages) {
      const newPcts = calculatePercentages(value, carbs, fat)
      setProteinPercent(newPcts.protein)
      setCarbsPercent(newPcts.carbs)
      setFatPercent(newPcts.fat)
    }
  }

  const handleCarbsChange = (value: number) => {
    setCarbs(value)
    if (!editingPercentages) {
      const newPcts = calculatePercentages(protein, value, fat)
      setProteinPercent(newPcts.protein)
      setCarbsPercent(newPcts.carbs)
      setFatPercent(newPcts.fat)
    }
  }

  const handleFatChange = (value: number) => {
    setFat(value)
    if (!editingPercentages) {
      const newPcts = calculatePercentages(protein, carbs, value)
      setProteinPercent(newPcts.protein)
      setCarbsPercent(newPcts.carbs)
      setFatPercent(newPcts.fat)
    }
  }

  // Handle percentage changes - adjust macros while keeping calories fixed
  const handlePercentageChange = (
    macro: 'protein' | 'carbs' | 'fat',
    newPercent: number
  ) => {
    // Clamp to valid range
    const clampedPercent = Math.max(0, Math.min(100, newPercent))

    if (macro === 'protein') {
      setProteinPercent(clampedPercent)
      setProtein(Math.round((calories * clampedPercent / 100) / 4))
    } else if (macro === 'carbs') {
      setCarbsPercent(clampedPercent)
      setCarbs(Math.round((calories * clampedPercent / 100) / 4))
    } else {
      setFatPercent(clampedPercent)
      setFat(Math.round((calories * clampedPercent / 100) / 9))
    }
  }

  // Toggle percentage editing mode
  const togglePercentageEditing = () => {
    if (!editingPercentages) {
      // Entering percentage edit mode - sync percentages to current values
      setProteinPercent(currentPercentages.protein)
      setCarbsPercent(currentPercentages.carbs)
      setFatPercent(currentPercentages.fat)
    }
    setEditingPercentages(!editingPercentages)
  }

  // Calculate total percentage (for validation display)
  const totalPercent = proteinPctDisplay + carbsPctDisplay + fatPctDisplay

  // Validation: check if target calories matches calculated calories from macros
  const calculatedCalories = (protein * 4) + (carbs * 4) + (fat * 9)
  const caloriesDifference = calculatedCalories - calories
  const isBalanced = Math.abs(caloriesDifference) <= 2 // Allow ±2 cal tolerance for minor rounding

  // Quick fix: update calories to match macros
  const handleFixByUpdatingCalories = () => {
    setCalories(calculatedCalories)
  }

  // Quick fix: adjust macros proportionally to match target calories
  const handleFixByAdjustingMacros = () => {
    const newMacros = calculateMacrosFromPercentages(
      calories,
      currentPercentages.protein,
      currentPercentages.carbs,
      currentPercentages.fat
    )
    setProtein(newMacros.protein)
    setCarbs(newMacros.carbs)
    setFat(newMacros.fat)
    // Also update calories to match the actual result (handles rounding)
    const resultingCalories = (newMacros.protein * 4) + (newMacros.carbs * 4) + (newMacros.fat * 9)
    setCalories(resultingCalories)
    // Also update the percentage state if in percentage editing mode
    if (editingPercentages) {
      const newPcts = calculatePercentages(newMacros.protein, newMacros.carbs, newMacros.fat)
      setProteinPercent(newPcts.protein)
      setCarbsPercent(newPcts.carbs)
      setFatPercent(newPcts.fat)
    }
  }

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
      setEditingPercentages(false)
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
    // Reset percentages
    const originalPcts = calculatePercentages(
      profile.target_protein,
      profile.target_carbs,
      profile.target_fat
    )
    setProteinPercent(originalPcts.protein)
    setCarbsPercent(originalPcts.carbs)
    setFatPercent(originalPcts.fat)
    setIsEditing(false)
    setEditingPercentages(false)
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
              disabled={saving || !isBalanced}
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
              onChange={handleCaloriesChange}
              size="lg"
              showLabel={false}
              min={800}
              max={10000}
            />
            <p className="text-xs text-gray-500 mt-1">
              Changing calories will adjust macros proportionally
            </p>
          </div>

          {/* Toggle for percentage vs grams editing */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Edit by: {editingPercentages ? 'Percentages' : 'Grams'}
            </span>
            <button
              type="button"
              onClick={togglePercentageEditing}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              Switch to {editingPercentages ? 'grams' : 'percentages'}
            </button>
          </div>

          {editingPercentages ? (
            /* Percentage Editing Mode */
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-red-600 mb-1">
                    Protein %
                  </label>
                  <input
                    type="number"
                    value={proteinPercent}
                    onChange={(e) => handlePercentageChange('protein', parseInt(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full h-12 rounded-lg border-2 border-gray-300 bg-gray-50 px-3 font-medium text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{protein}g</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-600 mb-1">
                    Carbs %
                  </label>
                  <input
                    type="number"
                    value={carbsPercent}
                    onChange={(e) => handlePercentageChange('carbs', parseInt(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full h-12 rounded-lg border-2 border-gray-300 bg-gray-50 px-3 font-medium text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{carbs}g</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-yellow-600 mb-1">
                    Fat %
                  </label>
                  <input
                    type="number"
                    value={fatPercent}
                    onChange={(e) => handlePercentageChange('fat', parseInt(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full h-12 rounded-lg border-2 border-gray-300 bg-gray-50 px-3 font-medium text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{fat}g</p>
                </div>
              </div>
              {totalPercent !== 100 && (
                <p className="text-xs text-amber-600">
                  Total: {totalPercent}% (percentages don&apos;t need to equal 100%)
                </p>
              )}
            </div>
          ) : (
            /* Gram Editing Mode */
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Protein (g)
                </label>
                <MacroInput
                  macroType="protein"
                  value={protein}
                  onChange={handleProteinChange}
                  showLabel={false}
                />
                <p className="text-xs text-gray-400 mt-1">{proteinPctDisplay}%</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carbs (g)
                </label>
                <MacroInput
                  macroType="carbs"
                  value={carbs}
                  onChange={handleCarbsChange}
                  showLabel={false}
                />
                <p className="text-xs text-gray-400 mt-1">{carbsPctDisplay}%</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fat (g)
                </label>
                <MacroInput
                  macroType="fat"
                  value={fat}
                  onChange={handleFatChange}
                  showLabel={false}
                />
                <p className="text-xs text-gray-400 mt-1">{fatPctDisplay}%</p>
              </div>
            </div>
          )}

          {/* Validation feedback */}
          {isBalanced ? (
            <p className="text-xs text-green-600">
              Balanced: {calculatedCalories} cal from macros
            </p>
          ) : (
            <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Calories don&apos;t match:</span>{' '}
                Target is {calories} cal, but macros add up to {calculatedCalories} cal
                ({caloriesDifference > 0 ? '+' : ''}{caloriesDifference} cal)
              </p>
              <p className="text-xs text-amber-700">
                Fix by adjusting either calories or macros:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleFixByUpdatingCalories}
                  className="text-xs px-3 py-1.5 bg-white border border-amber-300 rounded-md text-amber-800 hover:bg-amber-100 font-medium"
                >
                  Set calories to {calculatedCalories}
                </button>
                <button
                  type="button"
                  onClick={handleFixByAdjustingMacros}
                  className="text-xs px-3 py-1.5 bg-white border border-amber-300 rounded-md text-amber-800 hover:bg-amber-100 font-medium"
                >
                  Adjust macros to match {calories} cal
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* View Mode */
        <div>
          <div className="text-center mb-4">
            <span className="text-3xl font-bold text-gray-900">{calories.toLocaleString('en-US')}</span>
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
                  style={{ width: `${currentPercentages.protein}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{currentPercentages.protein}%</div>
            </div>

            <div>
              <div className="text-xl font-semibold text-gray-900">{carbs}g</div>
              <div className="text-sm text-gray-500 mb-2">Carbs</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${currentPercentages.carbs}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{currentPercentages.carbs}%</div>
            </div>

            <div>
              <div className="text-xl font-semibold text-gray-900">{fat}g</div>
              <div className="text-sm text-gray-500 mb-2">Fat</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${currentPercentages.fat}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{currentPercentages.fat}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
