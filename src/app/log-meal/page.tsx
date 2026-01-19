import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import LogMealClient from './LogMealClient';
import {
  getDailyConsumptionByDateStr,
  getAvailableMealsToLogByDateStr,
  getPreviousEntriesByMealType,
} from '@/lib/consumption-service';
import { DEFAULT_SELECTED_MEAL_TYPES } from '@/lib/types';
import type { SelectableMealType } from '@/lib/types';

// Helper to get today's date string in user's timezone
// Falls back to UTC if timezone detection fails
function getTodayDateString(timezoneHeader: string | null): string {
  try {
    const timezone = timezoneHeader || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    // Fallback: use UTC date
    return new Date().toISOString().split('T')[0];
  }
}

export default async function LogMealPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user's timezone from header (set by middleware or client)
  const headersList = await headers();
  const userTimezone = headersList.get('x-user-timezone');
  const todayStr = getTodayDateString(userTimezone);

  // Get user's selected meal types
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('selected_meal_types')
    .eq('id', user.id)
    .single();

  const userMealTypes: SelectableMealType[] = profile?.selected_meal_types || [...DEFAULT_SELECTED_MEAL_TYPES];

  const [dailySummary, availableMeals, previousEntries] = await Promise.all([
    getDailyConsumptionByDateStr(user.id, todayStr),
    getAvailableMealsToLogByDateStr(user.id, todayStr),
    getPreviousEntriesByMealType(user.id, todayStr, 7),
  ]);

  return (
    <LogMealClient
      initialDate={todayStr}
      initialSummary={dailySummary}
      initialAvailable={availableMeals}
      initialPreviousEntries={previousEntries}
      userMealTypes={userMealTypes}
    />
  );
}
