'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { SavedQuickCookMeal, IngredientWithNutrition } from '@/lib/types'
import { MEAL_TYPE_LABELS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  meal: SavedQuickCookMeal
  onDelete: (id: string) => void
  onUpdate?: (updatedMeal: SavedQuickCookMeal) => void
}

function MacroDisplay({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-gray-900">{Math.round(value)}</p>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xs text-gray-400">{unit}</p>
    </div>
  )
}

export default function SavedSingleMealCard({ meal, onDelete, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(meal.name)
  const [editDescription, setEditDescription] = useState(meal.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleCopy = async () => {
    const text = formatMealAsText(meal)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = generatePrintHtml(meal)
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this meal?')) {
      onDelete(meal.id)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setEditName(meal.name)
    setEditDescription(meal.description || '')
    setExpanded(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName(meal.name)
    setEditDescription(meal.description || '')
    setError(null)
  }

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('meals')
        .update({
          name: editName.trim(),
          name_normalized: editName.trim().toLowerCase(),
          description: editDescription.trim() || null,
        })
        .eq('id', meal.id)

      if (updateError) throw updateError

      // Update local state
      if (onUpdate) {
        onUpdate({
          ...meal,
          name: editName.trim(),
          description: editDescription.trim() || null,
        })
      }

      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Use edited values if in edit mode, otherwise use meal values
  const displayName = isEditing ? editName : meal.name
  const displayDescription = isEditing ? editDescription : meal.description

  return (
    <div className="card">
      {/* Header - Always visible */}
      <div
        className="cursor-pointer"
        onClick={() => !isEditing && setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {meal.image_url && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                <Image
                  src={meal.image_url}
                  alt={displayName}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field text-lg font-semibold"
                      placeholder="Meal name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Brief description of this meal..."
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="btn-outline text-sm py-1.5 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {meal.emoji && <span className="mr-1">{meal.emoji}</span>}
                      {displayName}
                    </h3>
                    <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                      {MEAL_TYPE_LABELS[meal.meal_type]}
                    </span>
                  </div>
                  {displayDescription && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{displayDescription}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                    <span>{meal.calories} kcal</span>
                    <span>P: {meal.protein}g</span>
                    <span>C: {meal.carbs}g</span>
                    <span>F: {meal.fat}g</span>
                  </div>
                </>
              )}
            </div>
          </div>
          {!isEditing && (
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <button
                onClick={handleEdit}
                className="text-primary-600 hover:text-primary-800 text-sm"
              >
                Edit
              </button>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>

        {/* Quick stats */}
        {!isEditing && (
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            {meal.prep_time_minutes && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Prep: {meal.prep_time_minutes} min
              </span>
            )}
            {meal.cook_time_minutes && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                Cook: {meal.cook_time_minutes} min
              </span>
            )}
            {meal.servings && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Serves: {meal.servings}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && !isEditing && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-6">
          {/* Macros */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg">
            <MacroDisplay label="Calories" value={meal.calories} unit="kcal" />
            <MacroDisplay label="Protein" value={meal.protein} unit="g" />
            <MacroDisplay label="Carbs" value={meal.carbs} unit="g" />
            <MacroDisplay label="Fat" value={meal.fat} unit="g" />
          </div>

          {/* Ingredients */}
          {meal.ingredients && meal.ingredients.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Ingredients
              </h4>
              <ul className="space-y-2">
                {(meal.ingredients as IngredientWithNutrition[]).map((ing, i) => (
                  <li key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-800">
                      <span className="font-medium">{ing.amount} {ing.unit}</span> {ing.name}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {ing.calories}cal | {ing.protein}p
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions */}
          {meal.instructions && meal.instructions.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Instructions
              </h4>
              <ol className="space-y-3">
                {meal.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-gray-700 pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tips */}
          {meal.tips && meal.tips.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Pro Tips
              </h4>
              <ul className="space-y-1 text-sm text-amber-900">
                {meal.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handlePrint}
              className="btn-outline flex-1 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={handleCopy}
              className="btn-outline flex-1 flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDelete}
              className="btn-outline text-red-600 border-red-200 hover:bg-red-50 px-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatMealAsText(meal: SavedQuickCookMeal): string {
  let text = `${meal.emoji || ''} ${meal.name}\n\n`
  if (meal.description) text += `${meal.description}\n\n`
  text += `Macros: ${meal.calories} cal | ${meal.protein}g protein | ${meal.carbs}g carbs | ${meal.fat}g fat\n`
  text += `Prep: ${meal.prep_time_minutes} min`
  if (meal.cook_time_minutes) text += ` | Cook: ${meal.cook_time_minutes} min`
  if (meal.servings) text += ` | Serves: ${meal.servings}`
  text += '\n\n'

  if (meal.ingredients && meal.ingredients.length > 0) {
    text += `INGREDIENTS:\n`
    meal.ingredients.forEach(ing => {
      text += `• ${ing.amount} ${ing.unit} ${ing.name}\n`
    })
    text += '\n'
  }

  if (meal.instructions && meal.instructions.length > 0) {
    text += `INSTRUCTIONS:\n`
    meal.instructions.forEach((step, i) => {
      text += `${i + 1}. ${step}\n`
    })
    text += '\n'
  }

  if (meal.tips && meal.tips.length > 0) {
    text += `PRO TIPS:\n`
    meal.tips.forEach(tip => {
      text += `• ${tip}\n`
    })
  }

  return text.trim()
}

function generatePrintHtml(meal: SavedQuickCookMeal): string {
  const ingredients = meal.ingredients as IngredientWithNutrition[]

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${meal.emoji || ''} ${meal.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          color: #1f2937;
        }
        h1 {
          font-size: 28px;
          margin-bottom: 8px;
        }
        .description {
          color: #6b7280;
          font-size: 16px;
          margin-bottom: 20px;
        }
        .meta {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
        }
        .meta-item {
          text-align: center;
        }
        .meta-value {
          font-size: 20px;
          font-weight: bold;
        }
        .meta-label {
          font-size: 12px;
          color: #6b7280;
        }
        .section {
          margin-bottom: 24px;
        }
        .section h2 {
          font-size: 18px;
          margin-bottom: 12px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 8px;
        }
        .ingredients li {
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .instructions li {
          padding: 8px 0;
          margin-left: 20px;
        }
        .tips {
          background: #fef3c7;
          padding: 16px;
          border-radius: 8px;
        }
        .tips h2 {
          color: #92400e;
          border-bottom-color: #fcd34d;
        }
        .tips li {
          color: #78350f;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <h1>${meal.emoji || ''} ${meal.name}</h1>
      ${meal.description ? `<p class="description">${meal.description}</p>` : ''}

      <div class="meta">
        <div class="meta-item">
          <div class="meta-value">${meal.calories}</div>
          <div class="meta-label">Calories</div>
        </div>
        <div class="meta-item">
          <div class="meta-value">${meal.protein}g</div>
          <div class="meta-label">Protein</div>
        </div>
        <div class="meta-item">
          <div class="meta-value">${meal.carbs}g</div>
          <div class="meta-label">Carbs</div>
        </div>
        <div class="meta-item">
          <div class="meta-value">${meal.fat}g</div>
          <div class="meta-label">Fat</div>
        </div>
        ${meal.prep_time_minutes ? `
        <div class="meta-item">
          <div class="meta-value">${meal.prep_time_minutes} min</div>
          <div class="meta-label">Prep Time</div>
        </div>` : ''}
        ${meal.cook_time_minutes ? `
        <div class="meta-item">
          <div class="meta-value">${meal.cook_time_minutes} min</div>
          <div class="meta-label">Cook Time</div>
        </div>` : ''}
        ${meal.servings ? `
        <div class="meta-item">
          <div class="meta-value">${meal.servings}</div>
          <div class="meta-label">Servings</div>
        </div>` : ''}
      </div>

      ${ingredients.length > 0 ? `
      <div class="section">
        <h2>Ingredients</h2>
        <ul class="ingredients">
          ${ingredients.map(ing => `<li><strong>${ing.amount} ${ing.unit}</strong> ${ing.name}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${meal.instructions && meal.instructions.length > 0 ? `
      <div class="section">
        <h2>Instructions</h2>
        <ol class="instructions">
          ${meal.instructions.map(step => `<li>${step}</li>`).join('')}
        </ol>
      </div>` : ''}

      ${meal.tips && meal.tips.length > 0 ? `
      <div class="section tips">
        <h2>Pro Tips</h2>
        <ul>
          ${meal.tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>
      </div>` : ''}
    </body>
    </html>
  `
}
