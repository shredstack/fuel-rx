'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

interface SplashScreenProviderProps {
  children: React.ReactNode;
}

export function SplashScreenProvider({ children }: SplashScreenProviderProps) {
  const hasHiddenSplash = useRef(false);

  useEffect(() => {
    if (hasHiddenSplash.current) return;

    const hideSplash = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        await SplashScreen.hide({ fadeOutDuration: 300 });
        hasHiddenSplash.current = true;
      } catch (error) {
        console.error('Failed to hide splash screen:', error);
      }
    };

    // Hide splash screen once the app has rendered
    // Small delay to ensure the UI is painted
    const timeoutId = setTimeout(hideSplash, 100);

    // Fallback: force hide after 5 seconds in case something goes wrong
    const fallbackTimeoutId = setTimeout(() => {
      if (!hasHiddenSplash.current) {
        hideSplash();
      }
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(fallbackTimeoutId);
    };
  }, []);

  return <>{children}</>;
}
