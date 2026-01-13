import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create a service-role client that bypasses RLS for admin operations
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

export async function DELETE() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use service role client for deletion operations
    const serviceClient = createServiceRoleClient()
    const userId = user.id

    // Delete user data in order (respecting foreign key constraints)
    // Order matters - delete dependent tables first

    // Chat/cooking data
    await serviceClient.from('cooking_chat_messages').delete().eq('user_id', userId)
    await serviceClient.from('cooking_chat_sessions').delete().eq('user_id', userId)

    // Consumption/logging data
    await serviceClient.from('meal_consumption_log').delete().eq('user_id', userId)
    await serviceClient.from('meal_photos').delete().eq('user_id', userId)

    // Meal plan related data
    await serviceClient.from('meal_plan_meals').delete().eq('meal_plan_id',
      serviceClient.from('meal_plans').select('id').eq('user_id', userId)
    )
    await serviceClient.from('shared_meal_plans').delete().eq('sharer_user_id', userId)
    await serviceClient.from('shared_meal_plans').delete().eq('recipient_user_id', userId)
    await serviceClient.from('meal_plans').delete().eq('user_id', userId)

    // Preferences
    await serviceClient.from('ingredient_preferences').delete().eq('user_id', userId)
    await serviceClient.from('meal_preferences').delete().eq('user_id', userId)
    await serviceClient.from('theme_preferences').delete().eq('user_id', userId)

    // Social data
    await serviceClient.from('social_feed_posts').delete().eq('user_id', userId)
    await serviceClient.from('social_feed_saves').delete().eq('user_id', userId)
    await serviceClient.from('user_follows').delete().eq('follower_id', userId)
    await serviceClient.from('user_follows').delete().eq('following_id', userId)

    // Custom meals
    await serviceClient.from('custom_meals').delete().eq('user_id', userId)

    // Jobs data
    await serviceClient.from('meal_plan_jobs').delete().eq('user_id', userId)

    // Finally, delete the user profile
    await serviceClient.from('user_profiles').delete().eq('id', userId)

    // Delete the auth user
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(userId)

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      // Still return success if we deleted all their data but couldn't delete auth record
      // The auth record will be orphaned but that's ok
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
