import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendMealPlanSharedEmail } from '@/lib/email/resend'

interface ShareRequest {
  recipientUserId: string
  includeGroceryItems?: boolean
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
    const { recipientUserId, includeGroceryItems = false } = body

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
      .select('id, social_feed_enabled, display_name, name, email')
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
        prep_sessions_day_of: originalPlan.prep_sessions_day_of,
        prep_sessions_batch: originalPlan.prep_sessions_batch,
        batch_prep_status: originalPlan.batch_prep_status,
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

    // Copy prep sessions from the original plan
    const { data: originalPrepSessions } = await supabase
      .from('prep_sessions')
      .select('session_name, session_order, estimated_minutes, prep_items, feeds_meals, instructions, daily_assembly, display_order')
      .eq('meal_plan_id', mealPlanId)

    if (originalPrepSessions && originalPrepSessions.length > 0) {
      const newPrepSessions = originalPrepSessions.map(session => ({
        meal_plan_id: newMealPlan.id,
        session_name: session.session_name,
        session_order: session.session_order,
        estimated_minutes: session.estimated_minutes,
        prep_items: session.prep_items,
        feeds_meals: session.feeds_meals,
        instructions: session.instructions,
        daily_assembly: session.daily_assembly,
        display_order: session.display_order,
      }))

      const { error: prepSessionsError } = await serviceClient
        .from('prep_sessions')
        .insert(newPrepSessions)

      if (prepSessionsError) {
        console.error('Error copying prep sessions:', prepSessionsError)
        // Non-blocking - continue with share
      }
    }

    // Conditionally copy grocery items if user opted in
    if (includeGroceryItems) {
      // Copy staples as custom items for recipient
      const { data: sharerStaples } = await supabase
        .from('meal_plan_staples')
        .select(`
          is_checked,
          staple:user_grocery_staples(display_name)
        `)
        .eq('meal_plan_id', mealPlanId)

      if (sharerStaples && sharerStaples.length > 0) {
        const customItemsFromStaples = sharerStaples
          .filter(s => s.staple) // Filter out any deleted staples
          .map(s => ({
            meal_plan_id: newMealPlan.id,
            name: Array.isArray(s.staple) ? s.staple[0]?.display_name : (s.staple as { display_name: string })?.display_name,
            is_checked: s.is_checked,
          }))
          .filter(item => item.name) // Ensure name exists

        if (customItemsFromStaples.length > 0) {
          const { error: staplesError } = await serviceClient
            .from('meal_plan_custom_items')
            .insert(customItemsFromStaples)

          if (staplesError) {
            console.error('Error copying staples as custom items:', staplesError)
            // Non-blocking - continue with share
          }
        }
      }

      // Copy custom items
      const { data: sharerCustomItems } = await supabase
        .from('meal_plan_custom_items')
        .select('name, is_checked')
        .eq('meal_plan_id', mealPlanId)

      if (sharerCustomItems && sharerCustomItems.length > 0) {
        const recipientCustomItems = sharerCustomItems.map(item => ({
          meal_plan_id: newMealPlan.id,
          name: item.name,
          is_checked: item.is_checked,
        }))

        const { error: customItemsError } = await serviceClient
          .from('meal_plan_custom_items')
          .insert(recipientCustomItems)

        if (customItemsError) {
          console.error('Error copying custom items:', customItemsError)
          // Non-blocking - continue with share
        }
      }

      // Copy grocery checks (checked state for AI-generated items)
      const { data: sharerGroceryChecks } = await supabase
        .from('meal_plan_grocery_checks')
        .select('item_name_normalized, is_checked')
        .eq('meal_plan_id', mealPlanId)

      if (sharerGroceryChecks && sharerGroceryChecks.length > 0) {
        const recipientGroceryChecks = sharerGroceryChecks.map(check => ({
          meal_plan_id: newMealPlan.id,
          item_name_normalized: check.item_name_normalized,
          is_checked: check.is_checked,
        }))

        const { error: checksError } = await serviceClient
          .from('meal_plan_grocery_checks')
          .insert(recipientGroceryChecks)

        if (checksError) {
          console.error('Error copying grocery checks:', checksError)
          // Non-blocking - continue with share
        }
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

    // Send email notification to recipient (non-blocking)
    if (recipient.email) {
      // Fetch theme name if there's a theme_id
      let themeName: string | undefined
      if (originalPlan.theme_id) {
        const { data: theme } = await supabase
          .from('meal_plan_themes')
          .select('name')
          .eq('id', originalPlan.theme_id)
          .single()
        themeName = theme?.name
      }

      sendMealPlanSharedEmail({
        to: recipient.email,
        recipientName: recipient.display_name || recipient.name || '',
        sharerName,
        mealPlanId: newMealPlan.id,
        themeName,
      }).catch((err) => {
        console.error('Error sending share notification email:', err)
      })
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
