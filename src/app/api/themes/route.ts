import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch all active themes
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: themes, error } = await supabase
    .from('meal_plan_themes')
    .select('*')
    .eq('is_active', true)
    .order('display_name')

  if (error) {
    console.error('Error fetching themes:', error)
    return NextResponse.json({ error: 'Failed to fetch themes' }, { status: 500 })
  }

  return NextResponse.json(themes)
}
