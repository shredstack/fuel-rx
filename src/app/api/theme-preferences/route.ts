import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's theme preferences
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch preferences with theme details
  const { data, error } = await supabase
    .from('user_theme_preferences')
    .select(`
      id,
      theme_id,
      preference,
      created_at,
      theme:meal_plan_themes(
        id,
        name,
        display_name,
        description,
        emoji,
        ingredient_guidance,
        cooking_style_guidance,
        compatible_diets,
        incompatible_diets,
        peak_seasons
      )
    `)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching theme preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch theme preferences' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST - Create or update a theme preference
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { theme_id, preference } = body

  if (!theme_id || !preference) {
    return NextResponse.json(
      { error: 'theme_id and preference are required' },
      { status: 400 }
    )
  }

  if (!['preferred', 'blocked'].includes(preference)) {
    return NextResponse.json(
      { error: 'preference must be "preferred" or "blocked"' },
      { status: 400 }
    )
  }

  // Verify the theme exists
  const { data: theme, error: themeError } = await supabase
    .from('meal_plan_themes')
    .select('id')
    .eq('id', theme_id)
    .eq('is_active', true)
    .single()

  if (themeError || !theme) {
    return NextResponse.json(
      { error: 'Theme not found' },
      { status: 404 }
    )
  }

  // Upsert the preference
  const { data, error } = await supabase
    .from('user_theme_preferences')
    .upsert({
      user_id: user.id,
      theme_id,
      preference,
    }, {
      onConflict: 'user_id,theme_id',
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving theme preference:', error)
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE - Remove a theme preference
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const theme_id = searchParams.get('theme_id')

  if (!theme_id) {
    return NextResponse.json(
      { error: 'theme_id is required' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('user_theme_preferences')
    .delete()
    .eq('user_id', user.id)
    .eq('theme_id', theme_id)

  if (error) {
    console.error('Error deleting theme preference:', error)
    return NextResponse.json({ error: 'Failed to delete preference' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
