import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CustomMealsClient from './CustomMealsClient'
import type { SavedMeal, SavedUserMeal, SavedQuickCookMeal, SavedPartyMeal } from '@/lib/types'

const BUCKET_NAME = 'meal-photos'
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7 // 7 days

export default async function CustomMealsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's custom meals from meals table
  // Include user_created, quick_cook, and party_meal source types
  const { data: mealsData } = await supabase
    .from('meals')
    .select('*')
    .eq('source_user_id', user.id)
    .in('source_type', ['user_created', 'quick_cook', 'party_meal'])
    .order('created_at', { ascending: false })

  // Transform to the format expected by CustomMealsClient based on source_type
  // Also generate signed URLs for images stored as storage paths
  const savedMeals: SavedMeal[] = await Promise.all(
    (mealsData || []).map(async (meal) => {
      // Generate signed URL if image_url is a storage path (not a full URL)
      let imageUrl = meal.image_url
      if (imageUrl && !imageUrl.startsWith('http')) {
        const { data: signedUrlData } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(imageUrl, SIGNED_URL_EXPIRY)
        imageUrl = signedUrlData?.signedUrl || null
      }

      const base = {
        id: meal.id,
        name: meal.name,
        source_user_id: meal.source_user_id,
        is_public: meal.is_public || false,
        image_url: imageUrl,
        created_at: meal.created_at,
        updated_at: meal.updated_at,
        source_community_post_id: meal.source_community_post_id || null,
      }

      if (meal.source_type === 'quick_cook') {
        return {
          ...base,
          source_type: 'quick_cook',
          meal_type: meal.meal_type,
          emoji: meal.emoji,
          description: meal.description,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          ingredients: meal.ingredients || [],
          instructions: meal.instructions || [],
          prep_time_minutes: meal.prep_time_minutes,
          cook_time_minutes: meal.cook_time_minutes,
          servings: meal.servings,
          tips: meal.tips || [],
        } as SavedQuickCookMeal
      }

      if (meal.source_type === 'party_meal') {
        return {
          ...base,
          source_type: 'party_meal',
          description: meal.description,
          party_data: meal.party_data,
        } as SavedPartyMeal
      }

      // Default: user_created
      return {
        ...base,
        source_type: 'user_created',
        meal_type: meal.meal_type,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        ingredients: meal.ingredients,
        instructions: meal.instructions,
        prep_time_minutes: meal.prep_time_minutes,
        prep_instructions: meal.prep_instructions,
      } as SavedUserMeal
    })
  )

  return <CustomMealsClient initialMeals={savedMeals} />
}
