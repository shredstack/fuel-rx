import type { DayPlanNormalized, MealSlot, MealType, DayOfWeek } from './types'

export interface GroupedMeal {
  mealSlot: MealSlot
  day: DayOfWeek
}

/**
 * A deduplicated meal that appears on multiple days.
 * Contains the first mealSlot and all days it appears on.
 */
export interface DeduplicatedMeal {
  mealSlot: MealSlot
  days: DayOfWeek[]
}

const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const MEAL_TYPE_ORDER: MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
]

/**
 * Groups meals from a meal plan by their meal type.
 * Each meal includes its day for display as a badge.
 */
export function groupMealsByType(
  days: DayPlanNormalized[]
): Map<MealType, GroupedMeal[]> {
  const groups = new Map<MealType, GroupedMeal[]>()

  // Initialize empty arrays for each type
  MEAL_TYPE_ORDER.forEach((type) => groups.set(type, []))

  // Group meals by type, preserving day info
  days.forEach((day) => {
    day.meals.forEach((mealSlot) => {
      const type = mealSlot.meal_type
      const existing = groups.get(type) || []
      existing.push({ mealSlot, day: day.day })
      groups.set(type, existing)
    })
  })

  // Sort by day order within each type
  groups.forEach((meals, type) => {
    meals.sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
    )
    groups.set(type, meals)
  })

  return groups
}

/**
 * Returns an array of meal types that have at least one meal in the plan.
 */
export function getActiveMealTypes(
  groupedMeals: Map<MealType, GroupedMeal[]>
): MealType[] {
  return MEAL_TYPE_ORDER.filter((type) => {
    const meals = groupedMeals.get(type)
    return meals && meals.length > 0
  })
}

/**
 * Groups meals from a meal plan by their meal type, deduplicating identical meals.
 * When the same meal appears on multiple days (e.g., same breakfast every day),
 * it's shown once with all days listed.
 */
export function groupMealsByTypeDeduped(
  days: DayPlanNormalized[]
): Map<MealType, DeduplicatedMeal[]> {
  const groups = new Map<MealType, DeduplicatedMeal[]>()

  // Initialize empty arrays for each type
  MEAL_TYPE_ORDER.forEach((type) => groups.set(type, []))

  // Track meals we've seen by meal_id within each type
  const seenByType = new Map<MealType, Map<string, DeduplicatedMeal>>()
  MEAL_TYPE_ORDER.forEach((type) => seenByType.set(type, new Map()))

  // Group meals by type, deduplicating by meal_id
  days.forEach((day) => {
    day.meals.forEach((mealSlot) => {
      const type = mealSlot.meal_type
      const mealId = mealSlot.meal.id
      const seen = seenByType.get(type)!

      if (seen.has(mealId)) {
        // Add this day to existing entry
        const existing = seen.get(mealId)!
        existing.days.push(day.day)
      } else {
        // New meal - create entry
        const entry: DeduplicatedMeal = {
          mealSlot,
          days: [day.day],
        }
        seen.set(mealId, entry)
        const existing = groups.get(type) || []
        existing.push(entry)
        groups.set(type, existing)
      }
    })
  })

  // Sort days within each meal
  groups.forEach((meals) => {
    meals.forEach((meal) => {
      meal.days.sort(
        (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
      )
    })
  })

  return groups
}

/**
 * Returns the count of distinct meals for a meal type.
 */
export function getDistinctMealCount(
  groupedMeals: Map<MealType, DeduplicatedMeal[]>,
  type: MealType
): number {
  return groupedMeals.get(type)?.length || 0
}

export { DAY_ORDER, MEAL_TYPE_ORDER }
