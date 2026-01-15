import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import TestModeBanner from '@/components/TestModeBanner'

// Disable caching for this page - always fetch fresh data
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check if user has completed onboarding
  const { data: onboardingState } = await supabase
    .from('user_onboarding_state')
    .select('profile_completed')
    .eq('user_id', user.id)
    .single()

  // Redirect to onboarding if not completed
  if (!onboardingState?.profile_completed) {
    redirect('/onboarding')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get most recent meal plan - use maybeSingle() to handle no results gracefully
  const { data: recentPlan } = await supabase
    .from('meal_plans')
    .select('id, week_start_date, created_at, is_favorite, title, theme_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch theme if recent plan has one
  let recentPlanWithTheme: {
    id: string
    week_start_date: string
    created_at: string
    is_favorite: boolean
    title: string | null
    theme?: { display_name: string; emoji: string | null } | null
  } | null = recentPlan ? { ...recentPlan, theme: null } : null

  if (recentPlan?.theme_id) {
    const { data: theme } = await supabase
      .from('meal_plan_themes')
      .select('display_name, emoji')
      .eq('id', recentPlan.theme_id)
      .single()

    if (theme && recentPlanWithTheme) {
      recentPlanWithTheme.theme = { display_name: theme.display_name, emoji: theme.emoji }
    }
  }

  // Check if user has ever logged any food (for meal logging teaser)
  const { count: consumptionCount } = await supabase
    .from('meal_consumption_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .limit(1)

  const hasLoggedFood = (consumptionCount ?? 0) > 0

  // Get test mode from environment (only visible in development)
  const testMode = process.env.MEAL_PLAN_TEST_MODE || null

  return (
    <>
      <TestModeBanner testMode={testMode} />
      <DashboardClient
        profile={profile}
        recentPlan={recentPlanWithTheme}
        hasLoggedFood={hasLoggedFood}
      />
    </>
  )
}
