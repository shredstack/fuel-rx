import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const haptics = {
  // Light tap for button presses
  light: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  },

  // Medium tap for selections
  medium: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  },

  // Heavy tap for important actions
  heavy: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  },

  // Success feedback (meal plan generated!)
  success: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    }
  },

  // Warning feedback
  warning: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Warning });
    }
  },

  // Error feedback
  error: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Error });
    }
  },

  // Selection changed
  selection: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.selectionChanged();
    }
  },
};
