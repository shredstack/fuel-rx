import { Capacitor } from '@capacitor/core';

let initialized = false;
let webPurchasesInstance: import('@revenuecat/purchases-js').Purchases | null = null;

/**
 * RevenueCat product identifiers
 * These must match the products configured in RevenueCat dashboard and App Store Connect
 */
export const REVENUECAT_PRODUCTS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

/**
 * RevenueCat entitlement identifier
 * This grants access to premium features (FuelRx Pro)
 */
export const REVENUECAT_ENTITLEMENT = 'FuelRx Pro';

/**
 * Check if we're on a native platform (iOS/Android)
 */
function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if we're on web platform
 */
function isWeb(): boolean {
  return !Capacitor.isNativePlatform() && typeof window !== 'undefined';
}

/**
 * Initialize RevenueCat SDK and link to the current user
 * Works on both native (iOS/Android) and web platforms
 */
export async function initializeRevenueCat(userId: string): Promise<void> {
  // Prevent double initialization
  if (initialized) {
    console.log('[RevenueCat] Already initialized');
    return;
  }

  if (isNative()) {
    // Native platform initialization (iOS/Android via Capacitor)
    const platform = Capacitor.getPlatform();
    const apiKey = platform === 'android'
      ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY
      : process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;

    const envVarName = platform === 'android'
      ? 'NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY'
      : 'NEXT_PUBLIC_REVENUECAT_IOS_API_KEY';

    if (!apiKey) {
      console.error(`[RevenueCat] Missing ${envVarName}`);
      return;
    }

    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');

      // Configure RevenueCat with the API key
      await Purchases.configure({ apiKey });

      // Log in with the Supabase user ID to link purchases to the user
      await Purchases.logIn({ appUserID: userId });

      initialized = true;
      console.log('[RevenueCat] Initialized successfully for user (native):', userId);
    } catch (error) {
      console.error('[RevenueCat] Native initialization failed:', error);
    }
  } else if (isWeb()) {
    // Web platform initialization
    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
    if (!apiKey) {
      console.error('[RevenueCat] Missing NEXT_PUBLIC_REVENUECAT_WEB_API_KEY');
      return;
    }

    try {
      const { Purchases } = await import('@revenuecat/purchases-js');

      // Configure RevenueCat Web SDK with the API key and user ID
      webPurchasesInstance = Purchases.configure(apiKey, userId);

      initialized = true;
      console.log('[RevenueCat] Initialized successfully for user (web):', userId);
    } catch (error) {
      console.error('[RevenueCat] Web initialization failed:', error);
    }
  } else {
    console.log('[RevenueCat] Skipping initialization - not a supported platform');
  }
}

/**
 * Check if RevenueCat is available on the current platform
 * Now returns true for both native and web platforms
 */
export function isRevenueCatAvailable(): boolean {
  return isNative() || isWeb();
}

/**
 * Check if RevenueCat has been initialized
 */
export function isRevenueCatInitialized(): boolean {
  return initialized;
}

/**
 * Get current customer info from RevenueCat
 * Works on both native and web platforms
 */
export async function getCustomerInfo() {
  if (!initialized) {
    return null;
  }

  if (isNative()) {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Failed to get customer info (native):', error);
      return null;
    }
  } else if (isWeb() && webPurchasesInstance) {
    try {
      const customerInfo = await webPurchasesInstance.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Failed to get customer info (web):', error);
      return null;
    }
  }

  return null;
}

/**
 * Check if user has active FuelRx Pro entitlement
 */
export async function hasProEntitlement(): Promise<boolean> {
  const customerInfo = await getCustomerInfo();
  if (!customerInfo) return false;

  return Object.prototype.hasOwnProperty.call(
    customerInfo.entitlements.active,
    REVENUECAT_ENTITLEMENT
  );
}

/**
 * Present the RevenueCat paywall UI
 * Uses native paywall on mobile, or returns offerings for custom web UI
 */
