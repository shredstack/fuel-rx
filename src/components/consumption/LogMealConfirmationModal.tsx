'use client';

import { useState, useEffect } from 'react';
import type { MealType, EditableIngredient, IngredientWithNutrition } from '@/lib/types';
import { useMealIngredients } from '@/hooks/queries/useMealIngredients';
import MealIngredientEditor from '@/components/consumption/MealIngredientEditor';
import MealTypeSelector from '@/components/consumption/MealTypeSelector';
import { usePlatform } from '@/hooks/usePlatform';

// Type for produce tracking
export interface DetectedProduceItem {
  name: string;
  amount: string;
  unit: string;
  category: 'fruit' | 'vegetable';
  estimatedGrams: number;
  isSelected: boolean;
  adjustedGrams: number;
}

// Macros type for the modal
export interface MealMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Data passed to onConfirm callback
export interface LogMealConfirmData {
  mealType: MealType;
  customMacros: MealMacros | null;
  selectedProduce: Array<{
    name: string;
    category: 'fruit' | 'vegetable';
    grams: number;
  }>;
}

interface LogMealConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Meal info
  mealName: string;
  mealMacros: MealMacros;
  // For ingredient editing - pass meal ID to enable portion adjustment
  mealId?: string | null;
  // Meal type selection
  mealType: MealType;
  onMealTypeChange: (type: MealType) => void;
  suggestedMealTypes: MealType[];
  // Produce tracking - parent manages fetching and state
  detectedProduce: DetectedProduceItem[];
  onProduceChange: (produce: DetectedProduceItem[]) => void;
  isLoadingProduce: boolean;
  // Confirm action
  onConfirm: (data: LogMealConfirmData) => void;
  isLogging: boolean;
}

// Convert meal ingredients to editable format
function ingredientsToEditable(ingredients: IngredientWithNutrition[]): EditableIngredient[] {
  return ingredients.map((ing) => {
    const amount = parseFloat(ing.amount) || 0;
    return {
      name: ing.name,
      amount,
      originalAmount: amount,
      unit: ing.unit,
      category: ing.category || 'other',
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
      // Store original macros so we can recalculate after setting to 0
      originalCalories: ing.calories,
      originalProtein: ing.protein,
      originalCarbs: ing.carbs,
      originalFat: ing.fat,
      isIncluded: true,
    };
  });
}

