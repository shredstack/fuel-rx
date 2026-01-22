'use client';

import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallModal from '@/components/PaywallModal';

export default function SubscriptionSettings() {
  const {
    status,
    loading,
    isSubscribed,
    canPurchase,
    freePlansRemaining,
    isOverride,
    restore,
    sync,
  } = useSubscription();

  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [managingSubscription, setManagingSubscription] = useState(false);

  const handleUpgrade = () => {
    // Always show the PaywallModal which handles both web and native purchases
    setShowPaywallModal(true);
  };

  const handleUpgradeToYearly = () => {
    setShowUpgradeModal(true);
  };

  // Check if user can upgrade from monthly to yearly
  // Allow even if cancelled - user may want to switch plans before expiration
  const canUpgradeToYearly = isSubscribed &&
    !isOverride &&
    status?.subscriptionTier === 'pro_monthly';

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreMessage(null);

    try {
      const result = await restore();
      if (result.success) {
        setRestoreMessage('Purchases restored successfully!');
      } else {
        setRestoreMessage(result.error || 'Unable to restore purchases');
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setRestoreMessage(null);

    try {
      const result = await sync();
      if (result.success) {
        setRestoreMessage('Subscription synced successfully!');
      } else {
        setRestoreMessage(result.error || 'Unable to sync subscription');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    setRestoreMessage(null);

    try {
      const response = await fetch('/api/subscription/manage');
      const data = await response.json();

      if (!response.ok) {
        setRestoreMessage(data.error || 'Unable to open subscription management');
        return;
      }

      if (data.managementUrl) {
        window.open(data.managementUrl, '_blank');
      } else if (data.supportEmail) {
        setRestoreMessage(`Please contact ${data.supportEmail} to manage your subscription`);
      } else {
        setRestoreMessage('Unable to open subscription management. Please try again.');
      }
    } catch {
      setRestoreMessage('Unable to open subscription management. Please try again.');
    } finally {
      setManagingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-100 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  // Determine plan display name
  const getPlanName = () => {
    if (isOverride) return 'VIP Access';
    if (!isSubscribed) return 'Free';

    const tier = status?.subscriptionTier;
    if (tier === 'pro_monthly') return 'Pro Monthly';
    if (tier === 'pro_yearly') return 'Pro Yearly';
    if (tier === 'basic_yearly') return 'Basic Yearly';
    return 'Pro';
  };

  // Format expiration date
  const formatExpiration = () => {
    if (!status?.currentPeriodEnd) return null;
    const date = new Date(status.currentPeriodEnd);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Subscription</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {isSubscribed || isOverride ? getPlanName() : 'Free Plan'}
              </p>
            </div>

            {/* Status Badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              isSubscribed || isOverride
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {isSubscribed || isOverride ? 'Active' : 'Free'}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Free tier info */}
          {!isSubscribed && !isOverride && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Free meal plans remaining</span>
              <span className="font-medium text-gray-900">
                {freePlansRemaining} of 2
              </span>
            </div>
          )}

          {/* Subscription details for paid users */}
          {isSubscribed && !isOverride && (
            <>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Plan</span>
                <span className="font-medium text-gray-900">{getPlanName()}</span>
              </div>

              {formatExpiration() && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">
                    {status?.subscriptionStatus === 'cancelled' ? 'Access until' : 'Renews on'}
                  </span>
                  <span className="font-medium text-gray-900">{formatExpiration()}</span>
                </div>
              )}

              {status?.subscriptionStatus === 'cancelled' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    Your subscription has been cancelled. You&apos;ll have access until {formatExpiration()}.
                  </p>
                </div>
              )}
            </>
          )}

          {/* VIP/Override info */}
          {isOverride && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-purple-800">
                You have VIP access with unlimited features.
              </p>
            </div>
          )}

          {/* Restore/Error Message */}
          {restoreMessage && (
            <div className={`p-3 rounded-lg text-sm ${
              restoreMessage.includes('success')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {restoreMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {!isSubscribed && !isOverride && (
              <button
                onClick={handleUpgrade}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
              >
                Upgrade to Pro
              </button>
            )}

            {isSubscribed && !isOverride && (
              <>
                {canUpgradeToYearly && (
                  <button
                    onClick={handleUpgradeToYearly}
                    className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Switch to Yearly (Save 17%)
                  </button>
                )}
                <button
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {managingSubscription ? 'Loading...' : 'Manage Subscription'}
                </button>
              </>
            )}

            {canPurchase && (
              <button
                onClick={handleRestore}
                disabled={restoring || syncing}
                className="w-full py-2 text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {restoring ? 'Restoring...' : 'Restore Purchases'}
              </button>
            )}

            <button
              onClick={handleSync}
              disabled={syncing || restoring}
              className="w-full py-2 text-gray-500 hover:text-gray-600 text-sm transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync Subscription Status'}
            </button>
          </div>
        </div>
      </div>

      {/* Paywall Modal for new subscribers */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
      />

      {/* Upgrade Modal for monthly -> yearly */}
      <PaywallModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        upgradeTo="yearly"
      />
    </>
  );
}
