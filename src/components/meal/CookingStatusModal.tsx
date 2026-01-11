'use client'

import { useState, useEffect } from 'react'
import type { CookingStatus } from '@/lib/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (status: CookingStatus, notes?: string, updatedInstructions?: string[]) => Promise<void>
  currentStatus: CookingStatus
  mealName: string
  currentInstructions?: string[]
}

export default function CookingStatusModal({
  isOpen,
  onClose,
  onSubmit,
  currentStatus,
  mealName,
  currentInstructions = [],
}: Props) {
  const [selectedStatus, setSelectedStatus] = useState<CookingStatus>(currentStatus)
  const [notes, setNotes] = useState('')
  const [showInstructionsEditor, setShowInstructionsEditor] = useState(false)
  const [editedInstructions, setEditedInstructions] = useState<string[]>(currentInstructions)
  const [saving, setSaving] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus)
      setNotes('')
      setShowInstructionsEditor(false)
      setEditedInstructions(currentInstructions)
    }
  }, [isOpen, currentStatus, currentInstructions])

  if (!isOpen) return null

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const instructionsToSave =
        selectedStatus === 'cooked_with_modifications' && showInstructionsEditor
          ? editedInstructions
          : undefined
      await onSubmit(selectedStatus, notes || undefined, instructionsToSave)
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Notes - shown for both cooked options */}
          {selectedStatus !== 'not_cooked' && (
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

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg">
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline flex-1" disabled={saving}>
              Cancel
            </button>
            <button onClick={handleSubmit} className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
