import type {
  PrepSession,
  PrepTask,
  PrepItem,
  CookingTemps,
  CookingTimes,
  DayOfWeek,
  MealType,
  Meal,
  DayPlan,
} from '@/lib/types'

// Helper to split method strings by arrow delimiter into individual steps
export function parseMethodSteps(method: string | undefined): string[] {
  if (!method) return []
  // Split by arrow delimiter (→) and trim whitespace from each step
  const steps = method.split('→').map(step => step.trim()).filter(step => step.length > 0)
  return steps
}

// Helper to get tasks from session - either from new prep_tasks or old prep_items
export function getSessionTasks(session: PrepSession): PrepTask[] {
  // First try the new prep_tasks format
  if (session.prep_tasks?.tasks && session.prep_tasks.tasks.length > 0) {
    // Also parse any arrow-delimited steps in existing tasks
    return session.prep_tasks.tasks.map(task => {
      if (task.detailed_steps && task.detailed_steps.length === 1 && task.detailed_steps[0].includes('→')) {
        return {
          ...task,
          detailed_steps: parseMethodSteps(task.detailed_steps[0])
        }
      }
      return task
    })
  }

  // Fall back to converting prep_items to PrepTask format
  if (session.prep_items && session.prep_items.length > 0) {
    return session.prep_items.map((item: PrepItem, index: number) => ({
      id: `legacy_${session.id}_${index}`,
      description: `${item.item}${item.quantity ? ` (${item.quantity})` : ''}`,
      detailed_steps: parseMethodSteps(item.method),
      estimated_minutes: Math.round((session.estimated_minutes || 30) / session.prep_items.length),
      meal_ids: item.feeds?.map(f => `meal_${f.day}_${f.meal}`) || [],
      completed: false,
    }))
  }

  return []
}

// Format cooking temps for display
export function formatCookingTemps(temps: CookingTemps | undefined): string[] {
  if (!temps) return []
  const formatted: string[] = []
  if (temps.oven) formatted.push(`Oven: ${temps.oven}`)
  if (temps.stovetop) formatted.push(`Stovetop: ${temps.stovetop}`)
  if (temps.grill) formatted.push(`Grill: ${temps.grill}`)
  if (temps.internal_temp) formatted.push(`Internal: ${temps.internal_temp}`)
  return formatted
}

// Format cooking times for display
export function formatCookingTimes(times: CookingTimes | undefined): string[] {
  if (!times) return []
  const formatted: string[] = []
  if (times.prep_time) formatted.push(`Prep: ${times.prep_time}`)
  if (times.cook_time) formatted.push(`Cook: ${times.cook_time}`)
  if (times.rest_time) formatted.push(`Rest: ${times.rest_time}`)
  return formatted
}

// Task with session info for completion tracking
export interface PrepTaskWithSession extends PrepTask {
  sessionId: string
}

// Grouped prep data structure
export interface GroupedPrepData {
  batchSessions: PrepSession[]
  days: Partial<Record<DayOfWeek, Partial<Record<MealType, PrepTaskWithSession[]>>>>
}

// Extract meal type from meal_id (format: meal_monday_breakfast_0)
function getMealTypeFromMealId(mealId: string): MealType | null {
  const parts = mealId.split('_')
  if (parts.length >= 3) {
    const mealType = parts[2] as MealType
    if (['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
      return mealType
    }
  }
  return null
}

// Extract day from meal_id (format: meal_monday_breakfast_0)
function getDayFromMealId(mealId: string): DayOfWeek | null {
  const parts = mealId.split('_')
  if (parts.length >= 2) {
    const day = parts[1] as DayOfWeek
    if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day)) {
      return day
    }
  }
  return null
}

// Group prep sessions by day and meal type
export function groupPrepSessionsByDayAndMeal(prepSessions: PrepSession[]): GroupedPrepData {
  const result: GroupedPrepData = {
    batchSessions: [],
    days: {}
  }

  for (const session of prepSessions) {
    // Separate batch prep sessions
    if (session.session_type === 'weekly_batch') {
      result.batchSessions.push(session)
      continue
    }

    // Get all tasks from the session
    const tasks = getSessionTasks(session)

    for (const task of tasks) {
      // Determine day and meal type from task's meal_ids
      for (const mealId of task.meal_ids) {
        const day = getDayFromMealId(mealId)
        const mealType = getMealTypeFromMealId(mealId)

        if (day && mealType) {
          // Initialize day if needed
          if (!result.days[day]) {
            result.days[day] = {}
          }
          // Initialize meal type if needed
          if (!result.days[day]![mealType]) {
            result.days[day]![mealType] = []
          }

          // Add task with session ID for completion tracking
          const taskWithSession: PrepTaskWithSession = {
            ...task,
            sessionId: session.id
          }

          // Check if this task is already added (avoid duplicates if task feeds multiple meals)
          const existingTask = result.days[day]![mealType]!.find(t => t.id === task.id)
          if (!existingTask) {
            result.days[day]![mealType]!.push(taskWithSession)
          }
        }
      }

      // Fallback: if no meal_ids, use session_day and infer meal type from session_type
      if (task.meal_ids.length === 0 && session.session_day) {
        const day = session.session_day
        let mealType: MealType = 'dinner' // default

        if (session.session_type === 'day_of_morning') {
          mealType = 'breakfast'
        } else if (session.session_type === 'day_of_dinner') {
          mealType = 'dinner'
        } else if (session.session_type === 'night_before') {
          // Night before usually preps for next day, but we'll group by session_day
          mealType = 'dinner'
        }

        if (!result.days[day]) {
          result.days[day] = {}
        }
        if (!result.days[day]![mealType]) {
          result.days[day]![mealType] = []
        }

        const taskWithSession: PrepTaskWithSession = {
          ...task,
          sessionId: session.id
        }

        const existingTask = result.days[day]![mealType]!.find(t => t.id === task.id)
        if (!existingTask) {
          result.days[day]![mealType]!.push(taskWithSession)
        }
      }
    }
  }

  return result
}

