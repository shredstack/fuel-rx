'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  IngredientToLog,
  BarcodeProduct,
  IngredientCategoryType,
  USDASearchResultWithScore,
  EnhancedSearchResults,
} from '@/lib/types';
import BarcodeScanner from './BarcodeScanner';
import { MacroInput } from '@/components/ui';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlatform } from '@/hooks/usePlatform';
import HealthScoreBadge, { DataTypeLabel } from './HealthScoreBadge';

type TabType = 'search' | 'barcode' | 'manual';

interface AddIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIngredient: (ingredient: IngredientToLog) => void;
}

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

export default function AddIngredientModal({
  isOpen,
  onClose,
  onSelectIngredient,
}: AddIngredientModalProps) {
  const { isKeyboardVisible, keyboardHeight } = useKeyboard();
  const { isNative } = usePlatform();
  const [activeTab, setActiveTab] = useState<TabType>('search');

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IngredientToLog[]>([]);
  const [usdaResults, setUsdaResults] = useState<USDASearchResultWithScore[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [includeUsda, setIncludeUsda] = useState(true);
  const [importingFdcId, setImportingFdcId] = useState<number | null>(null);

  // Barcode state
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeProduct | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeEditedName, setBarcodeEditedName] = useState<string>('');
  const [barcodeEditedCategory, setBarcodeEditedCategory] = useState<IngredientCategoryType>('other');
  const [barcodeEditingMacros, setBarcodeEditingMacros] = useState(false);
  const [barcodeEditedMacros, setBarcodeEditedMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  // USDA review state
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

  // Manual entry state
  const [manualForm, setManualForm] = useState({
    name: '',
    category: 'other' as IngredientCategoryType,
    serving_size: 1,
    serving_unit: 'serving',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Search for ingredients
  const searchIngredients = useCallback(async (searchQuery: string, searchUsda: boolean) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setUsdaResults([]);
      return;
    }

    setSearchLoading(true);
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
          setSearchResults(enhanced.fuelrx_results || []);
          setUsdaResults(enhanced.usda_results || []);
        } else {
          // Legacy response with just results array
          setSearchResults(data.results || []);
          setUsdaResults([]);
        }
      }
    } catch (error) {
      console.error('Error searching ingredients:', error);
    }
    setSearchLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchIngredients(query, includeUsda);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, includeUsda, searchIngredients]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('search');
      setQuery('');
      setSearchResults([]);
      setUsdaResults([]);
      setImportingFdcId(null);
      setBarcodeProduct(null);
      setBarcodeError(null);
      setBarcodeEditedName('');
      setBarcodeEditedCategory('other');
      setBarcodeEditingMacros(false);
      setBarcodeEditedMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      setReviewingUsdaFood(null);
      setUsdaEditedName('');
      setUsdaEditedCategory('other');
      setUsdaEditingMacros(false);
      setUsdaEditedMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      setUsdaImporting(false);
      setManualForm({
        name: '',
        category: 'other',
        serving_size: 1,
        serving_unit: 'serving',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    }
  }, [isOpen]);

  // Handle selecting a USDA food - show review screen
  const handleSelectUsdaFood = (usdaFood: USDASearchResultWithScore) => {
    setReviewingUsdaFood(usdaFood);
    // Pre-populate with USDA data
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
        setReviewingUsdaFood(null);
      } else {
        console.error('Failed to import USDA food');
      }
    } catch (error) {
      console.error('Error importing USDA food:', error);
    }
    setUsdaImporting(false);
  };

  if (!isOpen) return null;

  const handleBarcodeScanned = async (barcode: string) => {
    setBarcodeLoading(true);
    setBarcodeError(null);
    setBarcodeProduct(null);

    try {
      const response = await fetch(`/api/ingredients/barcode?code=${encodeURIComponent(barcode)}`);
      const data = await response.json();

      if (data.found) {
        setBarcodeProduct(data);
        // Initialize editable name with brand + product name
        const initialName = data.brand ? `${data.brand} ${data.name}` : data.name;
        setBarcodeEditedName(initialName);
        // Initialize category from AI detection (user can override)
        setBarcodeEditedCategory(data.category || 'other');
        // Initialize editable macros with scanned values
        setBarcodeEditedMacros({
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
        });
        setBarcodeEditingMacros(false);
      } else {
        setBarcodeError('Product not found. Try adding it manually.');
      }
    } catch (error) {
      console.error('Error looking up barcode:', error);
      setBarcodeError('Failed to look up barcode. Please try again.');
    }
    setBarcodeLoading(false);
  };

  const handleBarcodeProductConfirm = async () => {
    if (!barcodeProduct || !barcodeEditedName.trim()) return;

    // Save the barcode product as a user-added ingredient
    // Use the user-edited name, category, and macros (which default to scanned values)
    try {
      const response = await fetch('/api/ingredients/user-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: barcodeEditedName.trim(),
          category: barcodeEditedCategory,
          serving_size: barcodeProduct.serving_size || 1,
          serving_unit: barcodeProduct.serving_unit || 'serving',
          calories: barcodeEditedMacros.calories,
          protein: barcodeEditedMacros.protein,
          carbs: barcodeEditedMacros.carbs,
          fat: barcodeEditedMacros.fat,
          barcode: barcodeProduct.barcode,
        }),
      });

      if (response.ok) {
        const ingredient: IngredientToLog = await response.json();
        onSelectIngredient(ingredient);
        // Don't call onClose() here - let the parent handle closing
        // This preserves addingToMealType for IngredientAmountPicker
      }
    } catch (error) {
      console.error('Error saving barcode product:', error);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualForm.name.trim()) return;

    setManualSubmitting(true);
    try {
      const response = await fetch('/api/ingredients/user-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      });

      if (response.ok) {
        const ingredient: IngredientToLog = await response.json();
        onSelectIngredient(ingredient);
        // Don't call onClose() here - let the parent handle closing
        // This preserves addingToMealType for IngredientAmountPicker
      }
    } catch (error) {
      console.error('Error saving manual ingredient:', error);
    }
    setManualSubmitting(false);
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex justify-center z-50 p-4 ${
      isNative && isKeyboardVisible ? 'items-start pt-8' : 'items-center'
    }`}>
      <div
        className="bg-white rounded-xl max-w-md w-full shadow-xl flex flex-col"
        style={{
          maxHeight: isNative && isKeyboardVisible
            ? `calc(100vh - ${keyboardHeight}px - 4rem)`
            : '90vh',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Add Ingredient</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'search'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('barcode')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'barcode'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Scan Barcode
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="p-4">
              {/* USDA Review Screen */}
              {reviewingUsdaFood ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setReviewingUsdaFood(null)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to results
                  </button>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DataTypeLabel
                        dataType={reviewingUsdaFood.dataType}
                        brandOwner={reviewingUsdaFood.brandOwner}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ingredient Name
                      </label>
                      <input
                        type="text"
                        value={usdaEditedName}
                        onChange={(e) => setUsdaEditedName(e.target.value)}
                        onFocus={(e) => {
                          e.stopPropagation();
                          setTimeout(() => {
                            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 300);
                        }}
                        className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        placeholder="Enter ingredient name"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Edit if needed before saving
                      </p>
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={usdaEditedCategory}
                        onChange={(e) => setUsdaEditedCategory(e.target.value as IngredientCategoryType)}
                        className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Select &quot;Fruit&quot; or &quot;Vegetable&quot; to count toward 800g goal
                      </p>
                    </div>

                    {usdaEditingMacros ? (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                          className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline w-full text-center"
                        >
                          Done editing
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nutrition per 100g
                        </label>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-gray-900">
                              {usdaEditedMacros.calories}
                            </p>
                            <p className="text-xs text-gray-500">cal</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-blue-600">
                              {usdaEditedMacros.protein}g
                            </p>
                            <p className="text-xs text-gray-500">protein</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-green-600">
                              {usdaEditedMacros.carbs}g
                            </p>
                            <p className="text-xs text-gray-500">carbs</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-amber-600">
                              {usdaEditedMacros.fat}g
                            </p>
                            <p className="text-xs text-gray-500">fat</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUsdaEditingMacros(true)}
                          className="mt-2 text-sm text-primary-600 hover:text-primary-700 underline w-full text-center"
                        >
                          Edit nutrition values
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setReviewingUsdaFood(null)}
                      className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmUsdaFood}
                      disabled={!usdaEditedName.trim() || usdaImporting}
                      className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {usdaImporting ? 'Adding...' : 'Add & Log'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative mb-3">
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
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={(e) => {
                        e.stopPropagation();
                        setTimeout(() => {
                          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                      }}
                      placeholder="Search for an ingredient..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      autoFocus
                    />
                  </div>

                  {/* USDA Search Toggle */}
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
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

                  {searchLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-gray-500">
                        {includeUsda ? 'Searching FuelRx & USDA...' : 'Searching...'}
                      </div>
                    </div>
                  )}

                  {!searchLoading && query.length >= 2 && searchResults.length === 0 && usdaResults.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No ingredients found for &ldquo;{query}&rdquo;</p>
                      {!includeUsda && (
                        <button
                          onClick={() => setIncludeUsda(true)}
                          className="mt-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          Try searching USDA database
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setManualForm((prev) => ({ ...prev, name: query }));
                          setActiveTab('manual');
                        }}
                        className="mt-3 block mx-auto text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Add &ldquo;{query}&rdquo; manually
                      </button>
                    </div>
                  )}

                  {!searchLoading && query.length < 2 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Type at least 2 characters to search</p>
                    </div>
                  )}

                  {!searchLoading && (searchResults.length > 0 || usdaResults.length > 0) && (
                    <div className="space-y-4">
                      {/* FuelRx Results */}
                      {searchResults.length > 0 && (
                        <div>
                          {includeUsda && (
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                              From FuelRx ({searchResults.length})
                            </p>
                          )}
                          <div className="space-y-2">
                            {searchResults.map((ingredient, index) => (
                              <button
                                key={`fuelrx-${ingredient.name}-${index}`}
                                onClick={() => {
                                  onSelectIngredient(ingredient);
                                }}
                                className="w-full p-3 bg-gray-50 hover:bg-primary-50 rounded-lg text-left transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-gray-900">{ingredient.name}</p>
                                  {ingredient.is_user_added && (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                      User Added
                                    </span>
                                  )}
                                  {ingredient.is_validated && !ingredient.is_user_added && (
                                    <span className="text-green-500" title="FuelRx Validated">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {ingredient.calories_per_serving} cal per {ingredient.default_amount}{' '}
                                  {ingredient.default_unit}
                                  <span className="mx-2">|</span>
                                  {ingredient.protein_per_serving}g P, {ingredient.carbs_per_serving}g C,{' '}
                                  {ingredient.fat_per_serving}g F
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* USDA Results */}
                      {usdaResults.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            From USDA Database ({usdaResults.length})
                          </p>
                          <div className="space-y-2">
                            {usdaResults.map((food) => (
                              <button
                                key={`usda-${food.fdcId}`}
                                onClick={() => handleSelectUsdaFood(food)}
                                className="w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <HealthScoreBadge score={food.health_score} />
                                  <p className="font-medium text-gray-900 flex-1 truncate">
                                    {food.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs mb-1">
                                  <DataTypeLabel
                                    dataType={food.dataType}
                                    brandOwner={food.brandOwner}
                                  />
                                </div>
                                <p className="text-sm text-gray-500">
                                  {Math.round(food.nutrition_per_100g.calories)} cal per 100g
                                  <span className="mx-2">|</span>
                                  {Math.round(food.nutrition_per_100g.protein)}g P,{' '}
                                  {Math.round(food.nutrition_per_100g.carbs)}g C,{' '}
                                  {Math.round(food.nutrition_per_100g.fat)}g F
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Barcode Tab */}
          {activeTab === 'barcode' && (
            <div className="p-4">
              {!barcodeProduct && !barcodeLoading && !barcodeError && (
                <BarcodeScanner onScan={handleBarcodeScanned} onError={setBarcodeError} />
              )}

              {barcodeLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3"></div>
                  <p className="text-gray-500">Looking up product...</p>
                </div>
              )}

              {barcodeError && (
                <div className="text-center py-8">
                  <svg
                    className="w-12 h-12 mx-auto text-amber-500 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-gray-900 font-medium mb-2">Product not found</p>
                  <p className="text-gray-500 text-sm mb-4">{barcodeError}</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setBarcodeError(null);
                        setBarcodeProduct(null);
                      }}
                      className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
                    >
                      Try scanning again
                    </button>
                    <button
                      onClick={() => {
                        setBarcodeError(null);
                        setActiveTab('manual');
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Add ingredient manually
                    </button>
                  </div>
                </div>
              )}

              {barcodeProduct && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    {barcodeProduct.image_url && (
                      <img
                        src={barcodeProduct.image_url}
                        alt={barcodeProduct.name}
                        className="w-20 h-20 object-contain mx-auto mb-3 rounded"
                      />
                    )}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ingredient Name
                      </label>
                      <input
                        type="text"
                        value={barcodeEditedName}
                        onChange={(e) => setBarcodeEditedName(e.target.value)}
                        onFocus={(e) => {
                          e.stopPropagation();
                          setTimeout(() => {
                            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 300);
                        }}
                        className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        placeholder="Enter ingredient name"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Edit if needed before saving
                      </p>
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={barcodeEditedCategory}
                        onChange={(e) => setBarcodeEditedCategory(e.target.value as IngredientCategoryType)}
                        className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Select &quot;Fruit&quot; or &quot;Vegetable&quot; to count toward 800g goal
                      </p>
                    </div>

                    {barcodeEditingMacros ? (
                      <div className="mt-4">
                        <div className="grid grid-cols-4 gap-2">
                          <MacroInput
                            macroType="calories"
                            value={barcodeEditedMacros.calories}
                            onChange={(val) =>
                              setBarcodeEditedMacros((prev) => ({ ...prev, calories: val }))
                            }
                            size="sm"
                          />
                          <MacroInput
                            macroType="protein"
                            value={barcodeEditedMacros.protein}
                            onChange={(val) =>
                              setBarcodeEditedMacros((prev) => ({ ...prev, protein: val }))
                            }
                            size="sm"
                          />
                          <MacroInput
                            macroType="carbs"
                            value={barcodeEditedMacros.carbs}
                            onChange={(val) =>
                              setBarcodeEditedMacros((prev) => ({ ...prev, carbs: val }))
                            }
                            size="sm"
                          />
                          <MacroInput
                            macroType="fat"
                            value={barcodeEditedMacros.fat}
                            onChange={(val) =>
                              setBarcodeEditedMacros((prev) => ({ ...prev, fat: val }))
                            }
                            size="sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setBarcodeEditingMacros(false)}
                          className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline w-full text-center"
                        >
                          Done editing
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-gray-900">
                              {barcodeEditedMacros.calories}
                            </p>
                            <p className="text-xs text-gray-500">cal</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-blue-600">
                              {barcodeEditedMacros.protein}g
                            </p>
                            <p className="text-xs text-gray-500">protein</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-green-600">
                              {barcodeEditedMacros.carbs}g
                            </p>
                            <p className="text-xs text-gray-500">carbs</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-amber-600">
                              {barcodeEditedMacros.fat}g
                            </p>
                            <p className="text-xs text-gray-500">fat</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBarcodeEditingMacros(true)}
                          className="mt-2 text-sm text-primary-600 hover:text-primary-700 underline w-full text-center"
                        >
                          Edit nutrition values
                        </button>
                      </div>
                    )}

                    <p className="text-sm text-gray-500 text-center mt-3">
                      Per {barcodeProduct.serving_size} {barcodeProduct.serving_unit}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setBarcodeProduct(null);
                        setBarcodeError(null);
                        setBarcodeEditedName('');
                        setBarcodeEditedCategory('other');
                        setBarcodeEditingMacros(false);
                        setBarcodeEditedMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 });
                      }}
                      className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                    >
                      Scan Again
                    </button>
                    <button
                      onClick={handleBarcodeProductConfirm}
                      disabled={!barcodeEditedName.trim()}
                      className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add & Log
                    </button>
                  </div>

                  <p className="text-xs text-amber-600 text-center">
                    This ingredient will be marked as user-added (not FuelRx validated)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Manual Tab */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredient Name *
                </label>
                <input
                  type="text"
                  value={manualForm.name}
                  onChange={(e) => setManualForm((prev) => ({ ...prev, name: e.target.value }))}
                  onFocus={(e) => {
                    e.stopPropagation();
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                  }}
                  placeholder="e.g., Chocolate Chip Cookie"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={manualForm.category}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      category: e.target.value as IngredientCategoryType,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serving Size *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualForm.serving_size}
                    onChange={(e) =>
                      setManualForm((prev) => ({
                        ...prev,
                        serving_size: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <input
                    type="text"
                    value={manualForm.serving_unit}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, serving_unit: e.target.value }))
                    }
                    onFocus={(e) => {
                      e.stopPropagation();
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 300);
                    }}
                    placeholder="e.g., serving, oz, cup"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nutrition per serving
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <MacroInput
                    macroType="calories"
                    value={manualForm.calories}
                    onChange={(val) =>
                      setManualForm((prev) => ({ ...prev, calories: val }))
                    }
                    size="sm"
                  />
                  <MacroInput
                    macroType="protein"
                    value={manualForm.protein}
                    onChange={(val) =>
                      setManualForm((prev) => ({ ...prev, protein: val }))
                    }
                    size="sm"
                  />
                  <MacroInput
                    macroType="carbs"
                    value={manualForm.carbs}
                    onChange={(val) =>
                      setManualForm((prev) => ({ ...prev, carbs: val }))
                    }
                    size="sm"
                  />
                  <MacroInput
                    macroType="fat"
                    value={manualForm.fat}
                    onChange={(val) =>
                      setManualForm((prev) => ({ ...prev, fat: val }))
                    }
                    size="sm"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={manualSubmitting || !manualForm.name.trim()}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {manualSubmitting ? 'Adding...' : 'Add & Log Ingredient'}
                </button>
                <p className="text-xs text-amber-600 text-center mt-2">
                  This ingredient will be marked as user-added (not FuelRx validated)
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
