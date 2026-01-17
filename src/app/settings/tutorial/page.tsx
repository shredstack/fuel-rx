'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import Navbar from '@/components/Navbar';
import MobileTabBar from '@/components/MobileTabBar';

export default function TutorialSettingsPage() {
  const router = useRouter();
  const {
    state: onboardingState,
    loading,
    replayTutorial,
  } = useOnboardingState();
  const [isResetting, setIsResetting] = useState(false);

  const handleReplayTutorial = async () => {
    setIsResetting(true);
    try {
      await replayTutorial();
      // Redirect to history page so user can select a meal plan to view the tour
      router.push('/history');
    } catch (error) {
      console.error('Failed to reset tutorial:', error);
      setIsResetting(false);
    }
  };

  const getTourStatus = () => {
    if (!onboardingState) return 'Loading...';
    if (onboardingState.first_plan_tour_skipped) return 'Skipped';
    if (onboardingState.first_plan_tour_completed) return 'Completed';
    if (onboardingState.first_plan_viewed) return 'In Progress';
    return 'Not Started';
  };

  const getTourStatusColor = () => {
    if (!onboardingState) return 'text-gray-500';
    if (onboardingState.first_plan_tour_skipped) return 'text-yellow-600';
    if (onboardingState.first_plan_tour_completed) return 'text-green-600';
    if (onboardingState.first_plan_viewed) return 'text-blue-600';
    return 'text-gray-500';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/profile" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Profile</span>
          </Link>
          <h1 className="text-2xl font-bold text-primary-600">Help & Tutorials</h1>
        </div>
        {/* Tutorial Status Card */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Meal Plan Tutorial</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Tour Status</span>
              <span className={`font-medium ${getTourStatusColor()}`}>
                {loading ? 'Loading...' : getTourStatus()}
              </span>
            </div>

            {onboardingState?.tutorial_replay_count !== undefined &&
             onboardingState.tutorial_replay_count > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Times Replayed</span>
                <span className="font-medium text-gray-900">
                  {onboardingState.tutorial_replay_count}
                </span>
              </div>
            )}

            {onboardingState?.last_tutorial_replay_at && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Last Replayed</span>
                <span className="font-medium text-gray-900">
                  {new Date(onboardingState.last_tutorial_replay_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-4">
              The meal plan tutorial walks you through all the features of your personalized meal plan,
              including how to navigate days, view nutrition info, like/dislike meals, and swap meals.
            </p>

            <button
              onClick={handleReplayTutorial}
              disabled={loading || isResetting}
              className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Resetting...
                </span>
              ) : (
                'Replay Tutorial'
              )}
            </button>
          </div>
        </div>

        {/* Quick Tips Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Tips</h2>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-primary-600 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <span className="font-medium text-gray-900">Like & Dislike Meals</span>
                <p className="text-sm text-gray-500">Use thumbs up/down on meals to help personalize future meal plans</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary-600 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <span className="font-medium text-gray-900">Swap Meals</span>
                <p className="text-sm text-gray-500">Not feeling a meal? Tap the swap icon to get AI-generated alternatives</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary-600 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <span className="font-medium text-gray-900">Check Off Groceries</span>
                <p className="text-sm text-gray-500">Use the checklist in your grocery list to track items while shopping</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary-600 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <span className="font-medium text-gray-900">Explore Community</span>
                <p className="text-sm text-gray-500">Discover meals from other FuelRx athletes and save your favorites</p>
              </div>
            </li>
          </ul>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
