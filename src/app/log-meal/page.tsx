import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogMealClient from './LogMealClient';
import { getDailyConsumption, getAvailableMealsToLog } from '@/lib/consumption-service';

export default async function LogMealPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const today = new Date();
  const [dailySummary, availableMeals] = await Promise.all([
    getDailyConsumption(user.id, today),
    getAvailableMealsToLog(user.id, today),
  ]);

  return (
    <LogMealClient
      initialDate={today.toISOString().split('T')[0]}
      initialSummary={dailySummary}
      initialAvailable={availableMeals}
    />
  );
}
