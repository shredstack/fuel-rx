import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const supabase = await createClient()
  const { postId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the feed post
    const { data: post, error: postError } = await supabase
      .from('social_feed_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Can't save your own post
    if (post.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot save your own meal' }, { status: 400 })
    }

    // Check if already saved
    const { data: existing } = await supabase
      .from('saved_community_meals')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_post_id', postId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already saved' }, { status: 400 })
    }

    // Create saved_community_meals record
    const { error: saveError } = await supabase
      .from('saved_community_meals')
      .insert({
        user_id: user.id,
        source_post_id: postId,
        original_author_id: post.user_id,
      })

    if (saveError) {
      console.error('Error saving meal:', saveError)
      return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 })
    }

    // Determine the source type for the saved meal based on the original post
    // Party meals keep their type so they show in the Party Plans tab
    // Other meals get saved as 'user_created' so they appear in My Recipes
    const sourceType = post.source_type === 'party_meal' ? 'party_meal' : 'user_created'

    // Check if user already has a meal with this name
    const nameNormalized = post.meal_name.toLowerCase().trim()
    const { data: existingMeal } = await supabase
      .from('meals')
      .select('id')
      .eq('source_user_id', user.id)
      .eq('name_normalized', nameNormalized)
      .single()

    let savedMeal = null
    let mealError = null

    // Ensure ingredients and instructions are always arrays (never null)
    const ingredients = Array.isArray(post.ingredients) ? post.ingredients : []
    const instructions = Array.isArray(post.instructions) ? post.instructions : []

    if (existingMeal) {
      // Update existing meal with data from community post
      const updateData: Record<string, unknown> = {
        calories: post.calories ?? 0,
        protein: post.protein ?? 0,
        carbs: post.carbs ?? 0,
        fat: post.fat ?? 0,
        ingredients,
        instructions,
        image_url: post.image_url,
        is_public: false,
        prep_time_minutes: typeof post.prep_time === 'number' ? post.prep_time : 15,
        source_community_post_id: postId,
        party_data: post.party_data,
      }

      // Only set meal_type for non-party meals
      if (sourceType !== 'party_meal') {
        updateData.meal_type = post.meal_type || 'dinner'
      }

      const { data, error } = await supabase
        .from('meals')
        .update(updateData)
        .eq('id', existingMeal.id)
        .select()
        .single()
      savedMeal = data
      mealError = error
    } else {
      // Insert new meal
      // Party meals don't require meal_type, but regular meals do
      const insertData: Record<string, unknown> = {
        source_user_id: user.id,
        name: post.meal_name,
        name_normalized: nameNormalized,
        calories: post.calories ?? 0,
        protein: post.protein ?? 0,
        carbs: post.carbs ?? 0,
        fat: post.fat ?? 0,
        ingredients,
        instructions,
        is_user_created: true,
        image_url: post.image_url,
        is_public: false,
        prep_time_minutes: typeof post.prep_time === 'number' ? post.prep_time : 15,
        source_type: sourceType,
        source_community_post_id: postId,
        party_data: post.party_data,
      }

      // Only set meal_type for non-party meals
      if (sourceType !== 'party_meal') {
        insertData.meal_type = post.meal_type || 'dinner'
      }

      const { data, error } = await supabase
        .from('meals')
        .insert(insertData)
        .select()
        .single()
      savedMeal = data
      mealError = error
    }

    if (mealError) {
      console.error('Error copying meal:', mealError)
      // Still consider it saved even if copy failed
    }

    return NextResponse.json({
      saved: true,
      customMealId: savedMeal?.id || null,
    })
  } catch (error) {
    console.error('Error saving meal:', error)
    return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const supabase = await createClient()
  const { postId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the saved meal to find the meal name
    const { data: savedMeal } = await supabase
      .from('saved_community_meals')
      .select('source_post_id')
      .eq('user_id', user.id)
      .eq('source_post_id', postId)
      .single()

    if (!savedMeal) {
      return NextResponse.json({ error: 'Not saved' }, { status: 404 })
    }

    // Get the post to know which meal to potentially remove
    const { data: post } = await supabase
      .from('social_feed_posts')
      .select('meal_name')
      .eq('id', postId)
      .single()

    // Remove the saved record
    const { error: deleteError } = await supabase
      .from('saved_community_meals')
      .delete()
      .eq('user_id', user.id)
      .eq('source_post_id', postId)

    if (deleteError) {
      console.error('Error removing saved meal:', deleteError)
      return NextResponse.json({ error: 'Failed to remove saved meal' }, { status: 500 })
    }

    // Note: We don't delete from validated_meals_by_user since the user might have
    // modified it or want to keep it. They can delete it manually from custom meals.

    return NextResponse.json({ saved: false })
  } catch (error) {
    console.error('Error removing saved meal:', error)
    return NextResponse.json({ error: 'Failed to remove saved meal' }, { status: 500 })
  }
}
