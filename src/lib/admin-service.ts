import { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminIngredient,
  AdminIngredientFilters,
  PaginatedAdminIngredients,
  IngredientNutrition,
  AdminActionType,
  UpdateIngredientRequest,
  UpdateIngredientNutritionRequest,
} from './types'

/**
 * Check if a user is an admin
 */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return data.is_admin === true
}

/**
 * Require admin access - throws if not admin
 * Returns the admin's user ID
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<{ userId: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const adminStatus = await isAdmin(supabase, user.id)
  if (!adminStatus) {
    throw new Error('Forbidden: Admin access required')
  }

  return { userId: user.id }
}

/**
 * Log an admin action to the audit log
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  adminUserId: string,
  action: AdminActionType,
  entityType: 'ingredient' | 'ingredient_nutrition',
  entityId: string,
  changes: Record<string, { old: unknown; new: unknown }>
): Promise<void> {
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_user_id: adminUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    changes,
  })

  if (error) {
    console.error('Failed to log admin action:', error)
    // Don't throw - audit logging failure shouldn't block the operation
  }
}

/**
 * Search and list ingredients with pagination
 */
export async function searchIngredients(
  supabase: SupabaseClient,
  filters: AdminIngredientFilters
): Promise<PaginatedAdminIngredients> {
  const {
    search,
    category,
    validated,
    userAddedOnly,
    sortBy = 'name',
    sortOrder = 'asc',
    page = 1,
    pageSize = 20,
  } = filters

  // Build query for count
  let countQuery = supabase
    .from('ingredients')
    .select('id', { count: 'exact', head: true })

  // Build query for data
  let dataQuery = supabase
    .from('ingredients')
    .select('*')

  // Apply filters to both queries
  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`
    countQuery = countQuery.ilike('name_normalized', searchPattern)
    dataQuery = dataQuery.ilike('name_normalized', searchPattern)
  }

  if (category) {
    countQuery = countQuery.eq('category', category)
    dataQuery = dataQuery.eq('category', category)
  }

  if (validated !== undefined) {
    countQuery = countQuery.eq('validated', validated)
    dataQuery = dataQuery.eq('validated', validated)
  }

  if (userAddedOnly) {
    countQuery = countQuery.eq('is_user_added', true)
    dataQuery = dataQuery.eq('is_user_added', true)
  }

  // Get count
  const { count, error: countError } = await countQuery

  if (countError) {
    throw new Error(`Failed to count ingredients: ${countError.message}`)
  }

  // Apply sorting
  const ascending = sortOrder === 'asc'
  dataQuery = dataQuery.order(sortBy, { ascending })

  // Apply pagination
  const offset = (page - 1) * pageSize
  dataQuery = dataQuery.range(offset, offset + pageSize - 1)

  // Get data
  const { data, error: dataError } = await dataQuery

  if (dataError) {
    throw new Error(`Failed to fetch ingredients: ${dataError.message}`)
  }

  const total = count || 0
  const hasMore = offset + pageSize < total

  return {
    data: (data || []) as AdminIngredient[],
    total,
    page,
    pageSize,
    hasMore,
  }
}

/**
 * Get a single ingredient with its nutrition data
 */
export async function getIngredientWithNutrition(
  supabase: SupabaseClient,
  ingredientId: string
): Promise<AdminIngredient | null> {
  // Get the ingredient
  const { data: ingredient, error: ingredientError } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', ingredientId)
    .single()

  if (ingredientError || !ingredient) {
    return null
  }

  // Get related nutrition data
  const { data: nutrition, error: nutritionError } = await supabase
    .from('ingredient_nutrition')
    .select('*')
    .eq('ingredient_id', ingredientId)
    .order('serving_size')

  if (nutritionError) {
    console.error('Failed to fetch nutrition:', nutritionError)
  }

  return {
    ...ingredient,
    nutrition: nutrition || [],
  } as AdminIngredient
}

/**
 * Update an ingredient's details
 */
export async function updateIngredient(
  supabase: SupabaseClient,
  ingredientId: string,
  updates: UpdateIngredientRequest,
  adminUserId: string
): Promise<AdminIngredient> {
  // Get current values for audit log
  const { data: current, error: currentError } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', ingredientId)
    .single()

  if (currentError || !current) {
    throw new Error('Ingredient not found')
  }

  // Build update object
  const updateData: Record<string, unknown> = {}
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  if (updates.name !== undefined && updates.name !== current.name) {
    updateData.name = updates.name
    updateData.name_normalized = updates.name.toLowerCase().trim()
    changes.name = { old: current.name, new: updates.name }
  }

  if (updates.category !== undefined && updates.category !== current.category) {
    updateData.category = updates.category
    changes.category = { old: current.category, new: updates.category }
  }

  if (updates.validated !== undefined && updates.validated !== current.validated) {
    updateData.validated = updates.validated
    changes.validated = { old: current.validated, new: updates.validated }
  }

  // Only update if there are changes
  if (Object.keys(updateData).length === 0) {
    return current as AdminIngredient
  }

  // Perform update
  const { data: updated, error: updateError } = await supabase
    .from('ingredients')
    .update(updateData)
    .eq('id', ingredientId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to update ingredient: ${updateError.message}`)
  }

  // Log the action
  await logAdminAction(
    supabase,
    adminUserId,
    'update_ingredient',
    'ingredient',
    ingredientId,
    changes
  )

  return updated as AdminIngredient
}