export async function presentPaywall(): Promise<{
  success: boolean;
  purchased?: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  if (!initialized) {
    return { success: false, error: 'RevenueCat not initialized' };
  }

  if (isNative()) {
    try {
      const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui');
      const { result } = await RevenueCatUI.presentPaywall();

      // Check result - RevenueCat returns PAYWALL_RESULT enum values
      if (result === 'PURCHASED' || result === 'RESTORED') {
        return { success: true, purchased: true };
      } else if (result === 'CANCELLED') {
        return { success: true, cancelled: true };
      }

      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('[RevenueCat] Paywall presentation failed:', error);
      return { success: false, error: err.message || 'Failed to show paywall' };
    }
  } else if (isWeb()) {
    // Web doesn't have a built-in paywall UI yet
    // Return an indicator that the caller should show a custom web paywall
    return { success: false, error: 'Use purchasePackage for web purchases' };
  }

  return { success: false, error: 'Not available on this platform' };
}

/**
 * Present the RevenueCat paywall for a specific offering
 */
export async function presentPaywallForOffering(offeringIdentifier: string): Promise<{
  success: boolean;
  purchased?: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  if (!initialized) {
    return { success: false, error: 'RevenueCat not initialized' };
  }

  if (isNative()) {
    try {
      const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui');
      const { result } = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT,
      });

      if (result === 'PURCHASED' || result === 'RESTORED') {
        return { success: true, purchased: true };
      } else if (result === 'CANCELLED') {
        return { success: true, cancelled: true };
      }

      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('[RevenueCat] Paywall presentation failed:', error);
      return { success: false, error: err.message || 'Failed to show paywall' };
    }
  } else if (isWeb()) {
    return { success: false, error: 'Use purchasePackage for web purchases' };
  }

  return { success: false, error: 'Not available on this platform' };
}

/**
 * Purchase a subscription package from the current offering
 * Works on both native and web platforms
 */
export async function purchasePackage(
  packageType: 'monthly' | 'yearly'
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (isNative()) {
    if (!initialized) {
      return { success: false, error: 'RevenueCat not initialized' };
    }
    return purchasePackageNative(packageType);
  } else if (isWeb()) {
    // Web can auto-initialize in purchasePackageWeb
    return purchasePackageWeb(packageType);
  }

  return { success: false, error: 'Not available on this platform' };
}

/**
 * Native purchase implementation (iOS/Android)
 */
async function purchasePackageNative(
  packageType: 'monthly' | 'yearly'
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');

    // Get current offerings
    const offerings = await Purchases.getOfferings();
    const currentOffering = offerings?.current;

    if (!currentOffering) {
      return { success: false, error: 'No offerings available' };
    }

    // Try convenience properties first
    let packageToPurchase = packageType === 'monthly'
      ? currentOffering.monthly
      : currentOffering.annual;

    // Fallback: search available packages by identifier or type
    if (!packageToPurchase && currentOffering.availablePackages) {
      const searchTerms = packageType === 'monthly'
        ? ['monthly', '$rc_monthly', 'month']
        : ['yearly', 'annual', '$rc_annual', 'year'];

      const foundPackage = currentOffering.availablePackages.find(pkg => {
        const id = pkg.identifier?.toLowerCase() || '';
        const prodId = pkg.product?.identifier?.toLowerCase() || '';
        return searchTerms.some(term => id.includes(term) || prodId.includes(term));
      });

      if (foundPackage) {
        packageToPurchase = foundPackage;
      }

      console.log('[RevenueCat] Fallback package search result:', packageToPurchase?.identifier);
    }

    if (!packageToPurchase) {
      const availableIds = currentOffering.availablePackages?.map(p => p.identifier);
      console.error('[RevenueCat] Package not found. Available:', availableIds);

      // Log to server for debugging
      try {
        await fetch('/api/debug/revenuecat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'package_not_found',
            data: {
              requestedType: packageType,
              availablePackages: availableIds,
              offeringId: currentOffering.identifier,
            },
          }),
        });
      } catch (e) {
        // Ignore
      }

      return { success: false, error: `No ${packageType} package available` };
    }

    // Purchase the package
    await Purchases.purchasePackage({ aPackage: packageToPurchase });
    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    // Check if user cancelled the purchase
    if (err.code === 'USER_CANCELLED' || err.code === '1' || err.code === 'PURCHASE_CANCELLED') {
      return { success: false, cancelled: true };
    }
    console.error('[RevenueCat] Purchase failed:', error);
    return { success: false, error: err.message || 'Purchase failed' };
  }
}

