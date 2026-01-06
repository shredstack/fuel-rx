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

  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Check if user needs to complete onboarding
  if (!profile || profile.target_protein === 150 && profile.target_carbs === 200 && profile.target_fat === 70) {
    // User has default values, likely hasn't completed onboarding
    // We'll still show dashboard but prompt them
  }

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

  // Get test mode from environment (only visible in development)
  const testMode = process.env.MEAL_PLAN_TEST_MODE || null

  return (
    <>
      <TestModeBanner testMode={testMode} />
      <DashboardClient
        profile={profile}
        recentPlan={recentPlanWithTheme}
      />
    </>
  )
}
