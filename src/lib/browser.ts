import { Capacitor } from '@capacitor/core';

/**
 * Opens an external URL in the appropriate way based on platform:
 * - Native (iOS/Android): Uses Capacitor Browser plugin to open in-app browser
 * - Web: Uses window.open to open in new tab
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } catch (error) {
      console.error('[Browser] Failed to open URL on native:', error);
      // Fallback to window.open if Browser plugin fails
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
}
