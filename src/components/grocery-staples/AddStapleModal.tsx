'use client';

import { useState, useEffect, useRef } from 'react';
import type { GroceryStaple, GroceryStapleInput, GroceryCategory, StapleFrequency } from '@/lib/types';

interface Props {
  staple?: GroceryStaple | null;
  onSave: (input: GroceryStapleInput) => Promise<void>;
  onClose: () => void;
}

interface StapleSuggestion {
  id: string;
  display_name: string;
  name: string;
  brand: string | null;
  variant: string | null;
  category: GroceryCategory;
  times_added: number;
}

const CATEGORIES: { value: GroceryCategory; label: string }[] = [
  { value: 'produce', label: 'Produce' },
  { value: 'protein', label: 'Protein' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'grains', label: 'Grains' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'other', label: 'Other' },
];

export default function AddStapleModal({ staple, onSave, onClose }: Props) {
  const [name, setName] = useState(staple?.name || '');
  const [brand, setBrand] = useState(staple?.brand || '');
  const [variant, setVariant] = useState(staple?.variant || '');
  const [category, setCategory] = useState<GroceryCategory>(staple?.category || 'other');
  const [frequency, setFrequency] = useState<StapleFrequency>(staple?.add_frequency || 'as_needed');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<StapleSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!staple;

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Fetch suggestions when name changes
  useEffect(() => {
    if (isEditing || name.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const fetchSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/grocery-staples?search=${encodeURIComponent(name)}&limit=5`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const { staples } = await response.json();
          setSuggestions(staples);
          setShowSuggestions(staples.length > 0);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error fetching suggestions:', err);
        }
      }
    };

    const debounce = setTimeout(fetchSuggestions, 200);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [name, isEditing]);

  const handleSelectSuggestion = (suggestion: StapleSuggestion) => {
    setName(suggestion.name);
    setBrand(suggestion.brand || '');
    setVariant(suggestion.variant || '');
    setCategory(suggestion.category);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        brand: brand.trim() || null,
        variant: variant.trim() || null,
        category,
        add_frequency: frequency,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Staple' : 'Add Grocery Staple'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field with autocomplete */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="e.g., Milk, Eggs, Coffee"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{s.display_name}</span>
                      {s.times_added > 0 && (
                        <span className="text-xs text-gray-400">
                          added {s.times_added}x
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Brand field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Kirkland, Great Value"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Variant field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variant <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="e.g., 2%, 18ct, organic"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Category select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GroceryCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Frequency radio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="frequency"
                    value="every_week"
                    checked={frequency === 'every_week'}
                    onChange={() => setFrequency('every_week')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Every week</div>
                    <div className="text-sm text-gray-500">
                      Automatically added to each grocery list
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="frequency"
                    value="as_needed"
                    checked={frequency === 'as_needed'}
                    onChange={() => setFrequency('as_needed')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">As needed</div>
                    <div className="text-sm text-gray-500">
                      Add manually each week when you need it
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Staple'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
