'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/hooks/usePlatform';

interface Props {
  userName: string | null;
}

/**
 * WelcomeCelebration component shown after completing onboarding.
 * Per user decision: immediately redirects to dashboard where they can see
 * the meal plan generation progress.
 */
export default function WelcomeCelebration({ userName }: Props) {
  const router = useRouter();
  const { isNative } = usePlatform();

  useEffect(() => {
    // Use window.location for native apps to ensure a full page reload
    // This ensures the dashboard properly reads the updated onboarding state
    if (isNative) {
      window.location.href = '/dashboard';
    } else {
      router.replace('/dashboard');
    }
  }, [router, isNative]);

  // Show brief loading state while redirecting
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You&apos;re all set{userName ? `, ${userName}` : ''}!
        </h1>
        <p className="text-gray-600">
          Taking you to your dashboard...
        </p>
      </div>
    </div>
  );
}
