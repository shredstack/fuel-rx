import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import WelcomeCelebration from '@/components/onboarding/WelcomeCelebration';

export default async function WelcomeCelebrationPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user profile for name
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  return <WelcomeCelebration userName={profile?.name || null} />;
}