/**
 * Web purchase implementation
 */
async function purchasePackageWeb(
  packageType: 'monthly' | 'yearly'
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  // If web SDK not initialized, try to initialize it now
  if (!webPurchasesInstance) {
    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'Missing web API key configuration' };
    }

    try {
      // We need a user ID to initialize - try to get it from Supabase
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Please sign in to subscribe' };
      }

      const { Purchases } = await import('@revenuecat/purchases-js');
      webPurchasesInstance = Purchases.configure(apiKey, user.id);
      initialized = true;
      console.log('[RevenueCat] Web SDK initialized on-demand for user:', user.id);
    } catch (initError) {
      console.error('[RevenueCat] Failed to initialize web SDK:', initError);
      return { success: false, error: 'Failed to initialize purchase system' };
    }
  }

  try {
    // Get current offerings
    const offerings = await webPurchasesInstance.getOfferings();
    const currentOffering = offerings?.current;

    // Debug: Log full offerings structure
    console.log('[RevenueCat] Web offerings debug:', {
      hasOfferings: !!offerings,
      currentOfferingId: currentOffering?.identifier,
      availablePackages: currentOffering?.availablePackages?.map(p => ({
        identifier: p.identifier,
        packageType: p.packageType,
      })),
      hasMonthlyConvenience: !!currentOffering?.monthly,
      hasAnnualConvenience: !!currentOffering?.annual,
      allOfferingIds: offerings ? Object.keys(offerings.all || {}) : [],
    });

    if (!currentOffering) {
      return { success: false, error: 'No offerings available' };
    }

    // Find the package to purchase
    let packageToPurchase = packageType === 'monthly'
      ? currentOffering.monthly
      : currentOffering.annual;

    console.log('[RevenueCat] Convenience property result:', {
      packageType,
      found: !!packageToPurchase,
      identifier: packageToPurchase?.identifier,
    });

    // Fallback: search available packages by identifier
    if (!packageToPurchase && currentOffering.availablePackages) {
      const searchTerms = packageType === 'monthly'
        ? ['monthly', '$rc_monthly', 'month']
        : ['yearly', 'annual', '$rc_annual', 'year'];

      console.log('[RevenueCat] Searching available packages with terms:', searchTerms);

      const foundPackage = currentOffering.availablePackages.find(pkg => {
        const id = pkg.identifier?.toLowerCase() || '';
        const matches = searchTerms.some(term => id.includes(term));
        console.log('[RevenueCat] Package check:', { id, matches });
        return matches;
      });

      if (foundPackage) {
        packageToPurchase = foundPackage;
        console.log('[RevenueCat] Found via fallback:', foundPackage.identifier);
      }
    }

    if (!packageToPurchase) {
      const availableIds = currentOffering.availablePackages?.map(p => p.identifier);
      console.error('[RevenueCat] Web package not found. Available:', availableIds);

      // Send debug info to server
      try {
        await fetch('/api/debug/revenuecat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'web_package_not_found',
            data: {
              requestedType: packageType,
              availablePackages: currentOffering.availablePackages?.map(p => ({
                identifier: p.identifier,
                packageType: p.packageType,
              })),
              hasMonthly: !!currentOffering.monthly,
              hasAnnual: !!currentOffering.annual,
            },
          }),
        });
      } catch (e) {
        // Ignore logging errors
      }

      return { success: false, error: `No ${packageType} package available` };
    }

    // Purchase the package - this opens Stripe checkout
    const { customerInfo } = await webPurchasesInstance.purchase({ rcPackage: packageToPurchase });

    // Check if the entitlement is now active
    if (customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT]) {
      return { success: true };
    }

    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; errorCode?: number };

    // Check for user cancellation - Web SDK uses ErrorCode enum
    // ErrorCode.UserCancelledError = 1
    if (err.errorCode === 1 || err.code === 'UserCancelledError') {
      return { success: false, cancelled: true };
    }

    console.error('[RevenueCat] Web purchase failed:', error);
    return { success: false, error: err.message || 'Purchase failed' };
  }
}

/**
 * Restore previous purchases
 * Works on both native and web platforms
 */
