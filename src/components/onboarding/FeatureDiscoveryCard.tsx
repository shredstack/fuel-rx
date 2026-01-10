'use client';

import Link from 'next/link';
import type { FeatureDiscoveryId } from '@/lib/types';
import { FEATURE_DISCOVERY_CONTENT } from '@/lib/types';

interface Props {
  featureId: FeatureDiscoveryId;
  onDismiss: () => void;
}

/**
 * FeatureDiscoveryCard introduces new features to users in context.
 */
export default function FeatureDiscoveryCard({ featureId, onDismiss }: Props) {
  const content = FEATURE_DISCOVERY_CONTENT[featureId];

  return (
    <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{content.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-gray-900">{content.title}</h4>
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
          <p className="text-sm text-gray-600 mt-1 mb-3">{content.description}</p>
          <Link
            href={content.href}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1"
          >
            {content.cta}
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
  );
}
