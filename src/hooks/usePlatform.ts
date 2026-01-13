'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface PlatformInfo {
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  platform: 'ios' | 'android' | 'web';
}

export function usePlatform(): PlatformInfo {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    isNative: false,
    isIOS: false,
    isAndroid: false,
    isWeb: true,
    platform: 'web',
  });

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    setPlatformInfo({
      isNative: Capacitor.isNativePlatform(),
      isIOS: platform === 'ios',
      isAndroid: platform === 'android',
      isWeb: platform === 'web',
      platform: platform as 'ios' | 'android' | 'web',
    });
  }, []);

  return platformInfo;
}
