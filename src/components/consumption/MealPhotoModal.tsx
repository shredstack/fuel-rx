'use client';

import { useState, useCallback } from 'react';
import MealPhotoCapture from './MealPhotoCapture';
import MealAnalysisReview from './MealAnalysisReview';
import PhotoProduceExtractorModal from './PhotoProduceExtractorModal';
import type { MealType, ConsumptionEntry } from '@/lib/types';

interface MealPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onMealLogged: (entry: ConsumptionEntry) => void;
}

type ModalStep = 'capture' | 'review' | 'success' | 'produce';

interface PhotoData {
  photoId: string;
  imageUrl: string;
}

interface ProduceModalData {
  ingredients: SaveMealData['ingredients'];
  mealName: string;
  mealType: MealType;
}

interface SaveMealData {
  mealName: string;
  mealType: MealType;
  ingredients: Array<{
    name: string;
    estimated_amount: string;
    estimated_unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    category?: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'fat' | 'dairy' | 'other';
  }>;
  totalMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  saveTo: 'consumption' | 'library' | 'both';
  notes: string;
}

export default function MealPhotoModal({ isOpen, onClose, selectedDate, onMealLogged }: MealPhotoModalProps) {
  const [step, setStep] = useState<ModalStep>('capture');
  const [photoData, setPhotoData] = useState<PhotoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMealName, setSavedMealName] = useState<string>('');
  const [produceModalData, setProduceModalData] = useState<ProduceModalData | null>(null);

  const handlePhotoUploaded = useCallback((photoId: string, imageUrl: string) => {
    setPhotoData({ photoId, imageUrl });
    setStep('review');
    setError(null);
  }, []);

  const handlePhotoError = useCallback((error: string) => {
    setError(error);
  }, []);

  const handleSave = useCallback(
    async (data: SaveMealData) => {
      if (!photoData) return;

      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/meal-photos/${photoData.photoId}/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            saveTo: data.saveTo,
            mealType: data.mealType,
            editedName: data.mealName,
            editedIngredients: data.ingredients,
            notes: data.notes,
            consumedAt: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save meal');
        }

        const result = await response.json();

        // Create a consumption entry to pass back
        if (result.consumptionEntryId) {
          const entry: ConsumptionEntry = {
            id: result.consumptionEntryId,
            user_id: '', // Will be filled by the actual data
            entry_type: 'photo_meal' as 'meal_plan', // Type coercion for compatibility
            consumed_at: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
            consumed_date: selectedDate,
            display_name: data.mealName,
            meal_type: data.mealType,
            calories: data.totalMacros.calories,
            protein: data.totalMacros.protein,
            carbs: data.totalMacros.carbs,
            fat: data.totalMacros.fat,
            notes: data.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          onMealLogged(entry);
        }

        // Check if there are any fruits or vegetables to add to 800g goal
        const hasProduce = data.ingredients.some(
          (ing) => ing.category === 'fruit' || ing.category === 'vegetable'
        );

        if (hasProduce && (data.saveTo === 'consumption' || data.saveTo === 'both')) {
          // Show produce extraction modal
          setSavedMealName(data.mealName);
          setProduceModalData({
            ingredients: data.ingredients,
            mealName: data.mealName,
            mealType: data.mealType,
          });
          setStep('produce');
        } else {
          // No produce - show success briefly and close
          setSavedMealName(data.mealName);
          setStep('success');
          setTimeout(() => {
            handleClose();
          }, 1500);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save meal');
      } finally {
        setIsSaving(false);
      }
    },
    [photoData, onMealLogged, selectedDate]
  );

  const handleRetry = useCallback(() => {
    setStep('capture');
    setPhotoData(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    setStep('capture');
    setPhotoData(null);
    setError(null);
    setSavedMealName('');
    setProduceModalData(null);
    onClose();
  }, [onClose]);

  const handleProduceModalClose = useCallback(() => {
    // Produce modal finished (either skipped or logged)
    // Show brief success then close
    setStep('success');
    setTimeout(() => {
      handleClose();
    }, 1500);
  }, [handleClose]);

  if (!isOpen) return null;

  // Produce step renders its own modal
  if (step === 'produce' && produceModalData) {
    return (
      <PhotoProduceExtractorModal
        isOpen={true}
        onClose={handleProduceModalClose}
        ingredients={produceModalData.ingredients}
        mealName={produceModalData.mealName}
        mealType={produceModalData.mealType}
        selectedDate={selectedDate}
        onIngredientsLogged={() => {
          // Produce logged successfully - close will trigger success display
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'capture' && 'Snap a Meal'}
            {step === 'review' && 'Review Analysis'}
            {step === 'success' && 'Success!'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Capture step */}
          {step === 'capture' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Take a photo of your meal and our AI will identify ingredients and estimate nutrition.
              </p>
              <MealPhotoCapture onPhotoUploaded={handlePhotoUploaded} onError={handlePhotoError} />
            </div>
          )}

          {/* Review step */}
          {step === 'review' && photoData && (
            <MealAnalysisReview
              photoId={photoData.photoId}
              imageUrl={photoData.imageUrl}
              onSave={handleSave}
              onRetry={handleRetry}
              onCancel={handleClose}
            />
          )}

          {/* Success step */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Meal Logged!</h3>
              <p className="text-sm text-gray-600">{savedMealName}</p>
            </div>
          )}

          {/* Saving overlay */}
          {isSaving && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Saving...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
