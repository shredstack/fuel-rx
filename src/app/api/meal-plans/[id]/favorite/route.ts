import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const body = await request.json()
    const { is_favorite } = body

    if (typeof is_favorite !== 'boolean') {
      return NextResponse.json({ error: 'is_favorite must be a boolean' }, { status: 400 })
    }

    // Update the meal plan favorite status
    const { error: updateError } = await supabase
      .from('meal_plans')
      .update({ is_favorite })
      .eq('id', mealPlanId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating favorite:', updateError)
      return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 })
    }

    return NextResponse.json({ success: true, is_favorite })
  } catch (error) {
    console.error('Error updating favorite:', error)
    return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 })
  }
}
