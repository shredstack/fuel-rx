'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MILESTONE_MESSAGES } from '@/lib/types'
import type { UserProfile, OnboardingMilestone, ProteinFocusConstraint, MealPlanRateLimitStatus } from '@/lib/types'
import ThemeSelector, { type ThemeSelection } from '@/components/ThemeSelector'
import ProteinFocusPicker from '@/components/ProteinFocusPicker'
import QuickCookCard from '@/components/QuickCookCard'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { useSubscription } from '@/hooks/useSubscription'
import { useJobStatus } from '@/hooks/queries/useJobStatus'
import CommunityTeaser from '@/components/onboarding/CommunityTeaser'
import MealLoggingTeaser from '@/components/onboarding/MealLoggingTeaser'
import MotivationalToast from '@/components/onboarding/MotivationalToast'
import PaywallModal from '@/components/PaywallModal'
import NutritionDisclaimer from '@/components/NutritionDisclaimer'
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
  hasLoggedFood: boolean
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

// Helper function to format relative time for rate limit display
function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) {
    return 'in less than an hour'
  } else if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`
  } else if (diffDays === 1) {
    return 'tomorrow'
  } else {
    return `in ${diffDays} days`
  }
}

// Rate limit banner component for Pro/VIP users
function RateLimitBanner({ rateLimitStatus }: { rateLimitStatus: MealPlanRateLimitStatus | null }) {
  if (!rateLimitStatus) return null

  const { plansRemaining, plansUsedThisWeek, weeklyLimit, nextSlotAvailableAt } = rateLimitStatus

  // Show nothing if they have plenty of plans remaining
  if (plansRemaining >= 2) return null

  // Warning state: 1 plan remaining
  if (plansRemaining === 1) {
    return (
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              1 meal plan remaining this week
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              You&apos;ve used {plansUsedThisWeek} of {weeklyLimit} weekly plans
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Blocked state: 0 plans remaining
  if (plansRemaining === 0 && nextSlotAvailableAt) {
    const formattedTime = formatRelativeTime(nextSlotAvailableAt)

    return (
      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900">
              Weekly limit reached
            </p>
            <p className="text-sm text-gray-600 mt-1">
              You&apos;ve generated {plansUsedThisWeek} meal plans this week.
              Your next slot opens <span className="font-medium">{formattedTime}</span>.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Tip: Use meal swap to customize your current plan instead of regenerating.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function DashboardClient({ profile: initialProfile, recentPlan, hasLoggedFood }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(initialProfile)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  // Use React Query for job status polling
  const { data: jobStatus } = useJobStatus(currentJobId, {
    enabled: generating && !!currentJobId,
  })

  // Derive progress state from job status
  const progressStage = jobStatus?.status || (generating ? 'pending' : null)
  const progressMessage = jobStatus?.progressMessage || ''

  // Helper to handle errors with user-friendly messages
  const handleJobError = (errorMessage: string) => {
    setGenerating(false)
    setCurrentJobId(null)
    // Provide user-friendly message for specific error types
    if (errorMessage.includes('prep sessions') || errorMessage.includes('generate')) {
      setError('Failed to generate your meal plan. Please try again later.')
    } else {
      setError(errorMessage)
    }
  }

  // Handle job completion/failure
  useEffect(() => {
    if (!jobStatus) return

    // Check for error field in job response
    if (jobStatus.error) {
      handleJobError(jobStatus.error)
      return
    }

    if (jobStatus.status === 'completed' && jobStatus.mealPlanId) {
      setGenerating(false)
      setCurrentJobId(null)
      router.push(`/meal-plan/${jobStatus.mealPlanId}`)
    } else if (jobStatus.status === 'failed') {
      handleJobError(jobStatus.errorMessage || 'Failed to generate meal plan')
    }
  }, [jobStatus, router])

  // Theme selection state
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>({ type: 'surprise' })

  // Protein focus state
  const [proteinFocus, setProteinFocus] = useState<ProteinFocusConstraint | null>(null)

  // Subscription state
  const { isSubscribed, canGeneratePlan, hasMealPlanGeneration, freePlansRemaining, isOverride, status: subscriptionStatus, rateLimitStatus, refresh: refreshSubscription } = useSubscription()
  const [showPaywall, setShowPaywall] = useState(false)
  const [rateLimitError, setRateLimitError] = useState<{ message: string; nextSlotAvailableAt: string | null } | null>(null)

  // Onboarding state
  const { state: onboardingState, isFeatureDiscovered, discoverFeature } = useOnboardingState()
  const [showMilestoneToast, setShowMilestoneToast] = useState<OnboardingMilestone | null>(null)
  const [shownMilestones, setShownMilestones] = useState<Set<OnboardingMilestone>>(new Set())

  // Show toast for milestone achievements
  useEffect(() => {
    if (!onboardingState) return

    const now = Date.now()
    const recentThreshold = 10000 // 10 seconds

    // first_plan_completed only shows if it happened recently (within 30 seconds)
    // This prevents showing the toast to long-time users on every page load
    if (
      onboardingState.first_plan_completed &&
      onboardingState.first_plan_completed_at &&
      !shownMilestones.has('first_plan_completed')
    ) {
      const completedAt = new Date(onboardingState.first_plan_completed_at).getTime()
      const timeSinceCompletion = now - completedAt
      // Only show if completed within the last 30 seconds
      if (timeSinceCompletion < 30000) {
        setShowMilestoneToast('first_plan_completed')
        setShownMilestones(prev => new Set([...prev, 'first_plan_completed']))
        return
      }
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
    // Check if user can generate a plan before starting
    if (!canGeneratePlan) {
      setShowPaywall(true)
      return
    }

    setGenerating(true)
    setError(null)
    setCurrentJobId(null) // Clear any previous job

    try {
      // Determine themeSelection value to send to API
      const themeSelectionValue =
        themeSelection.type === 'surprise' ? 'surprise' :
        themeSelection.type === 'none' ? 'none' :
        themeSelection.themeId

      // Build request body - only include proteinFocus if a protein is selected
      const requestBody: { themeSelection: string; proteinFocus?: ProteinFocusConstraint } = {
        themeSelection: themeSelectionValue,
      }
      if (proteinFocus?.protein) {
        requestBody.proteinFocus = proteinFocus
      }

      // Start the job
      const startResponse = await fetch('/api/generate-meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      // Handle 402 Payment Required (free plan limit reached)
      if (startResponse.status === 402) {
        setShowPaywall(true)
        setGenerating(false)
        return
      }

      // Handle 429 Too Many Requests (weekly rate limit reached for Pro/VIP)
      if (startResponse.status === 429) {
        const data = await startResponse.json()
        setRateLimitError({
          message: data.message,
          nextSlotAvailableAt: data.rateLimitStatus?.nextSlotAvailableAt ?? null,
        })
        setGenerating(false)
        // Refresh subscription to update rateLimitStatus
        refreshSubscription()
        return
      }

      if (!startResponse.ok) {
        const data = await startResponse.json()
        throw new Error(data.error || 'Failed to start meal plan generation')
      }

      const { jobId } = await startResponse.json()

      // Set the job ID - React Query will automatically start polling
      setCurrentJobId(jobId)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      setError(errorMessage)
      setGenerating(false)
      setCurrentJobId(null)
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

            {/* Rate limit warning for Pro/VIP users */}
            {(hasMealPlanGeneration || isOverride) && !generating && (
              <RateLimitBanner rateLimitStatus={rateLimitStatus} />
            )}

            {/* Theme selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose a theme
              </label>
              <ThemeSelector
                value={themeSelection}
                onChange={setThemeSelection}
                disabled={generating}
              />
            </div>

            {/* Protein focus picker */}
            <div className="mb-6">
              <ProteinFocusPicker
                value={proteinFocus}
                onChange={setProteinFocus}
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

            {/* Rate limit error message */}
            {rateLimitError && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Weekly limit reached</p>
                    <p className="text-sm text-gray-600 mt-1">{rateLimitError.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Tip: Use meal swap to customize your current plan instead of regenerating.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRateLimitError(null)}
                  className="mt-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Free plans remaining indicator */}
            {subscriptionStatus && !isSubscribed && !generating && !rateLimitError && (
              <div className="mt-3 text-center">
                {freePlansRemaining > 0 ? (
                  <p className="text-sm text-gray-500">
                    {freePlansRemaining} of {subscriptionStatus.freePlanLimit} free plans remaining
                  </p>
                ) : (
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>
            )}

            {/* Pro/VIP subscriber badge with rate limit status */}
            {(hasMealPlanGeneration || isOverride) && !generating && !rateLimitError && (
              <div className="mt-3 text-center">
                <span className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {isOverride ? 'VIP Access' : 'FuelRx Pro'}
                </span>
                {rateLimitStatus && (
                  <p className="text-xs text-gray-500 mt-1">
                    {rateLimitStatus.plansRemaining} of {rateLimitStatus.weeklyLimit} plans remaining this week
                  </p>
                )}
              </div>
            )}

            {/* Basic subscriber message (has AI features but not meal plan generation) */}
            {isSubscribed && !hasMealPlanGeneration && !isOverride && !generating && (
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-500">
                  FuelRx Basic - {freePlansRemaining} free plans remaining
                </p>
                <button
                  onClick={() => setShowPaywall(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-1"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}

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
                <div className="flex flex-col gap-3">
                  <Link
                    href={`/meal-plan/${recentPlan.id}`}
                    className="btn-primary text-center"
                  >
                    View Plan
                  </Link>
                  <div className="flex gap-3">
                    <Link
                      href={`/prep-view/${recentPlan.id}`}
                      className="btn-outline flex-1 text-center flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                      </svg>
                      Start Cooking
                    </Link>
                    <Link
                      href={`/grocery-list/${recentPlan.id}`}
                      className="btn-outline flex-1 text-center"
                    >
                      Grocery List
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-600 mt-2">
                Generate your first meal plan to get started!
                If you recently completed onboarding, your first plan is generating in the background. You'll recieve an email once finished or refresh this page in 5-10 minutes. 😀
              </p>
            )}
          </div>

          {/* Quick Cook card */}
          <QuickCookCard />

          {/* Community teaser - shown to users who haven't joined and haven't dismissed */}
          {onboardingState && !isFeatureDiscovered('community_feed') && !profile?.social_feed_enabled && (
            <div className="md:col-span-2 lg:col-span-3">
              <CommunityTeaser onDismiss={() => discoverFeature('community_feed')} />
            </div>
          )}

          {/* Meal logging teaser - shown to users who haven't logged any food yet */}
          {onboardingState && !isFeatureDiscovered('meal_logging') && !hasLoggedFood && (
            <div className="md:col-span-2 lg:col-span-3">
              <MealLoggingTeaser onDismiss={() => discoverFeature('meal_logging')} />
            </div>
          )}

          {/* Nutrition disclaimer for Apple App Store compliance */}
          <div className="md:col-span-2 lg:col-span-3">
            <NutritionDisclaimer />
          </div>
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

        {/* Paywall Modal */}
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => {
            setShowPaywall(false)
            // Refresh subscription status in case user subscribed
            refreshSubscription()
          }}
        />
      </main>

      <MobileTabBar />
    </div>
  )
}
