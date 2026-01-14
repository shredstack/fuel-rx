import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, bulkDeleteIngredients } from '@/lib/admin-service'

interface BulkDeleteRequest {
  ingredient_ids: string[]
}

// POST - Bulk delete multiple ingredients
export async function POST(request: Request) {
  const supabase = await createClient()

  let adminUserId: string
  try {
    const result = await requireAdmin(supabase)
    adminUserId = result.userId
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = message === 'Forbidden: Admin access required' ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }

  let body: BulkDeleteRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate request
  if (!Array.isArray(body.ingredient_ids) || body.ingredient_ids.length === 0) {
    return NextResponse.json(
      { error: 'ingredient_ids must be a non-empty array' },
      { status: 400 }
    )
  }

  if (body.ingredient_ids.length > 100) {
    return NextResponse.json(
      { error: 'Cannot delete more than 100 ingredients at once' },
      { status: 400 }
    )
  }

  try {
    const result = await bulkDeleteIngredients(
      supabase,
      body.ingredient_ids,
      adminUserId
    )

    return NextResponse.json({
      success: true,
      deleted_count: result.deleted,
      failed_ids: result.failed,
    })
  } catch (error) {
    console.error('Error bulk deleting ingredients:', error)
    return NextResponse.json(
      { error: 'Failed to bulk delete ingredients' },
      { status: 500 }
    )
  }
}
