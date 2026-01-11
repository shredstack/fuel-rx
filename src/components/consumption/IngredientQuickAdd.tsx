'use client';

import type { IngredientToLog } from '@/lib/types';

interface IngredientQuickAddProps {
  ingredients: IngredientToLog[];
  onSelectIngredient: (ingredient: IngredientToLog) => void;
  onAddOther: () => void;
}

export default function IngredientQuickAdd({ ingredients, onSelectIngredient, onAddOther }: IngredientQuickAddProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ingredients.slice(0, 8).map((ingredient, index) => (
        <button
          key={`${ingredient.name}-${index}`}
          onClick={() => onSelectIngredient(ingredient)}
          className="p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
        >
          <p className="font-medium text-gray-900 truncate text-sm">{ingredient.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {ingredient.calories_per_serving} cal/{ingredient.default_unit}
          </p>
        </button>
      ))}

      {/* Add Other Button */}
      <button
        onClick={onAddOther}
        className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-sm text-gray-600">Add Other</span>
      </button>
    </div>
  );
}