/**
 * Update ingredient nutrition data
 */
export async function updateIngredientNutrition(
  supabase: SupabaseClient,
  nutritionId: string,
  updates: UpdateIngredientNutritionRequest,
  adminUserId: string
): Promise<IngredientNutrition> {
  // Get current values for audit log
  const { data: current, error: currentError } = await supabase
    .from('ingredient_nutrition')
    .select('*')
    .eq('id', nutritionId)
    .single()

  if (currentError || !current) {
    throw new Error('Nutrition record not found')
  }

  // Build update object
  const updateData: Record<string, unknown> = {}
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  const fields: (keyof UpdateIngredientNutritionRequest)[] = [
    'serving_size',
    'serving_unit',
    'calories',
    'protein',
    'carbs',
    'fat',
  ]

  for (const field of fields) {
    if (updates[field] !== undefined && updates[field] !== current[field]) {
      updateData[field] = updates[field]
      changes[field] = { old: current[field], new: updates[field] }
    }
  }

  // Mark source as 'user_corrected' when admin edits
  if (Object.keys(updateData).length > 0 && current.source !== 'user_corrected') {
    updateData.source = 'user_corrected'
    changes.source = { old: current.source, new: 'user_corrected' }
  }

  // Only update if there are changes
  if (Object.keys(updateData).length === 0) {
    return current as IngredientNutrition
  }

  // Perform update
  const { data: updated, error: updateError } = await supabase
    .from('ingredient_nutrition')
    .update(updateData)
    .eq('id', nutritionId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to update nutrition: ${updateError.message}`)
  }

  // Log the action
  await logAdminAction(
    supabase,
    adminUserId,
    'update_nutrition',
    'ingredient_nutrition',
    nutritionId,
    changes
  )

  return updated as IngredientNutrition
}

/**
 * Bulk update multiple ingredients
 */
export async function bulkUpdateIngredients(
  supabase: SupabaseClient,
  ingredientIds: string[],
  updates: { category?: string; validated?: boolean },
  adminUserId: string
): Promise<void> {
  if (ingredientIds.length === 0) {
    return
  }

  // Determine action type for audit log
  const actionType: AdminActionType = updates.category !== undefined
    ? 'bulk_update_category'
    : 'bulk_update_validated'

  // Get current values for audit log
  const { data: currentIngredients, error: currentError } = await supabase
    .from('ingredients')
    .select('id, category, validated')
    .in('id', ingredientIds)

  if (currentError) {
    throw new Error(`Failed to fetch ingredients: ${currentError.message}`)
  }

  // Build update object
  const updateData: Record<string, unknown> = {}

  if (updates.category !== undefined) {
    updateData.category = updates.category
  }

  if (updates.validated !== undefined) {
    updateData.validated = updates.validated
  }

  // Perform bulk update
  const { error: updateError } = await supabase
    .from('ingredients')
    .update(updateData)
    .in('id', ingredientIds)

  if (updateError) {
    throw new Error(`Failed to bulk update: ${updateError.message}`)
  }

  // Log each update to audit log
  for (const ingredient of currentIngredients || []) {
    const changes: Record<string, { old: unknown; new: unknown }> = {}

    if (updates.category !== undefined && updates.category !== ingredient.category) {
      changes.category = { old: ingredient.category, new: updates.category }
    }

    if (updates.validated !== undefined && updates.validated !== ingredient.validated) {
      changes.validated = { old: ingredient.validated, new: updates.validated }
    }

    if (Object.keys(changes).length > 0) {
      await logAdminAction(
        supabase,
        adminUserId,
        actionType,
        'ingredient',
        ingredient.id,
        changes
      )
    }
  }
}
