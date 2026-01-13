'use client';

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export async function takePhoto(): Promise<string | null> {
  try {
    // Request permissions on native
    if (Capacitor.isNativePlatform()) {
      const permissions = await Camera.requestPermissions();
      if (permissions.camera !== 'granted') {
        throw new Error('Camera permission denied');
      }
    }

    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
      width: 1200,
      height: 1200,
    });

    return image.base64String || null;
  } catch (error) {
    console.error('Camera error:', error);
    return null;
  }
}

export async function pickFromGallery(): Promise<string | null> {
  try {
    // Request permissions on native
    if (Capacitor.isNativePlatform()) {
      const permissions = await Camera.requestPermissions();
      if (permissions.photos !== 'granted') {
        throw new Error('Photo library permission denied');
      }
    }

    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
      width: 1200,
      height: 1200,
    });

    return image.base64String || null;
  } catch (error) {
    console.error('Gallery error:', error);
    return null;
  }
}

export async function getPhotoAsDataUrl(): Promise<string | null> {
  const base64 = await takePhoto();
  if (!base64) return null;
  return `data:image/jpeg;base64,${base64}`;
}

export async function getGalleryPhotoAsDataUrl(): Promise<string | null> {
  const base64 = await pickFromGallery();
  if (!base64) return null;
  return `data:image/jpeg;base64,${base64}`;
}

export function isNativeCamera(): boolean {
  return Capacitor.isNativePlatform();
}
