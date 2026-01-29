'use client'

import type { DayOfWeek } from '@/lib/types'

interface DayBadgeProps {
  day?: DayOfWeek
  days?: DayOfWeek[]
  size?: 'sm' | 'md'
}

const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

const DAY_FULL_NAMES: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
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

/**
 * Format multiple days into a readable string.
 * Examples:
 * - All 7 days: "Every day"
 * - Consecutive days: "Mon-Fri"
 * - Non-consecutive: "Mon, Wed, Fri"
 */
function formatDays(days: DayOfWeek[]): { label: string; title: string } {
  if (days.length === 0) return { label: '', title: '' }
  if (days.length === 1) {
    return { label: DAY_ABBREVIATIONS[days[0]], title: DAY_FULL_NAMES[days[0]] }
  }
  if (days.length === 7) {
    return { label: 'Every day', title: 'Monday through Sunday' }
  }

  // Sort days by their position in the week
  const sortedDays = [...days].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
  )

  // Check if days are consecutive
  const indices = sortedDays.map((d) => DAY_ORDER.indexOf(d))
  const isConsecutive = indices.every(
    (idx, i) => i === 0 || idx === indices[i - 1] + 1
  )

  if (isConsecutive && sortedDays.length >= 3) {
    // Show as range: "Mon-Fri"
    const first = sortedDays[0]
    const last = sortedDays[sortedDays.length - 1]
    return {
      label: `${DAY_ABBREVIATIONS[first]}-${DAY_ABBREVIATIONS[last]}`,
      title: `${DAY_FULL_NAMES[first]} through ${DAY_FULL_NAMES[last]}`,
    }
  }

  // Show as list: "Mon, Wed, Fri"
  return {
    label: sortedDays.map((d) => DAY_ABBREVIATIONS[d]).join(', '),
    title: sortedDays.map((d) => DAY_FULL_NAMES[d]).join(', '),
  }
}

export function DayBadge({ day, days, size = 'sm' }: DayBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm'

  // Handle multiple days
  if (days && days.length > 0) {
    const { label, title } = formatDays(days)
    return (
      <span
        className={`inline-flex items-center ${sizeClasses} rounded bg-gray-100 text-gray-600 font-medium`}
        title={title}
      >
        {label}
      </span>
    )
  }

  // Handle single day
  if (day) {
    return (
      <span
        className={`inline-flex items-center ${sizeClasses} rounded bg-gray-100 text-gray-600 font-medium`}
        title={DAY_FULL_NAMES[day]}
      >
        {DAY_ABBREVIATIONS[day]}
      </span>
    )
  }

  return null
}
