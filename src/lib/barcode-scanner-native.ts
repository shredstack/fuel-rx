import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';

export async function scanBarcodeNative(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    // Fall back to ZXing web scanner - return null to signal caller to use web fallback
    return null;
  }

  try {
    // Check/request permission
    const status = await BarcodeScanner.requestPermissions();
    if (status.camera !== 'granted') {
      throw new Error('Camera permission denied');
    }

    // Start scanning
    const result = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
      ],
    });

    return result.barcodes[0]?.rawValue || null;
  } catch (error) {
    console.error('Barcode scan error:', error);
    return null;
  }
}

export function isNativeBarcodeScanner(): boolean {
  return Capacitor.isNativePlatform();
}

export async function checkBarcodeScannerPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true; // Web always has permission via user interaction
  }

  try {
    const status = await BarcodeScanner.checkPermissions();
    return status.camera === 'granted';
  } catch {
    return false;
  }
}

export async function requestBarcodeScannerPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  try {
    const status = await BarcodeScanner.requestPermissions();
    return status.camera === 'granted';
  } catch {
    return false;
  }
}
