'use client';

import type { USDASearchResultWithScore, IngredientCategoryType } from '@/lib/types';
import { MacroInput } from '@/components/ui';
import { DataTypeLabel } from './HealthScoreBadge';
import { CATEGORY_OPTIONS } from '@/lib/constants';

interface MacroValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface UsdaFoodReviewPanelProps {
  food: USDASearchResultWithScore;
  editedName: string;
  onNameChange: (name: string) => void;
  editedCategory: IngredientCategoryType;
  onCategoryChange: (category: IngredientCategoryType) => void;
  editingMacros: boolean;
  onEditingMacrosChange: (editing: boolean) => void;
  editedMacros: MacroValues;
  onMacrosChange: (macros: MacroValues) => void;
  isImporting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  compact?: boolean;
}

export default function UsdaFoodReviewPanel({
  food,
  editedName,
  onNameChange,
  editedCategory,
  onCategoryChange,
  editingMacros,
  onEditingMacrosChange,
  editedMacros,
  onMacrosChange,
  isImporting,
  onConfirm,
  onCancel,
  compact = false,
}: UsdaFoodReviewPanelProps) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <button
        onClick={onCancel}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to results
      </button>

      <div className={`bg-blue-50 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
        <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
          <DataTypeLabel dataType={food.dataType} brandOwner={food.brandOwner} />
        </div>

        <div className={compact ? 'mb-2' : 'mb-3'}>
          <label className={`block font-medium text-gray-700 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            Ingredient Name
          </label>
          <input
            type="text"
            value={editedName}
            onChange={(e) => onNameChange(e.target.value)}
            onFocus={(e) => {
              e.stopPropagation();
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }}
            className={`w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none ${compact ? 'text-sm' : ''}`}
            placeholder="Enter ingredient name"
          />
          {!compact && (
            <p className="text-xs text-gray-500 mt-1">Edit if needed before saving</p>
          )}
        </div>

        <div className={compact ? 'mb-2' : 'mb-3'}>
          <label className={`block font-medium text-gray-700 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            Category
          </label>
          <select
            value={editedCategory}
            onChange={(e) => onCategoryChange(e.target.value as IngredientCategoryType)}
            className={`w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none ${compact ? 'text-sm' : ''}`}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {!compact && (
            <p className="text-xs text-gray-500 mt-1">
              Select &quot;Fruit&quot; or &quot;Vegetable&quot; to count toward 800g goal
            </p>
          )}
        </div>

        {editingMacros ? (
          <div className={compact ? 'mt-2' : 'mt-4'}>
            <label className={`block font-medium text-gray-700 ${compact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>
              Nutrition per 100g
            </label>
            <div className="grid grid-cols-4 gap-2">
              <MacroInput
                macroType="calories"
                value={editedMacros.calories}
                onChange={(val) => onMacrosChange({ ...editedMacros, calories: val })}
                size="sm"
              />
              <MacroInput
                macroType="protein"
                value={editedMacros.protein}
                onChange={(val) => onMacrosChange({ ...editedMacros, protein: val })}
                size="sm"
              />
              <MacroInput
                macroType="carbs"
                value={editedMacros.carbs}
                onChange={(val) => onMacrosChange({ ...editedMacros, carbs: val })}
                size="sm"
              />
              <MacroInput
                macroType="fat"
                value={editedMacros.fat}
                onChange={(val) => onMacrosChange({ ...editedMacros, fat: val })}
                size="sm"
              />
            </div>
            <button
              type="button"
              onClick={() => onEditingMacrosChange(false)}
              className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'} text-gray-500 hover:text-gray-700 underline w-full text-center`}
            >
              Done editing
            </button>
          </div>
        ) : (
          <div className={compact ? 'mt-2' : 'mt-4'}>
            <label className={`block font-medium text-gray-700 ${compact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>
              Nutrition per 100g
            </label>
            <div className={`grid grid-cols-4 text-center ${compact ? 'gap-1' : 'gap-2'}`}>
              <div className={`bg-white rounded ${compact ? 'p-1.5' : 'p-2'}`}>
                <p className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-lg'}`}>
                  {editedMacros.calories}
                </p>
                <p className={`text-gray-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>cal</p>
              </div>
              <div className={`bg-white rounded ${compact ? 'p-1.5' : 'p-2'}`}>
                <p className={`font-semibold text-blue-600 ${compact ? 'text-sm' : 'text-lg'}`}>
                  {editedMacros.protein}g
                </p>
                <p className={`text-gray-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>protein</p>
              </div>
              <div className={`bg-white rounded ${compact ? 'p-1.5' : 'p-2'}`}>
                <p className={`font-semibold text-green-600 ${compact ? 'text-sm' : 'text-lg'}`}>
                  {editedMacros.carbs}g
                </p>
                <p className={`text-gray-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>carbs</p>
              </div>
              <div className={`bg-white rounded ${compact ? 'p-1.5' : 'p-2'}`}>
                <p className={`font-semibold text-amber-600 ${compact ? 'text-sm' : 'text-lg'}`}>
                  {editedMacros.fat}g
                </p>
                <p className={`text-gray-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>fat</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEditingMacrosChange(true)}
              className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'} text-primary-600 hover:text-primary-700 underline w-full text-center`}
            >
              Edit nutrition values
            </button>
          </div>
        )}
      </div>

      <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
        <button
          onClick={onCancel}
          className={`flex-1 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 ${compact ? 'py-2 px-3 text-sm' : 'py-3 px-4'}`}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!editedName.trim() || isImporting}
          className={`flex-1 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'py-2 px-3 text-sm' : 'py-3 px-4'}`}
        >
          {isImporting ? 'Adding...' : 'Add & Log'}
        </button>
      </div>
    </div>
  );
}
