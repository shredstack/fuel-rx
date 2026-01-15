import { Capacitor } from '@capacitor/core';

let initialized = false;

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
 * Initialize RevenueCat SDK and link to the current user
 * Should be called after user authentication
 */
export async function initializeRevenueCat(userId: string): Promise<void> {
  // Only initialize on native platforms (iOS/Android)
  if (!Capacitor.isNativePlatform()) {
    console.log('[RevenueCat] Skipping initialization - not a native platform');
    return;
  }

  // Prevent double initialization
  if (initialized) {
    console.log('[RevenueCat] Already initialized');
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (!apiKey) {
    console.error('[RevenueCat] Missing NEXT_PUBLIC_REVENUECAT_IOS_API_KEY');
    return;
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');

    // Configure RevenueCat with the API key
    await Purchases.configure({ apiKey });

    // Log in with the Supabase user ID to link purchases to the user
    await Purchases.logIn({ appUserID: userId });

    initialized = true;
    console.log('[RevenueCat] Initialized successfully for user:', userId);
  } catch (error) {
    console.error('[RevenueCat] Initialization failed:', error);
  }
}

/**
 * Check if RevenueCat is available on the current platform
 */
export function isRevenueCatAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if RevenueCat has been initialized
 */
export function isRevenueCatInitialized(): boolean {
  return initialized;
}

/**
 * Get current customer info from RevenueCat
 * Returns null if not on a native platform or not initialized
 */
export async function getCustomerInfo() {
  if (!Capacitor.isNativePlatform() || !initialized) {
    return null;
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('[RevenueCat] Failed to get customer info:', error);
    return null;
  }
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
 * Uses the default paywall configured in RevenueCat dashboard
 */
export async function presentPaywall(): Promise<{
  success: boolean;
  purchased?: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Not available on web' };
  }

  if (!initialized) {
    return { success: false, error: 'RevenueCat not initialized' };
  }

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
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Not available on web' };
  }

  if (!initialized) {
    return { success: false, error: 'RevenueCat not initialized' };
  }

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
}

/**
 * Purchase a subscription package from the current offering
 * Uses the default offering's packages (monthly/yearly)
 */
export async function purchasePackage(
  packageType: 'monthly' | 'yearly'
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Not available on web' };
  }

  if (!initialized) {
    return { success: false, error: 'RevenueCat not initialized' };
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');

    // Get current offerings
    const offerings = await Purchases.getOfferings();
    const currentOffering = offerings?.current;

    if (!currentOffering) {
      return { success: false, error: 'No offerings available' };
    }

    // Find the matching package
    const packageToPurchase = packageType === 'monthly'
      ? currentOffering.monthly
      : currentOffering.annual;

    if (!packageToPurchase) {
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
 * Restore previous purchases
 * Useful for users who reinstall the app or switch devices
 */
export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Not available on web' };
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.restorePurchases();
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[RevenueCat] Restore failed:', error);
    return { success: false, error: err.message || 'Restore failed' };
  }
}

/**
 * Get current offerings (available products)
 */
export async function getOfferings() {
  if (!Capacitor.isNativePlatform() || !initialized) {
    return null;
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error('[RevenueCat] Failed to get offerings:', error);
    return null;
  }
}
