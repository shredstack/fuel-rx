'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShareMealPlanModal } from '@/components/ShareMealPlanModal'

interface MealPlanSummary {
  id: string
  week_start_date: string
  title: string | null
  is_favorite: boolean
  created_at: string
  theme?: { display_name: string; emoji: string | null } | null
  shared_from_user_id?: string | null
  shared_from_user_name?: string | null
}

function getMealPlanTitle(plan: MealPlanSummary): string {
  if (plan.title) return plan.title
  if (plan.theme) {
    return `${plan.theme.emoji || ''} ${plan.theme.display_name} Meal Plan`.trim()
  }
  return `Week of ${new Date(plan.week_start_date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`
}

interface Props {
  mealPlans: MealPlanSummary[]
}

export default function HistoryClient({ mealPlans: initialPlans }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [mealPlans, setMealPlans] = useState(initialPlans)
  const [filter, setFilter] = useState<'all' | 'favorites'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [selectedPlanForShare, setSelectedPlanForShare] = useState<MealPlanSummary | null>(null)

  const handleOpenShareModal = (plan: MealPlanSummary) => {
    setSelectedPlanForShare(plan)
    setShareModalOpen(true)
  }

  const filteredPlans = filter === 'favorites'
    ? mealPlans.filter(p => p.is_favorite)
    : mealPlans

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this meal plan?')) return

    setDeletingId(id)
    const { error } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', id)

    if (!error) {
      setMealPlans(prev => prev.filter(p => p.id !== id))
    }
    setDeletingId(null)
  }

  const toggleFavorite = async (id: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('meal_plans')
      .update({ is_favorite: !currentValue })
      .eq('id', id)

    if (!error) {
      setMealPlans(prev =>
        prev.map(p =>
          p.id === id ? { ...p, is_favorite: !currentValue } : p
        )
      )
    }
  }

  if (mealPlans.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600 mb-4">You haven&apos;t created any meal plans yet.</p>
        <Link href="/dashboard" className="btn-primary">
          Create Your First Plan
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          All Plans ({mealPlans.length})
        </button>
        <button
          onClick={() => setFilter('favorites')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'favorites'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Favorites ({mealPlans.filter(p => p.is_favorite).length})
        </button>
      </div>

      {/* Plans list */}
      {filteredPlans.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-600">No favorite plans yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlans.map(plan => (
            <div key={plan.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getMealPlanTitle(plan)}
                    </h3>
                    {plan.is_favorite && (
                      <svg
                        className="w-5 h-5 text-yellow-500 fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    )}
                    {plan.shared_from_user_name && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        Shared by {plan.shared_from_user_name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Week of {new Date(plan.week_start_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })} &middot; Created {new Date(plan.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => toggleFavorite(plan.id, plan.is_favorite)}
                    className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"
                    title={plan.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg
                      className={`w-5 h-5 ${plan.is_favorite ? 'fill-current text-yellow-500' : ''}`}
                      fill={plan.is_favorite ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>

                  <Link
                    href={`/prep-view/${plan.id}`}
                    className="btn-primary bg-gradient-to-r from-primary-600 to-primary-500 text-sm flex items-center gap-1"
                    title="Batch Prep"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                    Prep
                  </Link>

                  <Link
                    href={`/meal-plan/${plan.id}`}
                    className="btn-outline text-sm"
                  >
                    View
                  </Link>

                  <Link
                    href={`/grocery-list/${plan.id}`}
                    className="btn-outline text-sm"
                  >
                    Groceries
                  </Link>

                  <button
                    onClick={() => handleOpenShareModal(plan)}
                    className="p-2 text-gray-400 hover:text-primary-500 transition-colors"
                    title="Share meal plan"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDelete(plan.id)}
                    disabled={deletingId === plan.id}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Delete plan"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal */}
      {selectedPlanForShare && (
        <ShareMealPlanModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false)
            setSelectedPlanForShare(null)
          }}
          mealPlanId={selectedPlanForShare.id}
          mealPlanTitle={getMealPlanTitle(selectedPlanForShare)}
        />
      )}
    </div>
  )
}
