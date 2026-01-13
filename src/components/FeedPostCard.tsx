'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { SocialFeedPost, ValidatedMealIngredient, PartyDish, PartyPrepPhase, MealType } from '@/lib/types'
import { CUSTOM_MEAL_PREP_TIME_OPTIONS, getMealTypeColorClasses, MEAL_TYPE_CONFIG } from '@/lib/types'

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
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <h6 className="font-medium text-gray-900 text-sm">{phase.title}</h6>
      </div>

      <div className="space-y-1.5">
        {phase.tasks.map((task, i) => {
          const isExpanded = expandedTasks.has(i)
          return (
            <div key={i} className="border border-gray-100 rounded overflow-hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleTask(i)
                }}
                className="w-full flex items-center justify-between gap-2 p-2 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-4 h-4 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-xs font-medium text-gray-900">{task.title}</span>
                </div>
                {task.duration && (
                  <span className="text-xs text-gray-500 flex-shrink-0">{task.duration}</span>
                )}
                <svg
                  className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-2 pb-2 pt-1 border-t border-gray-100 bg-gray-50">
                  <ol className="space-y-1">
                    {task.steps.map((step, j) => (
                      <li key={j} className="flex gap-2 text-xs text-gray-700">
                        <span className="text-gray-400 flex-shrink-0">{j + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {task.notes && (
                    <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1.5">
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

interface Props {
  post: SocialFeedPost
  onSave: (postId: string) => Promise<void>
  onUnsave: (postId: string) => Promise<void>
}

export default function FeedPostCard({ post, onSave, onUnsave }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSaved, setIsSaved] = useState(post.is_saved || false)
  const [saving, setSaving] = useState(false)

  const authorName = post.author?.display_name || post.author?.name || 'Anonymous'
  const prepTimeLabel = CUSTOM_MEAL_PREP_TIME_OPTIONS.find(
    o => o.value === post.prep_time
  )?.label

  // Get meal type label from centralized config
  const getMealTypeLabel = (mealType: MealType | null): string => {
    if (!mealType) return ''
    return MEAL_TYPE_CONFIG[mealType]?.label || mealType
  }

  // Get source type label and styling
  const getSourceTypeInfo = () => {
    switch (post.source_type) {
      case 'custom_meal':
        return { label: 'Custom', className: 'bg-green-100 text-green-800' }
      case 'favorited_meal':
        return { label: 'Favorite', className: 'bg-blue-100 text-blue-800' }
      case 'liked_meal':
        return { label: 'Liked', className: 'bg-emerald-100 text-emerald-800' }
      case 'quick_cook':
        return { label: 'Quick Cook', className: 'bg-orange-100 text-orange-800' }
      case 'party_meal':
        return { label: 'Party Plan', className: 'bg-pink-100 text-pink-800' }
      case 'cooked_meal':
        return { label: 'Cooked', className: 'bg-teal-100 text-teal-800' }
      default:
        return { label: 'Shared', className: 'bg-gray-100 text-gray-800' }
    }
  }

  const sourceTypeInfo = getSourceTypeInfo()

  const handleToggleSave = async () => {
    setSaving(true)
    try {
      if (isSaved) {
        await onUnsave(post.id)
        setIsSaved(false)
      } else {
        await onSave(post.id)
        setIsSaved(true)
      }
    } catch (error) {
      console.error('Error toggling save:', error)
    }
    setSaving(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`
      }
      return `${diffHours}h ago`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/community/users/${post.user_id}`}
            className="font-medium text-gray-900 hover:text-primary-600"
          >
            {authorName}
          </Link>
          <span className="text-sm text-gray-500">{formatDate(post.created_at)}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${sourceTypeInfo.className}`}
        >
          {sourceTypeInfo.label}
        </span>
      </div>

      {/* Cooked Photo - displayed prominently for cooked_meal posts */}
      {post.source_type === 'cooked_meal' && post.cooked_photo_url && (
        <div className="mb-4">
          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={post.cooked_photo_url}
              alt={`${post.meal_name} - cooked`}
              fill
              className="object-contain"
            />
          </div>
          {post.user_notes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 italic">&ldquo;{post.user_notes}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Meal Content */}
      <div
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex gap-4">
          {post.image_url && (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
              <Image
                src={post.image_url}
                alt={post.meal_name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {post.meal_type && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMealTypeColorClasses(post.meal_type)}`}>
                  {getMealTypeLabel(post.meal_type)}
                </span>
              )}
              {prepTimeLabel && (
                <span className="text-xs text-gray-500">{prepTimeLabel}</span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{post.meal_name}</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-gray-600">
                <span className="font-medium">{post.calories}</span> kcal
              </span>
              <span className="text-blue-600">
                <span className="font-medium">{post.protein}g</span> protein
              </span>
              <span className="text-orange-600">
                <span className="font-medium">{post.carbs}g</span> carbs
              </span>
              <span className="text-purple-600">
                <span className="font-medium">{post.fat}g</span> fat
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Party Plan Details */}
          {post.source_type === 'party_meal' && post.party_data ? (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                {post.party_data.serves && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Serves {post.party_data.serves}
                  </span>
                )}
                {post.party_data.estimated_total_prep_time && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {post.party_data.estimated_total_prep_time}
                  </span>
                )}
                {post.party_data.estimated_active_time && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Active: {post.party_data.estimated_active_time}
                  </span>
                )}
              </div>

              {/* Dishes Overview */}
              {post.party_data.dishes && post.party_data.dishes.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    What You&apos;re Making
                  </h5>
                  <div className="space-y-2">
                    {post.party_data.dishes.map((dish, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                        <RoleBadge role={dish.role} />
                        <div>
                          <span className="font-medium text-gray-900 text-sm">{dish.name}</span>
                          <p className="text-xs text-gray-600 mt-0.5">{dish.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {post.party_data.timeline && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Prep Timeline
                  </h5>
                  <div className="space-y-2">
                    {post.party_data.timeline.days_before && (
                      <PrepPhaseSection phase={post.party_data.timeline.days_before} icon={PHASE_ICONS.days_before} />
                    )}
                    {post.party_data.timeline.day_of_morning && (
                      <PrepPhaseSection phase={post.party_data.timeline.day_of_morning} icon={PHASE_ICONS.day_of_morning} />
                    )}
                    {post.party_data.timeline.hours_before && (
                      <PrepPhaseSection phase={post.party_data.timeline.hours_before} icon={PHASE_ICONS.hours_before} />
                    )}
                    {post.party_data.timeline.right_before && (
                      <PrepPhaseSection phase={post.party_data.timeline.right_before} icon={PHASE_ICONS.right_before} />
                    )}
                  </div>
                </div>
              )}

              {/* Shopping List */}
              {post.party_data.shopping_list && post.party_data.shopping_list.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Shopping List
                  </h5>
                  <ul className="space-y-1 bg-gray-50 rounded-lg p-3">
                    {post.party_data.shopping_list.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-3 h-3 border border-gray-300 rounded flex-shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium">{item.quantity}</span> {item.item}
                          {item.notes && (
                            <span className="text-gray-500 ml-1">({item.notes})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pro Tips */}
              {post.party_data.pro_tips && post.party_data.pro_tips.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <h5 className="font-medium text-amber-800 mb-2 flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Pro Tips
                  </h5>
                  <ul className="space-y-1 text-xs text-amber-900">
                    {post.party_data.pro_tips.map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-600 flex-shrink-0">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Regular meal details (ingredients & instructions) */
            <div className="grid md:grid-cols-2 gap-6">
              {/* Ingredients */}
              {post.ingredients && post.ingredients.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Ingredients</h5>
                  <ul className="space-y-1">
                    {(post.ingredients as ValidatedMealIngredient[]).map((ing, idx) => (
                      <li key={idx} className="text-sm text-gray-600">
                        {ing.amount} {ing.unit} {ing.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Instructions */}
              {post.instructions && post.instructions.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Instructions</h5>
                  <ol className="space-y-2">
                    {post.instructions.map((step, idx) => (
                      <li key={idx} className="text-sm text-gray-600">
                        <span className="font-medium text-gray-700">{idx + 1}.</span> {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {isExpanded ? 'Show less' : 'Show more'}
        </button>

        <button
          onClick={handleToggleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            isSaved
              ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {saving ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg
              className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`}
              fill={isSaved ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          )}
          {isSaved ? 'Saved' : 'Save to My Meals'}
        </button>
      </div>
    </div>
  )
}
