import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's recent protein focus history
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('protein_focus_history')
    .select('protein, meal_type, used_at')
    .eq('user_id', user.id)
    .order('used_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching protein focus history:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  return NextResponse.json(data)
}
