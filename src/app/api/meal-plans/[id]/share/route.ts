import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

interface ShareRequest {
  recipientUserId: string
}

// Create a service-role client that bypasses RLS for cross-user operations
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or service role key')
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: mealPlanId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: ShareRequest = await request.json()
    const { recipientUserId } = body

    if (!recipientUserId) {
      return NextResponse.json({ error: 'Recipient user ID is required' }, { status: 400 })
    }

    // Verify the sharer owns this meal plan
    const { data: originalPlan, error: planError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single()

    if (planError || !originalPlan) {
      return NextResponse.json({ error: 'Meal plan not found or not owned by you' }, { status: 404 })
    }

    // Verify recipient is opted into community
    const { data: recipient, error: recipientError } = await supabase
      .from('user_profiles')
      .select('id, social_feed_enabled, display_name, name')
      .eq('id', recipientUserId)
      .single()

    if (recipientError || !recipient || !recipient.social_feed_enabled) {
      return NextResponse.json({ error: 'Recipient has not opted into the community' }, { status: 400 })
    }

    // Get the sharer's name for denormalization
    const { data: sharer } = await supabase
      .from('user_profiles')
      .select('display_name, name')
      .eq('id', user.id)
      .single()

    const sharerName = sharer?.display_name || sharer?.name || 'Someone'

    // Check if already shared to this user
    const { data: existingShare } = await supabase
      .from('shared_meal_plans')
      .select('id')
      .eq('original_meal_plan_id', mealPlanId)
      .eq('recipient_user_id', recipientUserId)
      .single()

    if (existingShare) {
      return NextResponse.json({ error: 'Meal plan already shared with this user' }, { status: 400 })
    }

    // Use service role client for cross-user operations (bypasses RLS)
    const serviceClient = createServiceRoleClient()

    // Create a copy of the meal plan for the recipient
    const { data: newMealPlan, error: createPlanError } = await serviceClient
      .from('meal_plans')
      .insert({
        user_id: recipientUserId,
        week_start_date: originalPlan.week_start_date,
        title: originalPlan.title,
        is_favorite: false,
        theme_id: originalPlan.theme_id,
        core_ingredients: originalPlan.core_ingredients,
        prep_style: originalPlan.prep_style,
        shared_from_user_id: user.id,
        shared_from_user_name: sharerName,
      })
      .select()
      .single()

    if (createPlanError || !newMealPlan) {
      console.error('Error creating meal plan copy:', createPlanError)
      return NextResponse.json({ error: 'Failed to share meal plan' }, { status: 500 })
    }

    // Get all meal_plan_meals from the original plan
    const { data: originalMeals, error: mealsError } = await supabase
      .from('meal_plan_meals')
      .select('*')
      .eq('meal_plan_id', mealPlanId)

    if (mealsError) {
      console.error('Error fetching original meals:', mealsError)
      // Clean up the created plan
      await serviceClient.from('meal_plans').delete().eq('id', newMealPlan.id)
      return NextResponse.json({ error: 'Failed to share meal plan' }, { status: 500 })
    }

    // Create copies of meal_plan_meals for the new plan
    if (originalMeals && originalMeals.length > 0) {
      const newMealPlanMeals = originalMeals.map(mpm => ({
        meal_plan_id: newMealPlan.id,
        meal_id: mpm.meal_id,
        day: mpm.day,
        meal_type: mpm.meal_type,
        snack_number: mpm.snack_number,
        position: mpm.position,
        is_original: true, // Reset for the recipient
        swapped_from_meal_id: null,
        swapped_at: null,
      }))

      const { error: insertMealsError } = await serviceClient
        .from('meal_plan_meals')
        .insert(newMealPlanMeals)

      if (insertMealsError) {
        console.error('Error copying meal plan meals:', insertMealsError)
        // Clean up the created plan
        await serviceClient.from('meal_plans').delete().eq('id', newMealPlan.id)
        return NextResponse.json({ error: 'Failed to share meal plan' }, { status: 500 })
      }
    }

    // Record the sharing relationship
    const { error: shareError } = await serviceClient
      .from('shared_meal_plans')
      .insert({
        original_meal_plan_id: mealPlanId,
        recipient_meal_plan_id: newMealPlan.id,
        sharer_user_id: user.id,
        recipient_user_id: recipientUserId,
      })

    if (shareError) {
      console.error('Error recording share:', shareError)
      // Clean up the created plan
      await serviceClient.from('meal_plans').delete().eq('id', newMealPlan.id)
      return NextResponse.json({ error: 'Failed to record sharing' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Meal plan shared with ${recipient.display_name || recipient.name}`,
      recipientMealPlanId: newMealPlan.id,
    })
  } catch (error) {
    console.error('Error sharing meal plan:', error)
    return NextResponse.json({ error: 'Failed to share meal plan' }, { status: 500 })
  }
}
