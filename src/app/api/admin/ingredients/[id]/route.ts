import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  requireAdmin,
  getIngredientWithNutrition,
  updateIngredient,
  deleteIngredient,
} from '@/lib/admin-service'
import type { UpdateIngredientRequest } from '@/lib/types'

// GET - Get single ingredient with nutrition data
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    // Verify admin access
    await requireAdmin(supabase)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = message === 'Forbidden: Admin access required' ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }

  const { id } = await params

  try {
    const ingredient = await getIngredientWithNutrition(supabase, id)

    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }

    return NextResponse.json(ingredient)
  } catch (error) {
    console.error('Error fetching ingredient:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ingredient' },
      { status: 500 }
    )
  }
}

// PUT - Update ingredient details
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params

  let body: UpdateIngredientRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate request
  if (body.name !== undefined && typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }

  if (body.category !== undefined) {
    const validCategories = [
      'protein',
      'vegetable',
      'fruit',
      'grain',
      'fat',
      'dairy',
      'pantry',
      'other',
    ]
    if (!validCategories.includes(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
  }

  if (body.validated !== undefined && typeof body.validated !== 'boolean') {
    return NextResponse.json({ error: 'Invalid validated value' }, { status: 400 })
  }

  try {
    const updated = await updateIngredient(supabase, id, body, adminUserId)
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update'
    const status = message === 'Ingredient not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

// DELETE - Delete an ingredient and its related data
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params

  try {
    await deleteIngredient(supabase, id, adminUserId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete'
    const status = message === 'Ingredient not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