export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (!initialized) {
    return { success: false, error: 'RevenueCat not initialized' };
  }

  if (isNative()) {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      await Purchases.restorePurchases();
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('[RevenueCat] Restore failed:', error);
      return { success: false, error: err.message || 'Restore failed' };
    }
  } else if (isWeb() && webPurchasesInstance) {
    // Web purchases are automatically associated with the user ID
    // so there's no need to "restore" them - just refresh customer info
    try {
      await webPurchasesInstance.getCustomerInfo();
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('[RevenueCat] Web restore failed:', error);
      return { success: false, error: err.message || 'Restore failed' };
    }
  }

  return { success: false, error: 'Not available on this platform' };
}

/**
 * Get current offerings (available products)
 * Works on both native and web platforms
 */
export async function getOfferings() {
  if (!initialized) {
    return null;
  }

  if (isNative()) {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (error) {
      console.error('[RevenueCat] Failed to get offerings:', error);
      return null;
    }
  } else if (isWeb() && webPurchasesInstance) {
    try {
      const offerings = await webPurchasesInstance.getOfferings();
      return offerings;
    } catch (error) {
      console.error('[RevenueCat] Failed to get web offerings:', error);
      return null;
    }
  }

  return null;
}

/**
 * Get current offerings with debug logging
 * Use this to diagnose issues with yearly subscription not appearing
 * Logs are sent to server for Vercel log visibility
 */
export async function getOfferingsDebug() {
  if (!initialized) {
    console.log('[RevenueCat Debug] Not available - initialized:', initialized);
    return null;
  }

  if (isNative()) {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();

      // Prepare debug data
      const debugData = {
        platform: 'native',
        currentOfferingId: offerings?.current?.identifier,
        availablePackages: offerings?.current?.availablePackages?.map(p => ({
          identifier: p.identifier,
          packageType: p.packageType,
          productId: p.product?.identifier,
          priceString: p.product?.priceString,
        })),
        hasMonthly: !!offerings?.current?.monthly,
        hasAnnual: !!offerings?.current?.annual,
        monthlyProductId: offerings?.current?.monthly?.product?.identifier,
        annualProductId: offerings?.current?.annual?.product?.identifier,
      };

      // Log locally
      console.log('[RevenueCat Debug] Offerings:', debugData);

      // Send to server for Vercel logs
      try {
        await fetch('/api/debug/revenuecat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'getOfferings',
            data: debugData,
          }),
        });
      } catch (e) {
        // Don't fail if logging fails
        console.warn('[RevenueCat Debug] Failed to send logs to server:', e);
      }

      return offerings;
    } catch (error) {
      console.error('[RevenueCat Debug] Failed to get offerings:', error);

      // Log error to server
      try {
        await fetch('/api/debug/revenuecat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'getOfferings_error',
            data: { error: String(error) },
          }),
        });
      } catch (e) {
        // Ignore
      }

      return null;
    }
  } else if (isWeb() && webPurchasesInstance) {
    try {
      const offerings = await webPurchasesInstance.getOfferings();

      // Prepare debug data for web
      const debugData = {
        platform: 'web',
        currentOfferingId: offerings?.current?.identifier,
        availablePackages: offerings?.current?.availablePackages?.map(p => ({
          identifier: p.identifier,
          // Web SDK has slightly different structure
          productId: p.webBillingProduct?.identifier,
          priceString: p.webBillingProduct?.normalPeriodDuration,
        })),
        hasMonthly: !!offerings?.current?.monthly,
        hasAnnual: !!offerings?.current?.annual,
      };

      console.log('[RevenueCat Debug] Web Offerings:', debugData);

      try {
        await fetch('/api/debug/revenuecat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'getOfferings_web',
            data: debugData,
          }),
        });
      } catch (e) {
        console.warn('[RevenueCat Debug] Failed to send web logs to server:', e);
      }

      return offerings;
    } catch (error) {
      console.error('[RevenueCat Debug] Failed to get web offerings:', error);
      return null;
    }
  }

  return null;
}

/**
 * Get the web purchases instance (for advanced use cases)
 */
export function getWebPurchasesInstance() {
  return webPurchasesInstance;
}
