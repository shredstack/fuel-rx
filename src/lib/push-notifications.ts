import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

let isInitialized = false;

export async function initializePushNotifications(
  onTokenReceived?: (token: string) => void
) {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications not available on web');
    return null;
  }

  if (isInitialized) {
    return;
  }

  // Request permission
  const permStatus = await PushNotifications.requestPermissions();

  if (permStatus.receive === 'granted') {
    // Register with Apple Push Notification service (APNs)
    await PushNotifications.register();
  } else {
    console.log('Push notification permission denied');
    return null;
  }

  // Listen for registration success
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token:', token.value);
    if (onTokenReceived) {
      onTokenReceived(token.value);
    }
  });

  // Listen for registration errors
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration error:', error);
  });

  // Listen for incoming notifications when app is open
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);
  });

  // Listen for notification taps
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action:', notification);
    // Navigate to relevant screen based on notification data
    handleNotificationAction(notification.notification.data);
  });

  isInitialized = true;
}

function handleNotificationAction(data: Record<string, unknown>) {
  // Handle different notification types
  if (data.type === 'meal_plan_ready') {
    // Navigate to meal plans page
    window.location.href = '/meal-plans';
  } else if (data.type === 'grocery_reminder') {
    // Navigate to grocery list
    window.location.href = '/grocery-list';
  }
}

export async function checkPushPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const status = await PushNotifications.checkPermissions();
  return status.receive === 'granted';
}

export async function requestPushPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const status = await PushNotifications.requestPermissions();
  return status.receive === 'granted';
}

export function isPushNotificationsSupported(): boolean {
  return Capacitor.isNativePlatform();
}
