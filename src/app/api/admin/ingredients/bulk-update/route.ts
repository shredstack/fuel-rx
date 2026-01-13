import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, bulkUpdateIngredients } from '@/lib/admin-service'
import type { BulkUpdateIngredientsRequest, IngredientCategoryType } from '@/lib/types'

// POST - Bulk update multiple ingredients
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

  let body: BulkUpdateIngredientsRequest
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
      { error: 'Cannot update more than 100 ingredients at once' },
      { status: 400 }
    )
  }

  if (!body.updates || typeof body.updates !== 'object') {
    return NextResponse.json({ error: 'updates object is required' }, { status: 400 })
  }

  // Must have at least one update field
  if (body.updates.category === undefined && body.updates.validated === undefined) {
    return NextResponse.json(
      { error: 'At least one of category or validated must be specified' },
      { status: 400 }
    )
  }

  // Validate category if provided
  if (body.updates.category !== undefined) {
    const validCategories: IngredientCategoryType[] = [
      'protein',
      'vegetable',
      'fruit',
      'grain',
      'fat',
      'dairy',
      'pantry',
      'other',
    ]
    if (!validCategories.includes(body.updates.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
  }

  // Validate validated if provided
  if (
    body.updates.validated !== undefined &&
    typeof body.updates.validated !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'validated must be a boolean' },
      { status: 400 }
    )
  }

  try {
    await bulkUpdateIngredients(
      supabase,
      body.ingredient_ids,
      body.updates,
      adminUserId
    )

    return NextResponse.json({
      success: true,
      updated_count: body.ingredient_ids.length,
    })
  } catch (error) {
    console.error('Error bulk updating ingredients:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update ingredients' },
      { status: 500 }
    )
  }
}
