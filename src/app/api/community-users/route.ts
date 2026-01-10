import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.toLowerCase() || ''

  try {
    // Get users the current user follows
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = new Set(follows?.map(f => f.following_id) || [])

    // Get all users who have opted into the community (excluding current user)
    let query = supabase
      .from('user_profiles')
      .select('id, display_name, name, profile_photo_url')
      .eq('social_feed_enabled', true)
      .neq('id', user.id)

    // Apply search filter if provided
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching community users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Add is_following field and sort: followed users first, then alphabetically
    const usersWithFollowing = (users || []).map(u => ({
      ...u,
      is_following: followingIds.has(u.id),
    }))

    // Sort: followed users first, then alphabetically by display_name or name
    usersWithFollowing.sort((a, b) => {
      // First sort by following status (following first)
      if (a.is_following !== b.is_following) {
        return a.is_following ? -1 : 1
      }
      // Then sort alphabetically
      const nameA = (a.display_name || a.name || '').toLowerCase()
      const nameB = (b.display_name || b.name || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

    return NextResponse.json({
      users: usersWithFollowing,
    })
  } catch (error) {
    console.error('Error fetching community users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
