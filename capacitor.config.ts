import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// For production, point to your Vercel deployment
// For development, use your local IP with live reload
const isProduction = process.env.NODE_ENV === 'production';
const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://fuel-rx.shredstack.net';

const config: CapacitorConfig = {
  appId: 'com.fuelrx.app',
  appName: 'FuelRx',
  webDir: 'out',

  server: {
    // Point to your Vercel deployment - the app loads from remote server
    url: serverUrl,
    // Allow cleartext for development only
    cleartext: !isProduction,
  },

  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#18181b',
    allowsLinkPreview: false,
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    StatusBar: {
      style: 'dark',
      backgroundColor: '#18181b',
    },

    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },

    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#18181b',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
