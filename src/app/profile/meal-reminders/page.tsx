import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkReminderAccess } from '@/lib/subscription/check-reminder-access';
import MealRemindersClient from './MealRemindersClient';

export const metadata = {
  title: 'Meal Reminders · FuelRx',
};

export default async function MealRemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const access = await checkReminderAccess(user.id);

  return <MealRemindersClient hasAccess={access.allowed} />;
}
