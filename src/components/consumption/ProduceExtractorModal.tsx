'use client';

import { useState, useEffect } from 'react';
import type { MealType, ConsumptionEntry } from '@/lib/types';

// ============================================
// Types
// ============================================

interface DetectedProduce {
  name: string;
  amount: string;
  unit: string;
  category: 'fruit' | 'vegetable';
  estimatedGrams: number;
  isSelected: boolean;
  adjustedGrams: number;
}

interface ProduceExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealId: string;
  mealName: string;
  mealType: MealType;
  selectedDate: string;
  onIngredientsLogged: (entries: ConsumptionEntry[]) => void;
}

type ModalStep = 'loading' | 'review' | 'success' | 'error';

// ============================================
// Component
// ============================================

export default function ProduceExtractorModal({
  isOpen,
  onClose,
  mealId,
  mealName,
  mealType,
  selectedDate,
  onIngredientsLogged,
}: ProduceExtractorModalProps) {
  const [step, setStep] = useState<ModalStep>('loading');
  const [produceItems, setProduceItems] = useState<DetectedProduce[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch produce data when modal opens
  useEffect(() => {
    if (isOpen && mealId) {
      fetchProduceData();
    }
  }, [isOpen, mealId]);

  const fetchProduceData = async () => {
    setStep('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/consumption/extract-produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_id: mealId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to extract produce');
      }

      const data = await response.json();
      const items = data.produceIngredients || [];

      if (items.length === 0) {
        // No produce found - close modal
        onClose();
        return;
      }

      // Initialize produce items with selection state
      const initializedItems: DetectedProduce[] = items.map((item: {
        name: string;
        amount: string;
        unit: string;
        category: 'fruit' | 'vegetable';
        estimatedGrams: number;
      }) => ({
        ...item,
        isSelected: true,
        adjustedGrams: item.estimatedGrams,
      }));

      setProduceItems(initializedItems);
      setStep('review');
    } catch (error) {
      console.error('Error fetching produce:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to analyze meal');
      setStep('error');
    }
  };

  const handleToggleItem = (index: number) => {
    setProduceItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const handleAdjustGrams = (index: number, newGrams: number) => {
    setProduceItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, adjustedGrams: Math.max(0, newGrams) } : item
      )
    );
  };

  const handleSubmit = async () => {
    const selectedItems = produceItems.filter((item) => item.isSelected && item.adjustedGrams > 0);

    if (selectedItems.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/consumption/log-produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: selectedItems.map((item) => ({
            name: item.name,
            category: item.category,
            grams: item.adjustedGrams,
          })),
          meal_type: mealType,
          consumed_at: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to log produce');
      }

      const data = await response.json();
      setStep('success');

      // Brief success display then close
      setTimeout(() => {
        onIngredientsLogged(data.entries || []);
        onClose();
      }, 1200);
    } catch (error) {
      console.error('Error logging produce:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to log produce');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalGrams = produceItems
    .filter((item) => item.isSelected)
    .reduce((sum, item) => sum + item.adjustedGrams, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-green-50 border-b border-green-100 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-xl">🥬</span>
                Add to 800g Goal?
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                from "{mealName}"
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading State */}
          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Analyzing ingredients...</p>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-900 font-medium mb-1">Something went wrong</p>
              <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
              <button
                onClick={fetchProduceData}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">Added to 800g!</p>
              <p className="text-sm text-gray-600">+{totalGrams}g fruits & veggies</p>
            </div>
          )}

          {/* Review State */}
          {step === 'review' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                We found these fruits and vegetables. Adjust the weights and select which ones to count:
              </p>

              {/* Produce Items */}
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {produceItems.map((item, index) => (
                  <ProduceItemRow
                    key={index}
                    item={item}
                    onToggle={() => handleToggleItem(index)}
                    onAdjustGrams={(grams) => handleAdjustGrams(index, grams)}
                  />
                ))}
              </div>

              {/* Total */}
              <div className="bg-green-50 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-800">Total to add:</span>
                  <span className="text-xl font-bold text-green-700">{totalGrams}g</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  disabled={isSubmitting}
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || totalGrams === 0}
                  className="flex-1 px-4 py-2.5 text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Add to 800g'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Subcomponent: ProduceItemRow
// ============================================

interface ProduceItemRowProps {
  item: DetectedProduce;
  onToggle: () => void;
  onAdjustGrams: (grams: number) => void;
}

function ProduceItemRow({ item, onToggle, onAdjustGrams }: ProduceItemRowProps) {
  const emoji = item.category === 'fruit' ? '🍎' : '🥬';

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        item.isSelected
          ? 'border-green-200 bg-green-50/50'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            item.isSelected
              ? 'bg-green-600 border-green-600 text-white'
              : 'border-gray-300 bg-white'
          }`}
        >
          {item.isSelected && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span>{emoji}</span>
            <span className="font-medium text-gray-900 truncate">{item.name}</span>
          </div>
          <p className="text-xs text-gray-500">
            {item.amount} {item.unit}
          </p>
        </div>

        {/* Gram Adjuster */}
        {item.isSelected && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAdjustGrams(item.adjustedGrams - 50)}
              className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm"
            >
              -
            </button>
            <input
              type="number"
              value={item.adjustedGrams}
              onChange={(e) => onAdjustGrams(parseInt(e.target.value) || 0)}
              className="w-16 text-center border border-gray-300 rounded px-1 py-1 text-sm font-semibold"
            />
            <span className="text-xs text-gray-500">g</span>
            <button
              onClick={() => onAdjustGrams(item.adjustedGrams + 50)}
              className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
