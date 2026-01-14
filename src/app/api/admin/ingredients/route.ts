import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, searchIngredients } from '@/lib/admin-service'
import type { AdminIngredientFilters, IngredientCategoryType } from '@/lib/types'

// GET - List/search ingredients with pagination
export async function GET(request: Request) {
  const supabase = await createClient()

  try {
    // Verify admin access
    await requireAdmin(supabase)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = message === 'Forbidden: Admin access required' ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }

  // Parse query params
  const { searchParams } = new URL(request.url)

  const filters: AdminIngredientFilters = {
    search: searchParams.get('search') || undefined,
    category: (searchParams.get('category') as IngredientCategoryType) || undefined,
    validated: searchParams.has('validated')
      ? searchParams.get('validated') === 'true'
      : undefined,
    userAddedOnly: searchParams.get('userAddedOnly') === 'true',
    usdaMatchStatus: (searchParams.get('usdaMatchStatus') as AdminIngredientFilters['usdaMatchStatus']) || undefined,
    sortBy: (searchParams.get('sortBy') as AdminIngredientFilters['sortBy']) || 'name',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
  }

  // Validate pageSize
  if (filters.pageSize && filters.pageSize > 100) {
    filters.pageSize = 100
  }

  try {
    const result = await searchIngredients(supabase, filters)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error searching ingredients:', error)
    return NextResponse.json(
      { error: 'Failed to search ingredients' },
      { status: 500 }
    )
  }
}
