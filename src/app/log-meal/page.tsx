import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import LogMealClient from './LogMealClient';
import { getDailyConsumptionByDateStr, getAvailableMealsToLogByDateStr } from '@/lib/consumption-service';

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

  const [dailySummary, availableMeals] = await Promise.all([
    getDailyConsumptionByDateStr(user.id, todayStr),
    getAvailableMealsToLogByDateStr(user.id, todayStr),
  ]);

  return (
    <LogMealClient
      initialDate={todayStr}
      initialSummary={dailySummary}
      initialAvailable={availableMeals}
    />
  );
}