// Day labels for display
export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

// Days in order
export const DAYS_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// Meal type labels and colors
export const MEAL_TYPE_CONFIG: Record<MealType, { label: string; color: string }> = {
  breakfast: { label: 'Breakfast', color: 'bg-yellow-100 text-yellow-800' },
  lunch: { label: 'Lunch', color: 'bg-teal-100 text-teal-800' },
  dinner: { label: 'Dinner', color: 'bg-blue-100 text-blue-800' },
  snack: { label: 'Snacks', color: 'bg-purple-100 text-purple-800' },
}

// Meal types in order
export const MEAL_TYPES_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

// Generate a unique meal ID for a specific meal on a specific day
function generateMealId(day: DayOfWeek, mealType: MealType, index: number): string {
  return `meal_${day}_${mealType}_${index}`
}

// Create a prep task from a meal in the meal plan
function createTaskFromMeal(
  meal: Meal,
  day: DayOfWeek,
  mealIndex: number,
  existingTask?: PrepTaskWithSession
): PrepTaskWithSession {
  // If we have an existing task from prep sessions, use it but ensure proper ID
  if (existingTask) {
    return existingTask
  }

  // Create a new task from the meal data
  const mealId = generateMealId(day, meal.type, mealIndex)

  return {
    id: mealId,
    sessionId: 'meal_plan', // Indicates this came from meal plan, not a prep session
    description: meal.name,
    detailed_steps: meal.instructions || [],
    estimated_minutes: meal.prep_time_minutes || 10,
    meal_ids: [mealId],
    completed: false,
    // Include ingredients as "ingredients_to_prep" for visibility
    ingredients_to_prep: meal.ingredients?.map(ing =>
      `${ing.amount} ${ing.unit} ${ing.name}`
    ),
  }
}

// Group prep data using meal plan as the source of truth
// This ensures every meal in the plan appears as a task
export function groupPrepDataFromMealPlan(
  mealPlanDays: DayPlan[],
  prepSessions: PrepSession[]
): GroupedPrepData {
  const result: GroupedPrepData = {
    batchSessions: [],
    days: {}
  }

  // First, collect batch sessions
  for (const session of prepSessions) {
    if (session.session_type === 'weekly_batch') {
      result.batchSessions.push(session)
    }
  }

  // Build a map of existing prep tasks by meal_id for quick lookup
  const prepTasksByMealId = new Map<string, PrepTaskWithSession>()

  for (const session of prepSessions) {
    if (session.session_type === 'weekly_batch') continue

    const tasks = getSessionTasks(session)
    for (const task of tasks) {
      const taskWithSession: PrepTaskWithSession = {
        ...task,
        sessionId: session.id
      }

      // Index by all meal_ids
      for (const mealId of task.meal_ids) {
        prepTasksByMealId.set(mealId, taskWithSession)
      }

      // Also index by task.id (LLM uses format like "meal_monday_breakfast" without index)
      if (task.id && !prepTasksByMealId.has(task.id)) {
        prepTasksByMealId.set(task.id, taskWithSession)
      }
    }
  }

  // Now iterate through the meal plan to create tasks for every meal
  for (const dayPlan of mealPlanDays) {
    const day = dayPlan.day as DayOfWeek

    if (!result.days[day]) {
      result.days[day] = {}
    }

    // Group meals by type and track index for each type
    const mealsByType: Record<MealType, { meal: Meal; index: number }[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }

    // Count meals by type to get proper indices
    const typeCounters: Record<MealType, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snack: 0,
    }

    for (const meal of dayPlan.meals) {
      const mealType = meal.type as MealType
      const index = typeCounters[mealType]
      typeCounters[mealType]++
      mealsByType[mealType].push({ meal, index })
    }

    // Create tasks for each meal type
    for (const mealType of MEAL_TYPES_ORDER) {
      const meals = mealsByType[mealType]
      if (meals.length === 0) continue

      if (!result.days[day]![mealType]) {
        result.days[day]![mealType] = []
      }

      for (const { meal, index } of meals) {
        const mealIdWithIndex = generateMealId(day, mealType, index)
        // Also try without index for backwards compatibility with LLM format
        const mealIdWithoutIndex = `meal_${day}_${mealType}`

        // Check if we have an existing prep task for this meal
        // Try both formats: with index (meal_monday_snack_0) and without (meal_monday_breakfast)
        let existingTask = prepTasksByMealId.get(mealIdWithIndex)
        if (!existingTask && index === 0) {
          // For the first meal of each type, also check format without index
          existingTask = prepTasksByMealId.get(mealIdWithoutIndex)
        }

        // Create task from meal, using existing prep task data if available
        const task = createTaskFromMeal(meal, day, index, existingTask)

        // Avoid duplicates
        const alreadyAdded = result.days[day]![mealType]!.find(t => t.id === task.id)
        if (!alreadyAdded) {
          result.days[day]![mealType]!.push(task)
        }
      }
    }
  }

  return result
}
