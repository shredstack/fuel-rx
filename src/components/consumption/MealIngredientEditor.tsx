'use client';

import type { EditableIngredient } from '@/lib/types';

interface MealIngredientEditorProps {
  ingredients: EditableIngredient[];
  onChange: (ingredients: EditableIngredient[]) => void;
}

/**
 * Inline editor for adjusting meal ingredient portions.
 * Allows users to toggle ingredients on/off and adjust amounts.
 */
export default function MealIngredientEditor({
  ingredients,
  onChange,
}: MealIngredientEditorProps) {
  const handleToggleIngredient = (index: number) => {
    const updated = [...ingredients];
    updated[index] = {
      ...updated[index],
      isIncluded: !updated[index].isIncluded,
    };
    onChange(updated);
  };

  const handleAmountChange = (index: number, delta: number) => {
    const updated = [...ingredients];
    const ingredient = updated[index];
    const originalAmount = ingredient.originalAmount;

    // Calculate new amount (minimum 0)
    const newAmount = Math.max(0, ingredient.amount + delta);

    // Scale macros based on the ratio to original
    const scale = originalAmount > 0 ? newAmount / originalAmount : 0;

    updated[index] = {
      ...ingredient,
      amount: Math.round(newAmount * 10) / 10,
      calories: Math.round((ingredient.calories / (ingredient.amount / originalAmount || 1)) * scale),
      protein: Math.round((ingredient.protein / (ingredient.amount / originalAmount || 1)) * scale * 10) / 10,
      carbs: Math.round((ingredient.carbs / (ingredient.amount / originalAmount || 1)) * scale * 10) / 10,
      fat: Math.round((ingredient.fat / (ingredient.amount / originalAmount || 1)) * scale * 10) / 10,
    };
    onChange(updated);
  };

  const handleDirectAmountInput = (index: number, value: string) => {
    const updated = [...ingredients];
    const ingredient = updated[index];
    const originalAmount = ingredient.originalAmount;
    const newAmount = Math.max(0, parseFloat(value) || 0);

    // Scale macros based on the ratio to original
    const scale = originalAmount > 0 ? newAmount / originalAmount : 0;
    // Get the original macros by reverse-calculating from current state
    const currentScale = ingredient.amount / originalAmount || 1;
    const originalCalories = ingredient.calories / currentScale;
    const originalProtein = ingredient.protein / currentScale;
    const originalCarbs = ingredient.carbs / currentScale;
    const originalFat = ingredient.fat / currentScale;

    updated[index] = {
      ...ingredient,
      amount: newAmount,
      calories: Math.round(originalCalories * scale),
      protein: Math.round(originalProtein * scale * 10) / 10,
      carbs: Math.round(originalCarbs * scale * 10) / 10,
      fat: Math.round(originalFat * scale * 10) / 10,
    };
    onChange(updated);
  };

  // Calculate increment based on unit type
  const getIncrement = (unit: string): number => {
    const lowerUnit = unit.toLowerCase();
    if (lowerUnit.includes('gram') || lowerUnit === 'g') return 25;
    if (lowerUnit.includes('oz') || lowerUnit.includes('ounce')) return 1;
    if (lowerUnit.includes('cup')) return 0.25;
    if (lowerUnit.includes('tbsp') || lowerUnit.includes('tablespoon')) return 1;
    if (lowerUnit.includes('tsp') || lowerUnit.includes('teaspoon')) return 1;
    return 1; // Default increment
  };

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {ingredients.map((ingredient, index) => {
        const increment = getIncrement(ingredient.unit);

        return (
          <div
            key={`${ingredient.name}-${index}`}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              ingredient.isIncluded
                ? 'bg-white border-gray-200'
                : 'bg-gray-50 border-gray-100 opacity-60'
            }`}
          >
            {/* Toggle checkbox */}
            <button
              type="button"
              onClick={() => handleToggleIngredient(index)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                ingredient.isIncluded
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white border-gray-300'
              }`}
            >
              {ingredient.isIncluded && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Ingredient name */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${
                ingredient.isIncluded ? 'text-gray-900' : 'text-gray-500 line-through'
              }`}>
                {ingredient.name}
              </p>
              {ingredient.isIncluded && (
                <p className="text-xs text-gray-500">
                  {ingredient.calories} cal
                </p>
              )}
            </div>

            {/* Amount controls */}
            {ingredient.isIncluded && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleAmountChange(index, -increment)}
                  disabled={ingredient.amount <= 0}
                  className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={ingredient.amount}
                  onChange={(e) => handleDirectAmountInput(index, e.target.value)}
                  className="w-14 text-center text-sm border border-gray-200 rounded px-1 py-1"
                  min="0"
                  step={increment}
                />
                <span className="text-xs text-gray-500 w-8 truncate">{ingredient.unit}</span>
                <button
                  type="button"
                  onClick={() => handleAmountChange(index, increment)}
                  className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
                >
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
