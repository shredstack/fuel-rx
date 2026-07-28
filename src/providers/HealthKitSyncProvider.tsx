'use client';

import { useEffect } from 'react';
import { isHealthKitAvailable } from '@/lib/healthkit';
import { syncPendingEntries } from '@/lib/healthkit/sync-service';

/**
 * Automatically retries Apple Health writes that failed at log time.
 *
 * Log-time syncs are fire-and-forget and can silently fail — HealthKit
 * rejects writes while the iPhone is locked, and the WebView can be
 * suspended before an in-flight write completes. This provider sweeps for
 * entries still marked unsynced whenever the app launches or returns to the
 * foreground, so every logged meal eventually lands in Apple Health.
 *
 * Renders nothing; no-op outside iOS native.
 */
export function HealthKitSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isHealthKitAvailable()) return;

    // Initial sweep shortly after launch — delayed so it doesn't compete
    // with app startup requests.
    const initialTimer = setTimeout(() => {
      void syncPendingEntries();
    }, 5000);

    let removeListener: (() => void) | null = null;
    import('@capacitor/app')
      .then(({ App }) => {
        const listener = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            void syncPendingEntries();
          }
        });
        removeListener = () => {
          listener.then((l) => l.remove()).catch(() => {});
        };
      })
      .catch(() => {
        // Plugin unavailable (old native build) — sweep still runs on launch
      });

    return () => {
      clearTimeout(initialTimer);
      removeListener?.();
    };
  }, []);

  return <>{children}</>;
}
