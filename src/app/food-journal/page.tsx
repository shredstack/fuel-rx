import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FoodJournalHistoryClient from './FoodJournalHistoryClient';

export const metadata = {
  title: 'Food Journal · FuelRx',
};

export default async function FoodJournalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <FoodJournalHistoryClient />;
}
