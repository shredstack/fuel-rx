'use client';

import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { purchasePackage } from '@/lib/revenuecat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select a specific plan and show upgrade messaging */
  upgradeTo?: 'yearly';
}

export default function PaywallModal({ isOpen, onClose, upgradeTo }: Props) {
  const { status, restore, canPurchase, refresh } = useSubscription();
  const [restoring, setRestoring] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(upgradeTo || 'yearly');

  const isUpgrade = !!upgradeTo;

  if (!isOpen) return null;

  const freePlansUsed = status?.freePlansUsed ?? 0;
  const freePlanLimit = status?.freePlanLimit ?? 3;

  const handleUpgrade = async () => {
    setError(null);
    setPurchasing(true);

    try {
      if (!canPurchase) {
        setError('Purchases are not available on this platform.');
        return;
      }

      const result = await purchasePackage(selectedPlan);
      if (result.success) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refresh();
        onClose();
      } else if (result.cancelled) {
        // User cancelled - no error to show
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setError(null);
    setRestoring(true);

    try {
      const result = await restore();
      if (result.success) {
        await refresh();
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto relative">
        {/* Close button - top right */}
        <button
          onClick={onClose}
          disabled={purchasing}
          className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-5 pt-10">

          {/* Header */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary-500 to-primary-600">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 text-center mb-1">
            {isUpgrade ? 'Switch to Yearly' : 'Upgrade to Pro'}
          </h2>

          <p className="text-sm text-gray-500 text-center mb-4">
            {isUpgrade ? 'Save 17% with an annual subscription' : 'Unlock weekly meal plans & unlimited AI'}
          </p>

          {/* Plan selection - horizontal on larger screens */}
          {canPurchase && !isUpgrade && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedPlan('yearly')}
                className={`flex-1 p-3 rounded-xl border-2 transition-all text-left relative ${
                  selectedPlan === 'yearly'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="absolute -top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  BEST
                </div>
                <div className="font-semibold text-gray-900 text-sm">Yearly</div>
                <div className="text-xs text-gray-500">$39.99/yr</div>
                <div className="text-[10px] text-green-600 font-medium">Save 17%</div>
              </button>
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
                  selectedPlan === 'monthly'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="font-semibold text-gray-900 text-sm">Monthly</div>
                <div className="text-xs text-gray-500">$3.99/mo</div>
              </button>
            </div>
          )}

          {/* Show yearly plan info for upgrade flow */}
          {canPurchase && isUpgrade && (
            <div className="mb-4 p-3 rounded-xl border-2 border-primary-500 bg-primary-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Pro Yearly</div>
                  <div className="text-xs text-gray-500">$39.99/year</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-green-600 font-medium">Save 17%</div>
                  <div className="text-[10px] text-gray-400">vs monthly</div>
                </div>
              </div>
            </div>
          )}

          {/* Features list - compact */}
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                '3 meal plans/week',
                'Unlimited AI features',
                'Grocery lists',
                'Community features',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-600">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleUpgrade}
            disabled={purchasing}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {purchasing ? 'Processing...' : `Subscribe ${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'}`}
          </button>

          {/* Secondary actions */}
          <div className="flex items-center justify-center gap-4 mt-3">
            {canPurchase && (
              <button
                onClick={handleRestore}
                disabled={restoring || purchasing}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
              >
                {restoring ? 'Restoring...' : 'Restore purchases'}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={purchasing}
              className="text-xs text-gray-500 hover:text-gray-600 disabled:opacity-50"
            >
              Maybe later
            </button>
          </div>

          {/* Legal text */}
          <p className="text-[10px] text-gray-400 text-center mt-3">
            Cancel anytime. Auto-renews until cancelled.
          </p>
        </div>
      </div>
    </div>
  );
}
