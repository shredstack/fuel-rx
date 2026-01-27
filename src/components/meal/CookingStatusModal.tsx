'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { CookingStatus } from '@/lib/types'
import { compressImage, isValidImageType, formatFileSize } from '@/lib/imageCompression'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    status: CookingStatus,
    notes?: string,
    updatedInstructions?: string[],
    photoUrl?: string,
    shareWithCommunity?: boolean
  ) => Promise<void>
  currentStatus: CookingStatus
  mealName: string
  currentInstructions?: string[]
  socialFeedEnabled?: boolean
}

export default function CookingStatusModal({
  isOpen,
  onClose,
  onSubmit,
  currentStatus,
  mealName,
  currentInstructions = [],
  socialFeedEnabled = false,
}: Props) {
  const [selectedStatus, setSelectedStatus] = useState<CookingStatus>(currentStatus)
  const [notes, setNotes] = useState('')
  const [showInstructionsEditor, setShowInstructionsEditor] = useState(false)
  const [editedInstructions, setEditedInstructions] = useState<string[]>(currentInstructions)
  const [saving, setSaving] = useState(false)

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Share toggle state
  const [shareWithCommunity, setShareWithCommunity] = useState(true)

  // Image validation modal state
  const [showImageValidationModal, setShowImageValidationModal] = useState(false)
  const [imageValidationMessage, setImageValidationMessage] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus)
      setNotes('')
      setShowInstructionsEditor(false)
      setEditedInstructions(currentInstructions)
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoError(null)
      setCompressionInfo(null)
      setShareWithCommunity(true)
      setShowImageValidationModal(false)
      setImageValidationMessage(null)
    }
  }, [isOpen, currentStatus, currentInstructions])

  if (!isOpen) return null

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError(null)
    setCompressionInfo(null)

    // Validate file type
    if (!isValidImageType(file)) {
      setPhotoError('Please select a valid image (JPEG, PNG, or WebP)')
      return
    }

    // Check file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Image is too large. Please select an image under 10MB.')
      return
    }

    try {
      // Compress the image
      const originalSize = file.size
      const compressedBlob = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      })

      const compressionPercent = Math.round((1 - compressedBlob.size / originalSize) * 100)
      setCompressionInfo(
        `Compressed from ${formatFileSize(originalSize)} to ${formatFileSize(compressedBlob.size)} (${compressionPercent}% smaller)`
      )

      // Create a File object from the blob for upload
      const compressedFile = new File([compressedBlob], 'cooked-meal.jpg', {
        type: 'image/jpeg',
      })
      setPhotoFile(compressedFile)

      // Create preview
      const previewUrl = URL.createObjectURL(compressedBlob)
      setPhotoPreview(previewUrl)
    } catch (err) {
      console.error('Error compressing image:', err)
      setPhotoError('Failed to process image')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
    setCompressionInfo(null)
    setPhotoError(null)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      let uploadedPhotoUrl: string | undefined

      // Upload photo if present
      if (photoFile && selectedStatus !== 'not_cooked') {
        setUploadingPhoto(true)
        try {
          const formData = new FormData()
          formData.append('image', photoFile)

          const response = await fetch('/api/cooked-meal-photos', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const data = await response.json()

            // Check if this is a validation rejection - show modal
            if (data.code === 'NOT_FOOD' || data.code === 'INAPPROPRIATE_CONTENT') {
              setImageValidationMessage(data.error || 'Please upload an image of food.')
              setShowImageValidationModal(true)
              setUploadingPhoto(false)
              setSaving(false)
              return
            }

            throw new Error(data.error || 'Failed to upload photo')
          }

          const { storagePath } = await response.json()
          uploadedPhotoUrl = storagePath
        } catch (err) {
          console.error('Error uploading photo:', err)
          setPhotoError(err instanceof Error ? err.message : 'Failed to upload photo')
          setUploadingPhoto(false)
          setSaving(false)
          return
        }
        setUploadingPhoto(false)
      }

      const instructionsToSave =
        selectedStatus === 'cooked_with_modifications' && showInstructionsEditor
          ? editedInstructions
          : undefined

      await onSubmit(
        selectedStatus,
        notes || undefined,
        instructionsToSave,
        uploadedPhotoUrl,
        selectedStatus !== 'not_cooked' ? shareWithCommunity : undefined
      )
      onClose()
    } catch (error) {
      console.error('Error saving cooking status:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...editedInstructions]
    newInstructions[index] = value
    setEditedInstructions(newInstructions)
  }

  const handleAddInstruction = () => {
    setEditedInstructions([...editedInstructions, ''])
  }

  const handleRemoveInstruction = (index: number) => {
    setEditedInstructions(editedInstructions.filter((_, i) => i !== index))
  }

  const handleTryDifferentImage = () => {
    setShowImageValidationModal(false)
    setImageValidationMessage(null)
    handleRemovePhoto()
    fileInputRef.current?.click()
  }

  const handleSaveWithoutImage = async () => {
    setShowImageValidationModal(false)
    setImageValidationMessage(null)
    handleRemovePhoto()

    // Continue with submit without photo
    setSaving(true)
    try {
      const instructionsToSave =
        selectedStatus === 'cooked_with_modifications' && showInstructionsEditor
          ? editedInstructions
          : undefined

      await onSubmit(
        selectedStatus,
        notes || undefined,
        instructionsToSave,
        undefined, // No photo
        selectedStatus !== 'not_cooked' ? shareWithCommunity : undefined
      )
      onClose()
    } catch (error) {
      console.error('Error saving cooking status:', error)
    } finally {
      setSaving(false)
    }
  }

  const isCooked = selectedStatus !== 'not_cooked'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 pb-safe">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] md:max-h-[90vh] overflow-y-auto mb-4 md:mb-0">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Update Cooking Status</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{mealName}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Options */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">How did it go?</label>

            {/* Not Cooked */}
            <button
              type="button"
              onClick={() => {
                setSelectedStatus('not_cooked')
                setShowInstructionsEditor(false)
              }}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedStatus === 'not_cooked'
                  ? 'border-gray-500 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedStatus === 'not_cooked' ? 'border-gray-500 bg-gray-500' : 'border-gray-300'
                  }`}
                >
                  {selectedStatus === 'not_cooked' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">Not Cooked Yet</p>
                  <p className="text-sm text-gray-500">Clear the cooking status</p>
                </div>
              </div>
            </button>

            {/* Cooked As-Is */}
            <button
              type="button"
              onClick={() => {
                setSelectedStatus('cooked_as_is')
                setShowInstructionsEditor(false)
              }}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedStatus === 'cooked_as_is'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedStatus === 'cooked_as_is' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}
                >
                  {selectedStatus === 'cooked_as_is' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">Cooked As-Is</p>
                  <p className="text-sm text-gray-500">Followed the instructions exactly</p>
                </div>
              </div>
            </button>

            {/* Cooked With Modifications */}
            <button
              type="button"
              onClick={() => setSelectedStatus('cooked_with_modifications')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedStatus === 'cooked_with_modifications'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedStatus === 'cooked_with_modifications'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedStatus === 'cooked_with_modifications' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">Cooked With Modifications</p>
                  <p className="text-sm text-gray-500">Made some changes to the recipe</p>
                </div>
              </div>
            </button>
          </div>

          {/* Photo Upload - shown for cooked options */}
          {isCooked && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Add a Photo (optional)
              </label>
              <div className="space-y-3">
                {photoPreview ? (
                  <div className="relative">
                    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={photoPreview}
                        alt="Cooked meal preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors z-10"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {compressionInfo && (
                      <p className="mt-2 text-xs text-green-600">{compressionInfo}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="cooked-meal-photo-input"
                    />
                    <label
                      htmlFor="cooked-meal-photo-input"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-400 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-500">Tap to add a photo</span>
                      <span className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP</span>
                    </label>
                  </div>
                )}
                {photoError && (
                  <p className="text-sm text-red-600">{photoError}</p>
                )}
              </div>
            </div>
          )}

          {/* Notes - shown for both cooked options */}
          {isCooked && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any thoughts about this meal..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Share with Community Toggle - shown if user has social feed enabled */}
          {isCooked && socialFeedEnabled && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="share-with-community"
                checked={shareWithCommunity}
                onChange={(e) => setShareWithCommunity(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="share-with-community" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium text-gray-900">Share with community</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Your photo and notes will be visible to other users
                </p>
              </label>
            </div>
          )}

          {/* Instructions Editor - shown when modifications selected */}
          {selectedStatus === 'cooked_with_modifications' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Edit Instructions</label>
                <button
                  type="button"
                  onClick={() => setShowInstructionsEditor(!showInstructionsEditor)}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  {showInstructionsEditor ? 'Hide Editor' : 'Update Recipe'}
                </button>
              </div>

              {showInstructionsEditor && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-3">
                    Edit the instructions below. Changes will be saved to the original meal so you can
                    follow them next time.
                  </p>
                  {editedInstructions.map((instruction, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={instruction}
                        onChange={(e) => handleInstructionChange(index, e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder={`Step ${index + 1}...`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveInstruction(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddInstruction}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors"
                  >
                    + Add Step
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - extra bottom padding on mobile for safe area */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 pb-6 md:pb-4 rounded-b-lg">
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline flex-1" disabled={saving}>
              Cancel
            </button>
            <button onClick={handleSubmit} className="btn-primary flex-1" disabled={saving || uploadingPhoto}>
              {uploadingPhoto ? 'Uploading...' : saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Image Validation Modal */}
      {showImageValidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Image Not Accepted</h3>
            </div>

            <p className="text-gray-600 mb-6">
              {imageValidationMessage}
            </p>

            <div className="space-y-3">
              <button
                onClick={handleTryDifferentImage}
                className="w-full btn-primary"
              >
                Try a Different Image
              </button>
              <button
                onClick={handleSaveWithoutImage}
                className="w-full btn-outline"
              >
                Save Without Image
              </button>
              <button
                onClick={() => {
                  setShowImageValidationModal(false)
                  setImageValidationMessage(null)
                }}
                className="w-full text-gray-500 hover:text-gray-700 text-sm py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
