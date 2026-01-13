import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, updateIngredientNutrition } from '@/lib/admin-service'
import type { UpdateIngredientNutritionRequest } from '@/lib/types'

// PUT - Update nutrition data for an ingredient
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

  // Note: The 'id' here is the nutrition_id, not ingredient_id
  const { id: nutritionId } = await params

  let body: UpdateIngredientNutritionRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate numeric fields
  const numericFields = ['serving_size', 'calories', 'protein', 'carbs', 'fat'] as const
  for (const field of numericFields) {
    if (body[field] !== undefined) {
      const value = body[field]
      if (typeof value !== 'number' || value < 0 || !isFinite(value)) {
        return NextResponse.json(
          { error: `Invalid ${field}: must be a non-negative number` },
          { status: 400 }
        )
      }
    }
  }

  if (body.serving_unit !== undefined && typeof body.serving_unit !== 'string') {
    return NextResponse.json({ error: 'Invalid serving_unit' }, { status: 400 })
  }

  try {
    const updated = await updateIngredientNutrition(
      supabase,
      nutritionId,
      body,
      adminUserId
    )
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update'
    const status = message === 'Nutrition record not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
