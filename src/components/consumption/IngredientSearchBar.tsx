'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { IngredientToLog, USDASearchResultWithScore, EnhancedSearchResults, IngredientCategoryType } from '@/lib/types';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlatform } from '@/hooks/usePlatform';
import { MacroInput } from '@/components/ui';
import HealthScoreBadge, { DataTypeLabel } from './HealthScoreBadge';

const CATEGORY_OPTIONS: { value: IngredientCategoryType; label: string }[] = [
  { value: 'protein', label: 'Protein' },
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'grain', label: 'Grain' },
  { value: 'fat', label: 'Fat' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'other', label: 'Other' },
];

interface Props {
  frequentIngredients: IngredientToLog[];
  pinnedIngredients: IngredientToLog[];
  onSelectIngredient: (ingredient: IngredientToLog) => void;
  onScanBarcode: () => void;
  onAddManually: () => void;
  onTogglePin?: (ingredient: IngredientToLog) => void;
}

export default function IngredientSearchBar({
  frequentIngredients,
  pinnedIngredients,
  onSelectIngredient,
  onScanBarcode,
  onAddManually,
  onTogglePin,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IngredientToLog[]>([]);
  const [usdaResults, setUsdaResults] = useState<USDASearchResultWithScore[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [includeUsda, setIncludeUsda] = useState(true);
  const [importingFdcId, setImportingFdcId] = useState<number | null>(null);
  const [reviewingUsdaFood, setReviewingUsdaFood] = useState<USDASearchResultWithScore | null>(null);
  const [usdaEditedName, setUsdaEditedName] = useState('');
  const [usdaEditedCategory, setUsdaEditedCategory] = useState<IngredientCategoryType>('other');
  const [usdaEditingMacros, setUsdaEditingMacros] = useState(false);
  const [usdaEditedMacros, setUsdaEditedMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [usdaImporting, setUsdaImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isKeyboardVisible, keyboardHeight } = useKeyboard();
  const { isNative } = usePlatform();

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for ingredients
  const searchIngredients = useCallback(async (searchQuery: string, searchUsda: boolean) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setUsdaResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const url = searchUsda
        ? `/api/consumption/ingredients/search?q=${encodeURIComponent(searchQuery)}&include_usda=true`
        : `/api/consumption/ingredients/search?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();

        if (searchUsda) {
          // Enhanced response with both FuelRx and USDA results
          const enhanced = data as EnhancedSearchResults;
          setResults(enhanced.fuelrx_results || []);
          setUsdaResults(enhanced.usda_results || []);
        } else {
          // Legacy response with just results array
          setResults(data.results || []);
          setUsdaResults([]);
        }
        setShowDropdown(true);
      }
    } catch (error) {
      console.error('Error searching ingredients:', error);
    }
    setIsSearching(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchIngredients(query, includeUsda);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, includeUsda, searchIngredients]);

  // Handle selecting a USDA food - show review screen
  const handleSelectUsdaFood = (usdaFood: USDASearchResultWithScore) => {
    setReviewingUsdaFood(usdaFood);
    const name = usdaFood.description
      .split(',')
      .slice(0, 3)
      .join(',')
      .trim();
    setUsdaEditedName(name);
    setUsdaEditedCategory('other');
    setUsdaEditedMacros({
      calories: Math.round(usdaFood.nutrition_per_100g.calories),
      protein: Math.round(usdaFood.nutrition_per_100g.protein),
      carbs: Math.round(usdaFood.nutrition_per_100g.carbs),
      fat: Math.round(usdaFood.nutrition_per_100g.fat),
    });
    setUsdaEditingMacros(false);
  };

  // Confirm and import the reviewed USDA food
  const handleConfirmUsdaFood = async () => {
    if (!reviewingUsdaFood || !usdaEditedName.trim()) return;

    // Only send overrides for values that differ from the USDA defaults
    const defaultName = reviewingUsdaFood.description
      .split(',')
      .slice(0, 3)
      .join(',')
      .trim();
    const defaultMacros = {
      calories: Math.round(reviewingUsdaFood.nutrition_per_100g.calories),
      protein: Math.round(reviewingUsdaFood.nutrition_per_100g.protein),
      carbs: Math.round(reviewingUsdaFood.nutrition_per_100g.carbs),
      fat: Math.round(reviewingUsdaFood.nutrition_per_100g.fat),
    };

    const payload: Record<string, unknown> = {
      fdcId: reviewingUsdaFood.fdcId,
      category: usdaEditedCategory,
    };
    if (usdaEditedName.trim() !== defaultName) payload.nameOverride = usdaEditedName.trim();
    if (usdaEditedMacros.calories !== defaultMacros.calories) payload.caloriesOverride = usdaEditedMacros.calories;
    if (usdaEditedMacros.protein !== defaultMacros.protein) payload.proteinOverride = usdaEditedMacros.protein;
    if (usdaEditedMacros.carbs !== defaultMacros.carbs) payload.carbsOverride = usdaEditedMacros.carbs;
    if (usdaEditedMacros.fat !== defaultMacros.fat) payload.fatOverride = usdaEditedMacros.fat;

    setUsdaImporting(true);
    try {
      const response = await fetch('/api/consumption/ingredients/import-usda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const ingredient: IngredientToLog = await response.json();
        onSelectIngredient(ingredient);
        setQuery('');
        setShowDropdown(false);
        setReviewingUsdaFood(null);
      } else {
        console.error('Failed to import USDA food');
      }
    } catch (error) {
      console.error('Error importing USDA food:', error);
    }
    setUsdaImporting(false);
  };

  const ValidationBadge = ({ ingredient }: { ingredient: IngredientToLog }) => {
    if (ingredient.is_user_added) {
      return (
        <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] align-middle">
          User Added
        </span>
      );
    }
    if (ingredient.is_validated) {
      return (
        <span className="text-green-500 ml-1" title="FuelRx Validated">
          <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }
    if (ingredient.source === 'barcode') {
      return (
        <span className="text-gray-400 ml-1" title="Barcode Scanned">
          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </span>
      );
    }
    return null;
  };

  const handleSelectIngredient = (ingredient: IngredientToLog) => {
    onSelectIngredient(ingredient);
    setQuery('');
    setShowDropdown(false);
  };

  // Combine pinned and frequent, removing duplicates
  const displayedChips = [...pinnedIngredients];
  const pinnedNames = new Set(pinnedIngredients.map(i => i.name.toLowerCase()));
  for (const ing of frequentIngredients) {
    if (!pinnedNames.has(ing.name.toLowerCase())) {
      displayedChips.push(ing);
    }
  }
  // Limit to 6 chips
  const limitedChips = displayedChips.slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Search Input Row */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && setShowDropdown(true)}
              placeholder="Search ingredients..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent
                               rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Scan Barcode Button */}
          <button
            onClick={onScanBarcode}
            className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600
                       hover:from-primary-600 hover:to-primary-700 rounded-lg
                       text-white transition-all shadow-md flex items-center gap-2"
            title="Scan barcode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="hidden sm:inline text-sm">Scan</span>
          </button>

          {/* Add Manually Button */}
          <button
            onClick={onAddManually}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg
                       text-gray-600 transition-colors"
            title="Add ingredient manually"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* USDA Search Toggle */}
        <label className="flex items-center gap-2 mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeUsda}
            onChange={(e) => setIncludeUsda(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">
            Search all foods (USDA Database)
          </span>
        </label>

        {/* USDA Review Panel */}
        {reviewingUsdaFood && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200
                       rounded-lg shadow-lg overflow-y-auto p-4 space-y-3"
            style={{
              maxHeight: isNative && isKeyboardVisible && keyboardHeight > 0
                ? `calc(100vh - ${keyboardHeight}px - 200px)`
                : '28rem',
            }}
          >
            <button
              onClick={() => setReviewingUsdaFood(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to results
            </button>

            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <DataTypeLabel
                  dataType={reviewingUsdaFood.dataType}
                  brandOwner={reviewingUsdaFood.brandOwner}
                />
              </div>

              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ingredient Name
                </label>
                <input
                  type="text"
                  value={usdaEditedName}
                  onChange={(e) => setUsdaEditedName(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Enter ingredient name"
                />
              </div>

              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={usdaEditedCategory}
                  onChange={(e) => setUsdaEditedCategory(e.target.value as IngredientCategoryType)}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {usdaEditingMacros ? (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nutrition per 100g
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <MacroInput
                      macroType="calories"
                      value={usdaEditedMacros.calories}
                      onChange={(val) =>
                        setUsdaEditedMacros((prev) => ({ ...prev, calories: val }))
                      }
                      size="sm"
                    />
                    <MacroInput
                      macroType="protein"
                      value={usdaEditedMacros.protein}
                      onChange={(val) =>
                        setUsdaEditedMacros((prev) => ({ ...prev, protein: val }))
                      }
                      size="sm"
                    />
                    <MacroInput
                      macroType="carbs"
                      value={usdaEditedMacros.carbs}
                      onChange={(val) =>
                        setUsdaEditedMacros((prev) => ({ ...prev, carbs: val }))
                      }
                      size="sm"
                    />
                    <MacroInput
                      macroType="fat"
                      value={usdaEditedMacros.fat}
                      onChange={(val) =>
                        setUsdaEditedMacros((prev) => ({ ...prev, fat: val }))
                      }
                      size="sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setUsdaEditingMacros(false)}
                    className="mt-1 text-xs text-gray-500 hover:text-gray-700 underline w-full text-center"
                  >
                    Done editing
                  </button>
                </div>
              ) : (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nutrition per 100g
                  </label>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className="bg-white rounded p-1.5">
                      <p className="text-sm font-semibold text-gray-900">{usdaEditedMacros.calories}</p>
                      <p className="text-[10px] text-gray-500">cal</p>
                    </div>
                    <div className="bg-white rounded p-1.5">
                      <p className="text-sm font-semibold text-blue-600">{usdaEditedMacros.protein}g</p>
                      <p className="text-[10px] text-gray-500">protein</p>
                    </div>
                    <div className="bg-white rounded p-1.5">
                      <p className="text-sm font-semibold text-green-600">{usdaEditedMacros.carbs}g</p>
                      <p className="text-[10px] text-gray-500">carbs</p>
                    </div>
                    <div className="bg-white rounded p-1.5">
                      <p className="text-sm font-semibold text-amber-600">{usdaEditedMacros.fat}g</p>
                      <p className="text-[10px] text-gray-500">fat</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUsdaEditingMacros(true)}
                    className="mt-1 text-xs text-primary-600 hover:text-primary-700 underline w-full text-center"
                  >
                    Edit nutrition values
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReviewingUsdaFood(null)}
                className="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUsdaFood}
                disabled={!usdaEditedName.trim() || usdaImporting}
                className="flex-1 py-2 px-3 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {usdaImporting ? 'Adding...' : 'Add & Log'}
              </button>
            </div>
          </div>
        )}

        {/* Search Results Dropdown */}
        {!reviewingUsdaFood && showDropdown && (results.length > 0 || usdaResults.length > 0) && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200
                       rounded-lg shadow-lg overflow-y-auto"
            style={{
              maxHeight: isNative && isKeyboardVisible && keyboardHeight > 0
                ? `calc(100vh - ${keyboardHeight}px - 200px)`
                : '20rem',
            }}
          >
            {/* FuelRx Results */}
            {results.length > 0 && (
              <div>
                {includeUsda && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      From FuelRx ({results.length})
                    </span>
                  </div>
                )}
                {results.map((ingredient, index) => (
                  <button
                    key={`fuelrx-${ingredient.name}-${index}`}
                    onClick={() => handleSelectIngredient(ingredient)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50
                               border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {ingredient.name}
                        <ValidationBadge ingredient={ingredient} />
                      </span>
                      <span className="text-sm text-gray-500">
                        {ingredient.calories_per_serving} cal
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      per {ingredient.default_amount} {ingredient.default_unit}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* USDA Results */}
            {usdaResults.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                  <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                    From USDA Database ({usdaResults.length})
                  </span>
                </div>
                {usdaResults.map((food) => (
                  <button
                    key={`usda-${food.fdcId}`}
                    onClick={() => handleSelectUsdaFood(food)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50
                               border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <HealthScoreBadge score={food.health_score} />
                      <span className="font-medium text-gray-900 flex-1 truncate">
                        {food.description}
                      </span>
                      <span className="text-sm text-gray-500 flex-shrink-0">
                        {Math.round(food.nutrition_per_100g.calories)} cal
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <DataTypeLabel dataType={food.dataType} brandOwner={food.brandOwner} />
                      <span className="text-xs text-gray-400">
                        per 100g | {Math.round(food.nutrition_per_100g.protein)}g P
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Show USDA suggestion when no USDA results but USDA is disabled */}
            {!includeUsda && results.length > 0 && results.length < 5 && (
              <button
                onClick={() => setIncludeUsda(true)}
                className="w-full px-4 py-2 text-center text-sm text-blue-600 hover:bg-blue-50
                           border-t border-gray-100"
              >
                Search USDA database for more options...
              </button>
            )}
          </div>
        )}

        {/* No results message */}
        {showDropdown && query.length >= 2 && results.length === 0 && usdaResults.length === 0 && !isSearching && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200
                       rounded-lg shadow-lg p-4 text-center"
            style={{
              // Keep visible above keyboard on native
              maxHeight: isNative && isKeyboardVisible && keyboardHeight > 0
                ? `calc(100vh - ${keyboardHeight}px - 200px)`
                : undefined,
            }}
          >
            <p className="text-gray-500 text-sm">No ingredients found</p>
            {!includeUsda && (
              <button
                onClick={() => setIncludeUsda(true)}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium block mx-auto"
              >
                Try searching USDA database
              </button>
            )}
            <button
              onClick={() => {
                setShowDropdown(false);
                onAddManually();
              }}
              className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              + Add &quot;{query}&quot; as new ingredient
            </button>
          </div>
        )}
      </div>

      {/* Pinned/Frequent Chips */}
      {limitedChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pinnedIngredients.length > 0 && (
            <span className="text-xs text-gray-500 self-center mr-1">Favorites:</span>
          )}
          {pinnedIngredients.length === 0 && (
            <span className="text-xs text-gray-500 self-center mr-1">Recent:</span>
          )}
          {limitedChips.map((ingredient, index) => (
            <button
              key={`${ingredient.name}-${index}`}
              onClick={() => handleSelectIngredient(ingredient)}
              className={`inline-flex items-center px-3 py-1.5 bg-white border
                         rounded-full text-sm text-gray-700
                         hover:border-primary-300 hover:bg-primary-50 transition-colors
                         ${ingredient.is_pinned ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}`}
            >
              {ingredient.is_pinned && (
                <svg className="w-3 h-3 text-amber-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              {ingredient.name}
              <ValidationBadge ingredient={ingredient} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
