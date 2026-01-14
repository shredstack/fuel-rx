'use client';

import Link from 'next/link';

interface Props {
  onDismiss: () => void;
}

/**
 * MealLoggingTeaser encourages users to start logging their meals.
 * Highlights the 800g fruit/veggie goal and celebration features.
 */
export default function MealLoggingTeaser({ onDismiss }: Props) {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🥗</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-gray-900">Track What You Eat!</h4>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1 mb-3">
            Log your meals to reach your daily 800g fruit &amp; veggie goal. We&apos;ll celebrate
            your wins with confetti when you hit your targets!
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/log-meal"
              className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors inline-flex items-center gap-1"
            >
              Start Logging
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
