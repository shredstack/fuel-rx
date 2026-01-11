'use client'

import { useState, useEffect } from 'react'
import type { SavedPartyMeal, PartyDish, PartyPrepPhase, CookingStatus, SavedMealCookingStatus } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import CookingStatusButton from './meal/CookingStatusButton'
import CookingStatusBadge from './meal/CookingStatusBadge'

interface Props {
  meal: SavedPartyMeal
  onDelete: (id: string) => void
  onUpdate?: (updatedMeal: SavedPartyMeal) => void
}

const ROLE_COLORS: Record<PartyDish['role'], string> = {
  main: 'bg-red-100 text-red-700',
  side: 'bg-green-100 text-green-700',
  appetizer: 'bg-yellow-100 text-yellow-700',
  dessert: 'bg-pink-100 text-pink-700',
  beverage: 'bg-blue-100 text-blue-700',
}

const ROLE_LABELS: Record<PartyDish['role'], string> = {
  main: 'Main',
  side: 'Side',
  appetizer: 'Appetizer',
  dessert: 'Dessert',
  beverage: 'Beverage',
}

const PHASE_ICONS: Record<string, string> = {
  days_before: '📅',
  day_of_morning: '🌅',
  hours_before: '⏰',
  right_before: '🔔',
}

function RoleBadge({ role }: { role: PartyDish['role'] }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

function PrepPhaseSection({ phase, icon }: { phase: PartyPrepPhase; icon: string }) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())

  const toggleTask = (index: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <h5 className="font-medium text-gray-900">{phase.title}</h5>
      </div>

      <div className="space-y-2">
        {phase.tasks.map((task, i) => {
          const isExpanded = expandedTasks.has(i)
          return (
            <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleTask(i)}
                className="w-full flex items-center justify-between gap-2 p-2 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{task.title}</span>
                </div>
                {task.duration && (
                  <span className="text-xs text-gray-500 flex-shrink-0">{task.duration}</span>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50">
                  <ol className="space-y-1.5">
                    {task.steps.map((step, j) => (
                      <li key={j} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-gray-400 flex-shrink-0">{j + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {task.notes && (
                    <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded mt-2">
                      <span className="font-medium">Note:</span> {task.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SavedPartyMealCard({ meal, onDelete, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copiedList, setCopiedList] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(meal.name)
  const [editDescription, setEditDescription] = useState(meal.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [cookingStatus, setCookingStatus] = useState<CookingStatus>('not_cooked')

  const supabase = createClient()
  const guide = meal.party_data

  // Load cooking status on mount
  useEffect(() => {
    const loadCookingStatus = async () => {
      try {
        const response = await fetch(`/api/saved-meals/${meal.id}/cooking-status`)
        if (response.ok) {
          const data: SavedMealCookingStatus = await response.json()
          setCookingStatus(data.cooking_status)
        }
      } catch (err) {
        console.error('Error loading cooking status:', err)
      }
    }
    loadCookingStatus()
  }, [meal.id])

  // Handle cooking status change
  const handleCookingStatusChange = async (
    status: CookingStatus,
    notes?: string
  ) => {
    try {
      const response = await fetch(`/api/saved-meals/${meal.id}/cooking-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cooking_status: status,
          modification_notes: notes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update cooking status')
      }

      setCookingStatus(status)
    } catch (err) {
      console.error('Error updating cooking status:', err)
    }
  }

  const handleCopyShoppingList = async () => {
    if (!guide?.shopping_list) return
    const text = guide.shopping_list
      .map(item => `${item.quantity} ${item.item}${item.notes ? ` (${item.notes})` : ''}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedList(true)
    setTimeout(() => setCopiedList(false), 2000)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = generatePrintHtml(meal.name, meal.description, guide)
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()
  }

  const handleDelete = () => {
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    onDelete(meal.id)
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

  if (!guide) {
    return (
      <div className="card">
        <p className="text-gray-500">Invalid party data</p>
      </div>
    )
  }

  // Use edited values if in edit mode, otherwise use meal values
  const displayName = isEditing ? editName : meal.name
  const displayDescription = isEditing ? editDescription : meal.description

  return (
    <div className="card print:shadow-none">
      {/* Header - Always visible */}
      <div
        className="cursor-pointer"
        onClick={() => !isEditing && setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-3xl flex-shrink-0">🎉</span>
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
                      placeholder="Party plan name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Brief description of this party plan..."
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
                    <h3 className="text-lg font-semibold text-gray-900">{displayName}</h3>
                    <CookingStatusBadge status={cookingStatus} />
                    {meal.source_community_post_id && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Community
                      </span>
                    )}
                  </div>
                  {displayDescription && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{displayDescription}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Serves {guide.serves}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {guide.estimated_total_prep_time}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Active: {guide.estimated_active_time}
                    </span>
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

        {/* Dishes preview */}
        {!isEditing && (
          <div className="flex flex-wrap gap-2 mt-3">
            {guide.dishes.map((dish, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <RoleBadge role={dish.role} />
                <span className="text-sm text-gray-700">{dish.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && !isEditing && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-6">
          {/* Dishes Overview */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              What You&apos;re Making
            </h4>
            <div className="space-y-2">
              {guide.dishes.map((dish, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <RoleBadge role={dish.role} />
                  <div>
                    <span className="font-medium text-gray-900">{dish.name}</span>
                    <p className="text-sm text-gray-600 mt-0.5">{dish.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Prep Timeline
            </h4>
            <div className="space-y-3">
              {guide.timeline.days_before && (
                <PrepPhaseSection phase={guide.timeline.days_before} icon={PHASE_ICONS.days_before} />
              )}
              {guide.timeline.day_of_morning && (
                <PrepPhaseSection phase={guide.timeline.day_of_morning} icon={PHASE_ICONS.day_of_morning} />
              )}
              {guide.timeline.hours_before && (
                <PrepPhaseSection phase={guide.timeline.hours_before} icon={PHASE_ICONS.hours_before} />
              )}
              {guide.timeline.right_before && (
                <PrepPhaseSection phase={guide.timeline.right_before} icon={PHASE_ICONS.right_before} />
              )}
            </div>
          </div>

          {/* Shopping List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Shopping List
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopyShoppingList()
                }}
                className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center gap-1 print:hidden"
              >
                {copiedList ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy List
                  </>
                )}
              </button>
            </div>
            <ul className="space-y-2 bg-gray-50 rounded-lg p-4">
              {guide.shopping_list.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-4 h-4 border-2 border-gray-300 rounded flex-shrink-0 mt-0.5 print:border-gray-500" />
                  <span className="flex-1 text-sm">
                    <span className="font-medium">{item.quantity}</span> {item.item}
                    {item.notes && (
                      <span className="text-gray-500 ml-1">({item.notes})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Tips */}
          {guide.pro_tips && guide.pro_tips.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Pro Tips
              </h4>
              <ul className="space-y-1 text-sm text-amber-900">
                {guide.pro_tips.map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600 flex-shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cooking Status */}
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-700">Cooking Status</span>
            <CookingStatusButton
              status={cookingStatus}
              mealName={meal.name}
              onStatusChange={handleCookingStatusChange}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 print:hidden">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePrint()
              }}
              className="btn-outline flex-1 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Guide
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              className="btn-outline text-red-600 border-red-200 hover:bg-red-50 px-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Party Plan"
        itemName={meal.name}
        itemType="party plan"
      />
    </div>
  )
}

function generatePrintHtml(name: string, description: string | null, guide: SavedPartyMeal['party_data']): string {
  const renderPhase = (phase: PartyPrepPhase | undefined, icon: string) => {
    if (!phase) return ''
    return `
      <div class="phase">
        <h3>${icon} ${phase.title}</h3>
        ${phase.tasks.map((task, i) => `
          <div class="task">
            <h4>${i + 1}. ${task.title}${task.duration ? ` <span class="duration">(${task.duration})</span>` : ''}</h4>
            <ol>
              ${task.steps.map(step => `<li>${step}</li>`).join('')}
            </ol>
            ${task.notes ? `<p class="note"><strong>Note:</strong> ${task.notes}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>🎉 ${name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          color: #1f2937;
        }
        h1 { font-size: 28px; margin-bottom: 8px; }
        h2 { font-size: 20px; margin: 24px 0 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        h3 { font-size: 16px; margin: 16px 0 8px; }
        h4 { font-size: 14px; margin: 12px 0 6px; }
        .description { color: #6b7280; font-size: 16px; margin-bottom: 20px; }
        .meta {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
        }
        .meta-item { text-align: center; }
        .meta-value { font-size: 20px; font-weight: bold; }
        .meta-label { font-size: 12px; color: #6b7280; }
        .dishes { margin-bottom: 24px; }
        .dish {
          padding: 12px;
          margin: 8px 0;
          background: #f9fafb;
          border-radius: 8px;
        }
        .dish-role {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          margin-right: 8px;
        }
        .role-main { background: #fee2e2; color: #b91c1c; }
        .role-side { background: #d1fae5; color: #047857; }
        .role-appetizer { background: #fef3c7; color: #b45309; }
        .role-dessert { background: #fce7f3; color: #be185d; }
        .role-beverage { background: #dbeafe; color: #1d4ed8; }
        .phase { margin: 16px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .task { margin: 8px 0; padding-left: 16px; }
        .task ol { margin: 8px 0; padding-left: 20px; }
        .task li { margin: 4px 0; }
        .duration { color: #6b7280; font-weight: normal; }
        .note { font-size: 13px; color: #92400e; background: #fef3c7; padding: 8px; border-radius: 4px; margin: 8px 0; }
        .shopping-list { background: #f9fafb; padding: 16px; border-radius: 8px; }
        .shopping-list li { padding: 6px 0; border-bottom: 1px solid #e5e7eb; list-style: none; }
        .shopping-list li:before { content: "☐ "; }
        .tips { background: #fef3c7; padding: 16px; border-radius: 8px; margin-top: 24px; }
        .tips h2 { color: #92400e; border-bottom-color: #fcd34d; }
        .tips li { color: #78350f; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>🎉 ${name}</h1>
      ${description ? `<p class="description">${description}</p>` : ''}

      <div class="meta">
        <div class="meta-item">
          <div class="meta-value">${guide.serves}</div>
          <div class="meta-label">Guests</div>
        </div>
        <div class="meta-item">
          <div class="meta-value">${guide.estimated_total_prep_time}</div>
          <div class="meta-label">Total Prep</div>
        </div>
        <div class="meta-item">
          <div class="meta-value">${guide.estimated_active_time}</div>
          <div class="meta-label">Active Time</div>
        </div>
      </div>

      <h2>What You're Making</h2>
      <div class="dishes">
        ${guide.dishes.map(dish => `
          <div class="dish">
            <span class="dish-role role-${dish.role}">${dish.role.toUpperCase()}</span>
            <strong>${dish.name}</strong>
            <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${dish.description}</p>
          </div>
        `).join('')}
      </div>

      <h2>Prep Timeline</h2>
      ${renderPhase(guide.timeline.days_before, '📅')}
      ${renderPhase(guide.timeline.day_of_morning, '🌅')}
      ${renderPhase(guide.timeline.hours_before, '⏰')}
      ${renderPhase(guide.timeline.right_before, '🔔')}

      <h2>Shopping List</h2>
      <ul class="shopping-list">
        ${guide.shopping_list.map(item => `
          <li><strong>${item.quantity}</strong> ${item.item}${item.notes ? ` <em>(${item.notes})</em>` : ''}</li>
        `).join('')}
      </ul>

      ${guide.pro_tips && guide.pro_tips.length > 0 ? `
      <div class="tips">
        <h2>Pro Tips</h2>
        <ul>
          ${guide.pro_tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </body>
    </html>
  `
}
