import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export async function configureStatusBar() {
  if (!Capacitor.isNativePlatform()) return;

  // Light content for dark backgrounds
  await StatusBar.setStyle({ style: Style.Dark });

  // Match FuelRx dark theme
  await StatusBar.setBackgroundColor({ color: '#18181b' });
}

export async function setStatusBarLight() {
  if (!Capacitor.isNativePlatform()) return;
  await StatusBar.setStyle({ style: Style.Light });
}

export async function setStatusBarDark() {
  if (!Capacitor.isNativePlatform()) return;
  await StatusBar.setStyle({ style: Style.Dark });
}

export async function hideStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  await StatusBar.hide();
}

export async function showStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  await StatusBar.show();
}
