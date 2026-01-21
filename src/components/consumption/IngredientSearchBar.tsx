'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { IngredientToLog } from '@/lib/types';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlatform } from '@/hooks/usePlatform';

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
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
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
  const searchIngredients = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/consumption/ingredients/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
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
      searchIngredients(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchIngredients]);

  const ValidationBadge = ({ ingredient }: { ingredient: IngredientToLog }) => {
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

        {/* Search Results Dropdown */}
        {showDropdown && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200
                       rounded-lg shadow-lg overflow-y-auto"
            style={{
              // When keyboard is visible on native, calculate available space
              // Leave some padding (100px) for the input and header above
              maxHeight: isNative && isKeyboardVisible && keyboardHeight > 0
                ? `calc(100vh - ${keyboardHeight}px - 200px)`
                : '16rem', // 256px = max-h-64
            }}
          >
            {results.map((ingredient, index) => (
              <button
                key={`${ingredient.name}-${index}`}
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

        {/* No results message */}
        {showDropdown && query.length >= 2 && results.length === 0 && !isSearching && (
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
