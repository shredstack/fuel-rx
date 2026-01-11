'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IngredientToLog } from '@/lib/types';

interface IngredientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIngredient: (ingredient: IngredientToLog) => void;
}

export default function IngredientSearchModal({ isOpen, onClose, onSelectIngredient }: IngredientSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IngredientToLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Search for ingredients
  const searchIngredients = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/consumption/ingredients/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching ingredients:', error);
    }
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchIngredients(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchIngredients]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (ingredient: IngredientToLog) => {
    onSelectIngredient(ingredient);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Add Ingredient</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
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
              placeholder="Search for an ingredient..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Searching...</div>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No ingredients found for &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Type at least 2 characters to search</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {results.map((ingredient, index) => (
                <button
                  key={`${ingredient.name}-${index}`}
                  onClick={() => handleSelect(ingredient)}
                  className="w-full p-3 bg-gray-50 hover:bg-primary-50 rounded-lg text-left transition-colors"
                >
                  <p className="font-medium text-gray-900">{ingredient.name}</p>
                  <p className="text-sm text-gray-500">
                    {ingredient.calories_per_serving} cal per {ingredient.default_amount} {ingredient.default_unit}
                    <span className="mx-2">|</span>
                    {ingredient.protein_per_serving}g P, {ingredient.carbs_per_serving}g C, {ingredient.fat_per_serving}g
                    F
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs capitalize">
                    {ingredient.source}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
