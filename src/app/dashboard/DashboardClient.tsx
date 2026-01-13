'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MILESTONE_MESSAGES } from '@/lib/types'
import type { UserProfile, OnboardingMilestone } from '@/lib/types'
import ThemeSelector, { type ThemeSelection } from '@/components/ThemeSelector'
import QuickCookCard from '@/components/QuickCookCard'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import CommunityTeaser from '@/components/onboarding/CommunityTeaser'
import MotivationalToast from '@/components/onboarding/MotivationalToast'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

interface Props {
  profile: UserProfile | null
  recentPlan: {
    id: string
    week_start_date: string
    created_at: string
    is_favorite: boolean
    title: string | null
    theme?: { display_name: string; emoji: string | null } | null
  } | null
}

function getMealPlanTitle(plan: Props['recentPlan']): string {
  if (!plan) return 'Meal Plan'
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

// Progress stage configuration for visual feedback (updated for Inngest job statuses)
const PROGRESS_STAGES = {
  pending: { label: 'Starting...', icon: '⏳', progress: 5 },
  generating_ingredients: { label: 'Selecting Ingredients', icon: '🥗', progress: 25 },
  generating_meals: { label: 'Creating Meals', icon: '🍽️', progress: 50 },
  generating_prep: { label: 'Building Prep Schedule', icon: '📋', progress: 75 },
  saving: { label: 'Saving Your Plan', icon: '💾', progress: 95 },
  completed: { label: 'Done!', icon: '✅', progress: 100 },
  failed: { label: 'Failed', icon: '❌', progress: 0 },
} as const

type JobStatus = keyof typeof PROGRESS_STAGES

export default function DashboardClient({ profile: initialProfile, recentPlan }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(initialProfile)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressStage, setProgressStage] = useState<JobStatus | null>(null)
  const [progressMessage, setProgressMessage] = useState<string>('')

  // Theme selection state
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>({ type: 'surprise' })

  // Onboarding state
  const { state: onboardingState, isFeatureDiscovered, discoverFeature } = useOnboardingState()
  const [showMilestoneToast, setShowMilestoneToast] = useState<OnboardingMilestone | null>(null)
  const [shownMilestones, setShownMilestones] = useState<Set<OnboardingMilestone>>(new Set())

  // Show toast for milestone achievements
  useEffect(() => {
    if (!onboardingState) return

    const now = Date.now()
    const recentThreshold = 10000 // 10 seconds

    // first_plan_completed shows regardless of timing (user may have been away during generation)
    if (
      onboardingState.first_plan_completed &&
      !shownMilestones.has('first_plan_completed')
    ) {
      setShowMilestoneToast('first_plan_completed')
      setShownMilestones(prev => new Set([...prev, 'first_plan_completed']))
      return
    }

    // Other milestones only show if they happened recently
    const recentMilestoneChecks: OnboardingMilestone[] = [
      'first_meal_liked',
      'first_meal_swapped',
      'grocery_list_viewed',
      'prep_view_visited',
    ]

    for (const milestone of recentMilestoneChecks) {
      if (shownMilestones.has(milestone)) continue

      const timestampKey = `${milestone}_at` as keyof typeof onboardingState
      const timestamp = onboardingState[timestampKey] as string | null

      if (timestamp && now - new Date(timestamp).getTime() < recentThreshold) {
        setShowMilestoneToast(milestone)
        setShownMilestones(prev => new Set([...prev, milestone]))
        break
      }
    }
  }, [onboardingState, shownMilestones])

  const handleGeneratePlan = async () => {
    setGenerating(true)
    setError(null)
    setProgressStage('pending')
    setProgressMessage('Starting...')

    let pollInterval: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }

    try {
      // Determine themeSelection value to send to API
      const themeSelectionValue =
        themeSelection.type === 'surprise' ? 'surprise' :
        themeSelection.type === 'none' ? 'none' :
        themeSelection.themeId

      // Start the job
      const startResponse = await fetch('/api/generate-meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeSelection: themeSelectionValue }),
      })

      if (!startResponse.ok) {
        const data = await startResponse.json()
        throw new Error(data.error || 'Failed to start meal plan generation')
      }

      const { jobId } = await startResponse.json()

      // Helper to handle errors (can't throw from setInterval async callback)
      const handleError = (errorMessage: string) => {
        cleanup()
        if (errorMessage.includes('prep sessions') || errorMessage.includes('generate')) {
          setError('Failed to generate your meal plan. Please try again later.')
        } else {
          setError(errorMessage)
        }
        setGenerating(false)
        setProgressStage(null)
      }

      // Poll for status
      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/job-status/${jobId}`)
          const job = await statusResponse.json()

          if (job.error) {
            handleError(job.error)
            return
          }

          setProgressStage(job.status as JobStatus)
          setProgressMessage(job.progressMessage || '')

          if (job.status === 'completed' && job.mealPlanId) {
            cleanup()
            router.push(`/meal-plan/${job.mealPlanId}`)
          } else if (job.status === 'failed') {
            handleError(job.errorMessage || 'Failed to generate meal plan')
          }
        } catch (pollError) {
          handleError(pollError instanceof Error ? pollError.message : 'Something went wrong')
        }
      }, 3000) // Poll every 3 seconds

    } catch (err) {
      cleanup()
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      setError(errorMessage)
      setGenerating(false)
      setProgressStage(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome{profile?.name ? `, ${profile.name}` : ''}!
          </h2>
          <p className="text-gray-600 mt-1">
            Ready to fuel your training with personalized meal plans.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Generate new plan card */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Generate New Meal Plan
            </h3>
            <p className="text-gray-600 mb-4">
              Create a new 7-day meal plan based on your macro targets and preferences.
            </p>

            {/* Theme selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose a theme
              </label>
              <ThemeSelector
                value={themeSelection}
                onChange={setThemeSelection}
                disabled={generating}
              />
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="btn-primary w-full"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Meal Plan'
              )}
            </button>
            {generating && (
              <div className="mt-4 space-y-3">
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progressStage ? PROGRESS_STAGES[progressStage]?.progress || 5 : 5}%`,
                    }}
                  />
                </div>

                {/* Current stage message */}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    {progressStage && PROGRESS_STAGES[progressStage] ? (
                      <span className="flex items-center justify-center gap-2">
                        <span>{PROGRESS_STAGES[progressStage].icon}</span>
                        <span>{PROGRESS_STAGES[progressStage].label}</span>
                      </span>
                    ) : (
                      'Starting...'
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {progressMessage}
                  </p>
                </div>

                {/* Stage indicators */}
                <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                  <span className={progressStage && PROGRESS_STAGES[progressStage]?.progress >= 25 ? 'text-primary-600' : ''}>
                    Ingredients
                  </span>
                  <span className={progressStage && PROGRESS_STAGES[progressStage]?.progress >= 50 ? 'text-primary-600' : ''}>
                    Meals
                  </span>
                  <span className={progressStage && PROGRESS_STAGES[progressStage]?.progress >= 75 ? 'text-primary-600' : ''}>
                    Prep Plan
                  </span>
                </div>

                {/* Safe to leave message */}
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <span className="font-medium">This takes 5-10 minutes to generate a comprehensive whole food meal plan with a grocery list and prepping instructions/tips based on all your preferences.</span>{' '}
                    Feel free to leave this page and come back later — we&apos;ll email you when your meal plan is ready!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Recent plan card */}
          <div className="card">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
              {recentPlan ? 'Your Latest Plan' : 'No Plans Yet'}
            </p>
            {recentPlan ? (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {getMealPlanTitle(recentPlan)}
                </h3>
                <p className="text-gray-600 mb-1">
                  Week of {new Date(recentPlan.week_start_date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Created {new Date(recentPlan.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                </p>
                <div className="flex gap-3">
                  <Link
                    href={`/meal-plan/${recentPlan.id}`}
                    className="btn-primary flex-1 text-center"
                  >
                    View Plan
                  </Link>
                  <Link
                    href={`/grocery-list/${recentPlan.id}`}
                    className="btn-outline flex-1 text-center"
                  >
                    Grocery List
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-gray-600 mt-2">
                Generate your first meal plan to get started!
              </p>
            )}
          </div>

          {/* Quick Cook card */}
          <QuickCookCard />

          {/* Community teaser - shown after first plan completed and community not yet discovered */}
          {onboardingState?.first_plan_completed && !isFeatureDiscovered('community_feed') && (
            <div className="md:col-span-2 lg:col-span-3">
              <CommunityTeaser onDismiss={() => discoverFeature('community_feed')} />
            </div>
          )}
        </div>

        {/* Milestone Toast */}
        {showMilestoneToast && (
          <MotivationalToast
            title={MILESTONE_MESSAGES[showMilestoneToast].title}
            message={MILESTONE_MESSAGES[showMilestoneToast].message}
            emoji={MILESTONE_MESSAGES[showMilestoneToast].emoji}
            onDismiss={() => setShowMilestoneToast(null)}
          />
        )}
      </main>

      <MobileTabBar />
    </div>
  )
}
