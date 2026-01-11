'use client';

import { useState, useRef } from 'react';
import { compressImage, isValidImageType, formatFileSize } from '@/lib/imageCompression';

interface MealPhotoCaptureProps {
  onPhotoUploaded: (photoId: string, imageUrl: string) => void;
  onError?: (error: string) => void;
  isUploading?: boolean;
}

export default function MealPhotoCapture({ onPhotoUploaded, onError, isUploading: externalUploading }: MealPhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const uploading = externalUploading || isUploading;

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!isValidImageType(file)) {
      onError?.('Please select a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size (10MB pre-compression)
    if (file.size > 10 * 1024 * 1024) {
      onError?.('Image too large. Maximum size is 10MB.');
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setIsUploading(true);
    setUploadProgress('Compressing...');

    try {
      // Compress the image
      const compressedBlob = await compressImage(file, {
        maxWidth: 1200, // Slightly larger for meal detail
        maxHeight: 1200,
        quality: 0.8, // Slightly higher quality for food photos
      });

      setUploadProgress(`Uploading (${formatFileSize(compressedBlob.size)})...`);

      // Create form data with compressed image
      const formData = new FormData();
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      formData.append('photo', compressedFile);

      // Upload to API
      const response = await fetch('/api/meal-photos/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      onPhotoUploaded(data.photoId, data.imageUrl);
    } catch (error) {
      console.error('Upload error:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to upload photo');
      setPreview(null);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleClearPreview = () => {
    setPreview(null);
    setIsUploading(false);
    setUploadProgress('');
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      {preview && (
        <div className="relative rounded-lg overflow-hidden bg-gray-100">
          <img src={preview} alt="Meal preview" className="w-full h-auto max-h-64 object-contain" />
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-2" />
                <p className="text-sm">{uploadProgress || 'Processing...'}</p>
              </div>
            </div>
          )}
          {!uploading && (
            <button
              onClick={handleClearPreview}
              className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70"
              aria-label="Clear preview"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Capture buttons */}
      {!preview && (
        <div className="grid grid-cols-2 gap-3">
          {/* Camera button */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center py-6 px-4 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50"
          >
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">Take Photo</span>
          </button>

          {/* Gallery button */}
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center py-6 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm font-medium">Choose Photo</span>
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGallerySelect} className="hidden" />
    </div>
  );
}
