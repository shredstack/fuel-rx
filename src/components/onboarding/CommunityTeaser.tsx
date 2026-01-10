'use client';

import Link from 'next/link';

interface Props {
  onDismiss: () => void;
}

/**
 * CommunityTeaser encourages users to explore the community feed.
 */
export default function CommunityTeaser({ onDismiss }: Props) {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🌟</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-gray-900">Join the Community!</h4>
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
            Discover what other FuelRx athletes are eating. Save meals you love and share your
            favorites!
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/community"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1"
            >
              Explore Community
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
            <Link
              href="/settings/social"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
