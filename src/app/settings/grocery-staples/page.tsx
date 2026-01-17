import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GroceryStaplesClient from './GroceryStaplesClient';

export default async function GroceryStaplesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user's staples
  const { data: staples } = await supabase
    .from('user_grocery_staples')
    .select('*')
    .eq('user_id', user.id)
    .order('add_frequency', { ascending: false }) // every_week first
    .order('times_added', { ascending: false })
    .order('name', { ascending: true });

  return <GroceryStaplesClient initialStaples={staples || []} />;
}
