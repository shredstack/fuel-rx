'use client';

import { useState, useEffect } from 'react';
import type { IngredientToLog, MealType, IngredientCategoryType } from '@/lib/types';
import MealTypeSelector from './MealTypeSelector';
import { countsToward800g } from './FruitVegProgressBar';

// Time-based meal type suggestion
function getTimeBasedMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

function getTimeBasedMealTypes(): MealType[] {
  const hour = new Date().getHours();
  if (hour < 10) return ['breakfast'];
  if (hour < 14) return ['lunch', 'snack'];
  if (hour < 18) return ['snack'];
  return ['dinner', 'snack'];
}

interface IngredientAmountPickerProps {
  ingredient: IngredientToLog;
  isOpen: boolean;
  onClose: () => void;
  onLog: (
    ingredient: IngredientToLog,
    amount: number,
    unit: string,
    mealType: MealType,
    grams?: number,
    category?: IngredientCategoryType
  ) => Promise<void>;
  initialMealType?: MealType | null;
}

export default function IngredientAmountPicker({ ingredient, isOpen, onClose, onLog, initialMealType }: IngredientAmountPickerProps) {
  const [amount, setAmount] = useState(ingredient.default_amount);
  const [mealType, setMealType] = useState<MealType>(initialMealType || getTimeBasedMealType());
  const [logging, setLogging] = useState(false);
  // 800g Challenge: grams input for fruits/vegetables
  const isFruitOrVeg = countsToward800g(ingredient.category);
  const [grams, setGrams] = useState<number>(ingredient.default_grams || 100);

  // Reset meal type when a new ingredient is selected or initialMealType changes
  // This ensures the correct meal type is shown when clicking + on a section
  useEffect(() => {
    setMealType(initialMealType || getTimeBasedMealType());
  }, [initialMealType, ingredient.name]);

  // Reset amount and grams when ingredient changes
  useEffect(() => {
    setAmount(ingredient.default_amount);
    setGrams(ingredient.default_grams || 100);
  }, [ingredient.name, ingredient.default_amount, ingredient.default_grams]);

  if (!isOpen) return null;

  // Calculate macros based on amount
  const macros = {
    calories: Math.round(ingredient.calories_per_serving * amount),
    protein: Math.round(ingredient.protein_per_serving * amount * 10) / 10,
    carbs: Math.round(ingredient.carbs_per_serving * amount * 10) / 10,
    fat: Math.round(ingredient.fat_per_serving * amount * 10) / 10,
  };

  const handleLog = async () => {
    setLogging(true);
    try {
      await onLog(
        ingredient,
        amount,
        ingredient.default_unit,
        mealType,
        isFruitOrVeg ? grams : undefined,
        ingredient.category
      );
    } finally {
      setLogging(false);
    }
  };

  const adjustAmount = (delta: number) => {
    const newAmount = Math.max(0.5, amount + delta);
    setAmount(Math.round(newAmount * 10) / 10);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{ingredient.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount Picker */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => adjustAmount(-0.5)}
            className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-600"
          >
            -
          </button>
          <div className="text-center">
            <span className="text-4xl font-bold text-gray-900">{amount}</span>
            <p className="text-gray-500">{ingredient.default_unit}</p>
          </div>
          <button
            onClick={() => adjustAmount(0.5)}
            className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-600"
          >
            +
          </button>
        </div>

        {/* 800g Challenge: Grams Input for Fruits/Vegetables */}
        {isFruitOrVeg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{ingredient.category === 'fruit' ? '🍎' : '🥬'}</span>
              <span className="text-sm font-medium text-green-800">Counts toward 800g goal!</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-green-700">Weight:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGrams(Math.max(10, grams - 50))}
                  className="w-8 h-8 rounded bg-green-100 hover:bg-green-200 text-green-700 font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={grams}
                  onChange={(e) => setGrams(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center border border-green-300 rounded px-2 py-1 text-lg font-bold text-green-800"
                />
                <span className="text-green-700 font-medium">g</span>
                <button
                  type="button"
                  onClick={() => setGrams(grams + 50)}
                  className="w-8 h-8 rounded bg-green-100 hover:bg-green-200 text-green-700 font-bold"
                >
                  +
                </button>
              </div>
            </div>
            {/* Quick preset buttons */}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setGrams(50)}
                className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded"
              >
                50g
              </button>
              <button
                type="button"
                onClick={() => setGrams(100)}
                className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded"
              >
                100g
              </button>
              <button
                type="button"
                onClick={() => setGrams(150)}
                className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded"
              >
                150g
              </button>
              <button
                type="button"
                onClick={() => setGrams(200)}
                className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded"
              >
                200g
              </button>
            </div>
          </div>
        )}

        {/* Macro Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-gray-900">{macros.calories}</p>
              <p className="text-xs text-gray-500">cal</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{macros.protein}g</p>
              <p className="text-xs text-gray-500">protein</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-600">{macros.carbs}g</p>
              <p className="text-xs text-gray-500">carbs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-pink-600">{macros.fat}g</p>
              <p className="text-xs text-gray-500">fat</p>
            </div>
          </div>
        </div>

        {/* Meal Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Log as:
          </label>
          <MealTypeSelector
            value={mealType}
            onChange={setMealType}
            suggestedTypes={getTimeBasedMealTypes()}
            compact
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1" disabled={logging}>
            Cancel
          </button>
          <button onClick={handleLog} className="btn-primary flex-1" disabled={logging}>
            {logging ? 'Logging...' : 'Log It'}
          </button>
        </div>
      </div>
    </div>
  );
}
