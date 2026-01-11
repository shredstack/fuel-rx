'use client';

import { useState, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
}

// Create reader instance lazily (singleton pattern)
let readerInstance: BrowserMultiFormatReader | null = null;

function getReader(): BrowserMultiFormatReader {
  if (!readerInstance) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ]);
    readerInstance = new BrowserMultiFormatReader(hints);
  }
  return readerInstance;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const stopCamera = useCallback(() => {
    try {
      const reader = getReader();
      reader.reset();
    } catch (e) {
      // Ignore errors during cleanup
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      // Wait a tick for the video element to be rendered
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error('Video element not ready. Please try again.');
      }

      const reader = getReader();

      // Use ZXing to decode from video stream
      await reader.decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            stopCamera();
            onScan(barcode);
          }
          // ZXing continuously calls this callback, errors during scanning are expected
          // Only log actual errors, not "not found" states
          if (error && error.name !== 'NotFoundException') {
            console.error('Barcode scan error:', error);
          }
        }
      );
    } catch (error) {
      console.error('Camera error:', error);
      let errorMessage = 'Failed to start camera';

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another application.';
        } else {
          errorMessage = error.message || 'Failed to start camera';
        }
      }

      setCameraError(errorMessage);
      onError?.(errorMessage);
      setIsScanning(false);
    }
  }, [onScan, onError, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setScanMode('manual');
            stopCamera();
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            scanMode === 'manual'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent'
          }`}
        >
          Enter Manually
        </button>
        <button
          onClick={() => {
            setScanMode('camera');
            startCamera();
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            scanMode === 'camera'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent'
          }`}
        >
          Use Camera
        </button>
      </div>

      {/* Manual Entry */}
      {scanMode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter Barcode Number
            </label>
            <input
              type="text"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g., 012345678901"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-lg tracking-wider"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Find the barcode number under the barcode lines on the product packaging
            </p>
          </div>
          <button
            type="submit"
            disabled={!manualBarcode.trim()}
            className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Look Up Product
          </button>
        </form>
      )}

      {/* Camera View */}
      {scanMode === 'camera' && (
        <div className="space-y-3">
          {cameraError ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">
              <p>{cameraError}</p>
              <button
                onClick={() => {
                  setCameraError(null);
                  setScanMode('manual');
                }}
                className="mt-2 text-red-600 underline"
              >
                Enter barcode manually instead
              </button>
            </div>
          ) : (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-white rounded-lg opacity-70">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary-400 rounded-tl" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary-400 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary-400 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary-400 rounded-br" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 text-center">
                Point the camera at a product barcode
              </p>
              <button
                onClick={stopCamera}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
