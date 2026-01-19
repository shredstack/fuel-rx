'use client';

import { useState } from 'react';
import type { ConsumptionEntry, MealType } from '@/lib/types';
import { MEAL_TYPE_LABELS } from '@/lib/types';
import InlineAmountEditor from './InlineAmountEditor';

interface LoggedEntryRowProps {
  entry: ConsumptionEntry;
  onRemove: (entryId: string) => void;
  onMove: (entryId: string, newMealType: MealType) => void;
  onEditAmount?: (entryId: string, newAmount: number, newMacros: { calories: number; protein: number; carbs: number; fat: number }, newGrams?: number) => void;
  currentMealType: MealType;
}

export default function LoggedEntryRow({
  entry,
  onRemove,
  onMove,
  onEditAmount,
  currentMealType,
}: LoggedEntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Only allow editing for ingredient entries with an amount
  const canEdit = entry.entry_type === 'ingredient' && entry.amount !== undefined && entry.amount !== null && onEditAmount;

  const handleSaveAmount = (newAmount: number, newMacros: { calories: number; protein: number; carbs: number; fat: number }, newGrams?: number) => {
    if (onEditAmount) {
      onEditAmount(entry.id, newAmount, newMacros, newGrams);
    }
    setIsEditing(false);
  };

  return (
    <div className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
          {entry.display_name}
          {entry.ingredient_category === 'fruit' && <span title="Fruit - counts toward 800g">🍎</span>}
          {entry.ingredient_category === 'vegetable' && <span title="Vegetable - counts toward 800g">🥬</span>}
        </p>
        <div className="flex items-center gap-2">
          {/* Amount display or inline editor */}
          {canEdit && isEditing ? (
            <InlineAmountEditor
              entry={entry}
              onSave={handleSaveAmount}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <p className="text-xs text-gray-500">
              {/* Show amount with edit button for ingredients */}
              {canEdit && entry.amount && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-primary-600 hover:text-primary-700 hover:underline mr-1"
                  title="Click to edit amount"
                >
                  {entry.amount} {entry.unit}
                </button>
              )}
              {entry.calories} cal | {entry.protein}g P | {entry.carbs}g C | {entry.fat}g F
              {entry.grams && (entry.ingredient_category === 'fruit' || entry.ingredient_category === 'vegetable') && (
                <span className="text-green-600 ml-1">| {entry.grams}g</span>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Move to different meal type dropdown */}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onMove(entry.id, e.target.value as MealType);
            }
          }}
          className="text-xs text-gray-600 bg-gray-100 border-0 rounded px-2 py-1 cursor-pointer hover:bg-gray-200 focus:ring-1 focus:ring-primary-500"
          title="Move to different meal"
        >
          <option value="">Move...</option>
          {(['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'] as MealType[])
            .filter((mt) => mt !== currentMealType)
            .map((mt) => (
              <option key={mt} value={mt}>
                {MEAL_TYPE_LABELS[mt]}
              </option>
            ))}
        </select>
        <button
          onClick={() => onRemove(entry.id)}
          className="text-xs text-red-600 hover:text-red-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