// Calculate total macros from editable ingredients
function calculateTotalMacros(ingredients: EditableIngredient[]): MealMacros {
  return ingredients
    .filter((ing) => ing.isIncluded && ing.amount > 0)
    .reduce(
      (acc, ing) => ({
        calories: acc.calories + ing.calories,
        protein: acc.protein + ing.protein,
        carbs: acc.carbs + ing.carbs,
        fat: acc.fat + ing.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

export default function LogMealConfirmationModal({
  isOpen,
  onClose,
  mealName,
  mealMacros,
  mealId,
  mealType,
  onMealTypeChange,
  suggestedMealTypes,
  detectedProduce,
  onProduceChange,
  isLoadingProduce,
  onConfirm,
  isLogging,
}: LogMealConfirmationModalProps) {
  const { isNative } = usePlatform();

  // Ingredient editing state
  const [showIngredientEditor, setShowIngredientEditor] = useState(false);
  const [editedIngredients, setEditedIngredients] = useState<EditableIngredient[] | null>(null);

  // Fetch meal ingredients when editor is shown
  const { data: mealWithIngredients, isLoading: ingredientsLoading } = useMealIngredients(
    showIngredientEditor && mealId ? mealId : null
  );

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowIngredientEditor(false);
      setEditedIngredients(null);
    }
  }, [isOpen]);

  // Initialize editable ingredients when meal data loads
  useEffect(() => {
    if (showIngredientEditor && mealWithIngredients?.ingredients && !editedIngredients) {
      setEditedIngredients(ingredientsToEditable(mealWithIngredients.ingredients));
    }
  }, [showIngredientEditor, mealWithIngredients, editedIngredients]);

  if (!isOpen) return null;

  // Calculate display macros
  const displayMacros = editedIngredients
    ? calculateTotalMacros(editedIngredients)
    : mealMacros;

  const isModified =
    editedIngredients &&
    (Math.round(displayMacros.calories) !== Math.round(mealMacros.calories) ||
      Math.round(displayMacros.protein * 10) !== Math.round(mealMacros.protein * 10) ||
      Math.round(displayMacros.carbs * 10) !== Math.round(mealMacros.carbs * 10) ||
      Math.round(displayMacros.fat * 10) !== Math.round(mealMacros.fat * 10));

  const handleConfirm = () => {
    const customMacros = editedIngredients ? calculateTotalMacros(editedIngredients) : null;
    const selectedProduce = detectedProduce
      .filter((p) => p.isSelected && p.adjustedGrams > 0)
      .map((p) => ({
        name: p.name,
        category: p.category,
        grams: p.adjustedGrams,
      }));

    onConfirm({
      mealType,
      customMacros: customMacros
        ? {
            calories: Math.round(customMacros.calories),
            protein: Math.round(customMacros.protein * 10) / 10,
            carbs: Math.round(customMacros.carbs * 10) / 10,
            fat: Math.round(customMacros.fat * 10) / 10,
          }
        : null,
      selectedProduce,
    });
  };

  const handleClose = () => {
    setShowIngredientEditor(false);
    setEditedIngredients(null);
    onClose();
  };

  // Simple modal that scrolls as a whole - more reliable on mobile
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      style={{ paddingBottom: isNative ? 'env(safe-area-inset-bottom)' : undefined }}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 pb-0 sm:pb-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Log &ldquo;{mealName}&rdquo;
          </h3>

          {/* Macro summary - shows edited or original macros */}
          <div
            className={`text-sm mb-4 p-2 rounded ${isModified ? 'bg-amber-50 border border-amber-200' : 'text-gray-500'}`}
          >
            {isModified && <span className="text-amber-600 font-medium">Modified: </span>}
            {Math.round(displayMacros.calories)} cal | {Math.round(displayMacros.protein * 10) / 10}
            g P | {Math.round(displayMacros.carbs * 10) / 10}g C |{' '}
            {Math.round(displayMacros.fat * 10) / 10}g F
          </div>
        </div>

        {/* Content area */}
        <div className="px-4 sm:px-6">
          {/* Adjust portions toggle - only if mealId is provided */}
          {mealId && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => {
                  if (showIngredientEditor) {
                    setShowIngredientEditor(false);
                    setEditedIngredients(null);
                  } else {
                    setShowIngredientEditor(true);
                    if (mealWithIngredients?.ingredients) {
                      setEditedIngredients(ingredientsToEditable(mealWithIngredients.ingredients));
                    }
                  }
                }}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showIngredientEditor ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {showIngredientEditor ? 'Hide ingredients' : 'Adjust portions'}
              </button>

              {/* Ingredient editor section */}
              {showIngredientEditor && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {ingredientsLoading ? (
                    <div className="text-center py-4 text-gray-500">
                      <svg
                        className="animate-spin h-5 w-5 mx-auto mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Loading ingredients...
                    </div>
                  ) : editedIngredients && editedIngredients.length > 0 ? (
                    <MealIngredientEditor
                      ingredients={editedIngredients}
                      onChange={setEditedIngredients}
                    />
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No ingredients available for this meal.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Inline Produce Tracking for 800g Goal */}
          <div className="mb-4">
            {isLoadingProduce ? (
              <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm text-green-700">Detecting fruits & veggies...</span>
              </div>
            ) : detectedProduce.length > 0 ? (
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🥬</span>
                  <span className="font-medium text-green-800 text-sm">Add to 800g Goal</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                    +
                    {detectedProduce
                      .filter((p) => p.isSelected)
                      .reduce((sum, p) => sum + p.adjustedGrams, 0)}
                    g
                  </span>
                </div>
                {/* Scrollable produce list with max height */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {detectedProduce.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        item.isSelected
                          ? 'bg-white border border-green-200'
                          : 'bg-green-50/50 opacity-60'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => {
                          onProduceChange(
                            detectedProduce.map((p, i) =>
                              i === index ? { ...p, isSelected: !p.isSelected } : p
                            )
                          );
                        }}
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                          item.isSelected
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {item.isSelected && (
                          <svg
                            className="w-2.5 h-2.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>

                      {/* Name */}
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <span className="text-sm">{item.category === 'fruit' ? '🍎' : '🥬'}</span>
                        <span
                          className={`text-sm truncate ${item.isSelected ? 'text-gray-900' : 'text-gray-500'}`}
                        >
                          {item.name}
                        </span>
                      </div>

                      {/* Gram adjuster */}
                      {item.isSelected && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onProduceChange(
                                detectedProduce.map((p, i) =>
                                  i === index
                                    ? { ...p, adjustedGrams: Math.max(0, p.adjustedGrams - 25) }
                                    : p
                                )
                              );
                            }}
                            className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.adjustedGrams}
                            onChange={(e) => {
                              const newGrams = parseInt(e.target.value) || 0;
                              onProduceChange(
                                detectedProduce.map((p, i) =>
                                  i === index ? { ...p, adjustedGrams: Math.max(0, newGrams) } : p
                                )
                              );
                            }}
                            className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs font-semibold"
                          />
                          <span className="text-xs text-gray-500">g</span>
                          <button
                            type="button"
                            onClick={() => {
                              onProduceChange(
                                detectedProduce.map((p, i) =>
                                  i === index ? { ...p, adjustedGrams: p.adjustedGrams + 25 } : p
                                )
                              );
                            }}
                            className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Meal type selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Log as:</label>
            <MealTypeSelector
              value={mealType}
              onChange={onMealTypeChange}
              suggestedTypes={suggestedMealTypes}
            />
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="p-4 sm:p-6 pt-4 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLogging || isLoadingProduce}
            className="flex-1 px-4 py-3 text-white bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLogging ? 'Logging...' : isLoadingProduce ? 'Detecting produce…' : 'Log'}
          </button>
        </div>
      </div>
    </div>
  );
}
