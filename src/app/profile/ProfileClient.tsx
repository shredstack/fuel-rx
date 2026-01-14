'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'
import ProfileHeader from '@/components/profile/ProfileHeader'
import NutritionGoalsCard from '@/components/profile/NutritionGoalsCard'
import WinsCard from '@/components/profile/WinsCard'
import type {
  UserProfile,
  IngredientPreferenceWithDetails,
  MealPreference,
  DietaryPreference,
  SelectableMealType
} from '@/lib/types'
import {
  PREP_STYLE_LABELS,
  MEAL_COMPLEXITY_LABELS,
  DEFAULT_PREP_STYLE,
  DEFAULT_MEAL_COMPLEXITY_PREFS,
  DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
  DAYS_OF_WEEK
} from '@/lib/types'

interface ProfileClientProps {
  profile: UserProfile
  ingredientPrefs: IngredientPreferenceWithDetails[]
  mealPrefs: MealPreference[]
  mealPlanCount: number
}

// Icon components
const ChevronRightIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const DIETARY_LABELS: Record<DietaryPreference, string> = {
  no_restrictions: 'No Restrictions',
  vegetarian: 'Vegetarian',
  paleo: 'Paleo',
  gluten_free: 'Gluten-Free',
  dairy_free: 'Dairy-Free',
}

export default function ProfileClient({
  profile,
  ingredientPrefs,
  mealPlanCount
}: ProfileClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const response = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete account')
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Failed to delete account:', err)
      setDeleting(false)
    }
  }

  // Calculate summaries for display
  const likedCount = ingredientPrefs.filter(p => p.preference === 'liked').length
  const dislikedCount = ingredientPrefs.filter(p => p.preference === 'disliked').length

  const restrictions = profile.dietary_prefs?.filter(r => r !== 'no_restrictions') || []
  const restrictionsSummary = restrictions.length > 0
    ? restrictions.map(r => DIETARY_LABELS[r]).join(', ')
    : 'None'

  const prepStyleLabel = PREP_STYLE_LABELS[profile.prep_style as keyof typeof PREP_STYLE_LABELS]?.title || 'Day-Of Fresh Cooking'
  const breakfastLabel = MEAL_COMPLEXITY_LABELS[profile.breakfast_complexity as keyof typeof MEAL_COMPLEXITY_LABELS]?.title || 'Minimal Prep'

  // Meal types summary
  const selectedMeals = profile.selected_meal_types || ['breakfast', 'lunch', 'dinner']
  const hasWorkoutMeals = selectedMeals.includes('pre_workout') || selectedMeals.includes('post_workout')
  const snackCount = profile.snack_count || 0
  const mealTypesSummary = `${selectedMeals.filter((m: SelectableMealType) => !['pre_workout', 'post_workout'].includes(m)).length} meals${hasWorkoutMeals ? ' + workout meals' : ''}${snackCount > 0 ? ` + ${snackCount} snack${snackCount > 1 ? 's' : ''}` : ''}`

  // Household summary
  const servings = profile.household_servings || DEFAULT_HOUSEHOLD_SERVINGS_PREFS
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const
  const hasHousehold = DAYS_OF_WEEK.some(day =>
    mealTypes.some(meal => servings[day]?.[meal]?.adults > 0 || servings[day]?.[meal]?.children > 0)
  )
  const householdSummary = hasHousehold ? 'Family meals configured' : 'Just me'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar />

      {/* Header with rainbow gradient */}
      <div className="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 pt-4 relative overflow-hidden">
        <div className="px-4 py-6">
          <ProfileHeader
            displayName={profile.display_name || profile.name}
            email={profile.email}
            mealPlanCount={mealPlanCount}
            profilePhotoUrl={profile.profile_photo_url}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-4 space-y-6">
        {/* Wins/Stats - Celebrate achievements */}
        <WinsCard />

        {/* Nutrition Goals - Inline editable */}
        <NutritionGoalsCard profile={profile} />

        {/* Settings Links - Grouped by category */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>🍽️</span> Meal Preferences
          </h2>
          <div className="space-y-2">
            <Link
              href="/settings/meal-types"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Meal Types & Variety</h3>
                <p className="text-sm text-gray-500">{mealTypesSummary}</p>
              </div>
              <ChevronRightIcon />
            </Link>

            <Link
              href="/settings/prep"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Meal Prep Style</h3>
                <p className="text-sm text-gray-500">{prepStyleLabel} · Breakfast: {breakfastLabel}</p>
              </div>
              <ChevronRightIcon />
            </Link>

            <Link
              href="/settings/ingredients"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Ingredient Preferences</h3>
                <p className="text-sm text-gray-500">{likedCount} liked · {dislikedCount} disliked · {restrictionsSummary}</p>
              </div>
              <ChevronRightIcon />
            </Link>

            <Link
              href="/settings/ingredient-variety"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Ingredient Variety</h3>
                <p className="text-sm text-gray-500">Items per category on grocery list</p>
              </div>
              <ChevronRightIcon />
            </Link>

            <Link
              href="/settings/themes"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Meal Plan Themes</h3>
                <p className="text-sm text-gray-500">Preferred and blocked themes</p>
              </div>
              <ChevronRightIcon />
            </Link>

            <Link
              href="/settings/household"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Household Size</h3>
                <p className="text-sm text-gray-500">{householdSummary}</p>
              </div>
              <ChevronRightIcon />
            </Link>
          </div>
        </div>

        {/* Profile & Social */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>👤</span> Profile & Social
          </h2>
          <div className="space-y-2">
            <Link
              href="/settings/profile"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-gray-100 text-gray-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Edit Profile</h3>
                <p className="text-sm text-gray-500">Name, weight, profile photo</p>
              </div>
              <ChevronRightIcon />
            </Link>

            <Link
              href="/settings/social"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Social Feed Settings</h3>
                <p className="text-sm text-gray-500">{profile.social_feed_enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <ChevronRightIcon />
            </Link>
          </div>
        </div>

        {/* Help */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>💡</span> Help
          </h2>
          <div className="space-y-2">
            <Link
              href="/settings/tutorial"
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Replay Tutorial</h3>
                <p className="text-sm text-gray-500">Review the meal plan walkthrough</p>
              </div>
              <ChevronRightIcon />
            </Link>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 p-4 pb-2 flex items-center gap-2">
            <span>⚙️</span> Account
          </h2>

          <button
            onClick={handleSignOut}
            className="w-full p-4 text-left text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            Sign Out
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full p-4 text-left text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
            >
              Delete Account
            </button>
          ) : (
            <div className="p-4 bg-red-50 border-t border-gray-100">
              <p className="text-sm text-red-800 mb-3">
                Are you sure? This will permanently delete all your meal plans, preferences, and account data.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 px-4 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2 px-4 text-white bg-red-600 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MobileTabBar />
    </div>
  )
}
