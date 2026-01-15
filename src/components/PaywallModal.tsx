'use client';

import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaywallModal({ isOpen, onClose }: Props) {
  const { status, showPaywall, restore, canPurchase } = useSubscription();
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const freePlansUsed = status?.freePlansUsed ?? 0;
  const freePlanLimit = status?.freePlanLimit ?? 3;

  const handleUpgrade = async () => {
    setError(null);

    if (canPurchase) {
      // Use RevenueCat native paywall on mobile
      const result = await showPaywall();
      if (result.purchased) {
        onClose();
      } else if (result.error) {
        setError(result.error);
      }
    } else {
      // Web fallback - show message about mobile app
      setError('Subscriptions are only available in the FuelRx mobile app. Please download the app to subscribe.');
    }
  };

  const handleRestore = async () => {
    setError(null);
    setRestoring(true);

    try {
      const result = await restore();
      if (result.success) {
        onClose();
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-500 to-primary-600">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Upgrade to FuelRx Pro
        </h2>

        <p className="text-gray-600 text-center mb-6">
          You&apos;ve used all {freePlanLimit} free meal plans. Upgrade to Pro for unlimited meal planning!
        </p>

        {/* Progress indicator */}
        <div className="bg-gray-100 rounded-full h-2 mb-6">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (freePlansUsed / freePlanLimit) * 100)}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 text-center mb-6">
          {freePlansUsed} of {freePlanLimit} free plans used
        </p>

        {/* Features list */}
        <ul className="space-y-3 mb-6">
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="text-gray-700">Unlimited meal plan generations</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="text-gray-700">Full grocery lists & prep schedules</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="text-gray-700">AI-powered Quick Cook meals</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="text-gray-700">Community sharing features</span>
          </li>
        </ul>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleUpgrade}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors mb-3"
        >
          Upgrade to Pro
        </button>

        {/* Restore purchases */}
        {canPurchase && (
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="w-full py-2 text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {restoring ? 'Restoring...' : 'Restore purchases'}
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-2 text-gray-500 hover:text-gray-600 text-sm transition-colors mt-2"
        >
          Maybe later
        </button>

        {/* Legal text */}
        <p className="text-xs text-gray-400 text-center mt-4">
          Cancel anytime. Subscriptions auto-renew until cancelled.
        </p>
      </div>
    </div>
  );
}
