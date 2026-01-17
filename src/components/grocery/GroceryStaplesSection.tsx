'use client';

import { useState, useCallback } from 'react';
import type { MealPlanStapleWithDetails, GroceryStaple, MealPlanCustomItem } from '@/lib/types';

interface Props {
  mealPlanId: string;
  staples: MealPlanStapleWithDetails[];
  availableStaples: GroceryStaple[];
  onStaplesChange: (staples: MealPlanStapleWithDetails[]) => void;
  customItems: MealPlanCustomItem[];
  onCustomItemsChange: (items: MealPlanCustomItem[]) => void;
}

export default function GroceryStaplesSection({
  mealPlanId,
  staples,
  availableStaples,
  onStaplesChange,
  customItems,
  onCustomItemsChange,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [addingQuickItem, setAddingQuickItem] = useState(false);

  // Combined count: staples + custom items
  const checkedCount = staples.filter(s => s.is_checked).length + customItems.filter(c => c.is_checked).length;
  const totalCount = staples.length + customItems.length;

  const handleToggleStapleCheck = useCallback(async (stapleId: string, currentState: boolean) => {
    // Optimistic update
    onStaplesChange(
      staples.map(s =>
        s.staple_id === stapleId ? { ...s, is_checked: !currentState } : s
      )
    );

    try {
      const response = await fetch(
        `/api/meal-plans/${mealPlanId}/staples/${stapleId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_checked: !currentState }),
        }
      );

      if (!response.ok) {
        onStaplesChange(staples);
      }
    } catch {
      onStaplesChange(staples);
    }
  }, [mealPlanId, staples, onStaplesChange]);

  const handleToggleCustomItemCheck = useCallback(async (itemId: string, currentState: boolean) => {
    // Optimistic update
    onCustomItemsChange(
      customItems.map(c =>
        c.id === itemId ? { ...c, is_checked: !currentState } : c
      )
    );

    try {
      const response = await fetch(
        `/api/meal-plans/${mealPlanId}/custom-items/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_checked: !currentState }),
        }
      );

      if (!response.ok) {
        onCustomItemsChange(customItems);
      }
    } catch {
      onCustomItemsChange(customItems);
    }
  }, [mealPlanId, customItems, onCustomItemsChange]);

  const handleRemoveStaple = useCallback(async (stapleId: string) => {
    const originalStaples = staples;
    onStaplesChange(staples.filter(s => s.staple_id !== stapleId));

    try {
      const response = await fetch(
        `/api/meal-plans/${mealPlanId}/staples/${stapleId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        onStaplesChange(originalStaples);
      }
    } catch {
      onStaplesChange(originalStaples);
    }
  }, [mealPlanId, staples, onStaplesChange]);

  const handleRemoveCustomItem = useCallback(async (itemId: string) => {
    const originalItems = customItems;
    onCustomItemsChange(customItems.filter(c => c.id !== itemId));

    try {
      const response = await fetch(
        `/api/meal-plans/${mealPlanId}/custom-items/${itemId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        onCustomItemsChange(originalItems);
      }
    } catch {
      onCustomItemsChange(originalItems);
    }
  }, [mealPlanId, customItems, onCustomItemsChange]);

  const handleAddSelected = useCallback(async () => {
    if (selectedToAdd.size === 0) return;

    setAdding(true);
    try {
      const response = await fetch(`/api/meal-plans/${mealPlanId}/staples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staple_ids: Array.from(selectedToAdd) }),
      });

      if (response.ok) {
        const { staples: newStaples } = await response.json();
        onStaplesChange([...staples, ...newStaples]);
        setSelectedToAdd(new Set());
        setShowAddModal(false);
      }
    } catch (err) {
      console.error('Error adding staples:', err);
    } finally {
      setAdding(false);
    }
  }, [mealPlanId, selectedToAdd, staples, onStaplesChange]);

  const handleAddQuickItem = useCallback(async () => {
    if (!quickAddName.trim()) return;

    setAddingQuickItem(true);
    try {
      const response = await fetch(`/api/meal-plans/${mealPlanId}/custom-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quickAddName.trim() }),
      });

      if (response.ok) {
        const { item } = await response.json();
        onCustomItemsChange([...customItems, item]);
        setQuickAddName('');
      }
    } catch (err) {
      console.error('Error adding custom item:', err);
    } finally {
      setAddingQuickItem(false);
    }
  }, [mealPlanId, quickAddName, customItems, onCustomItemsChange]);

  const toggleSelectToAdd = (id: string) => {
    setSelectedToAdd(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          My Items
          {totalCount > 0 && (
            <span className="text-sm font-normal text-gray-500">
              ({checkedCount}/{totalCount})
            </span>
          )}
        </h2>
        {availableStaples.length > 0 && (
          <button
            onClick={() => setShowAddModal(true)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            From Staples
          </button>
        )}
      </div>

      {/* Quick add input - always visible */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={quickAddName}
          onChange={(e) => setQuickAddName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddQuickItem()}
          placeholder="Quick add item..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          onClick={handleAddQuickItem}
          disabled={addingQuickItem || !quickAddName.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
        >
          {addingQuickItem ? '...' : 'Add'}
        </button>
      </div>

      {/* Items list */}
      {totalCount === 0 ? (
        <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
          No items added yet. Use the quick add above{availableStaples.length > 0 ? ' or tap "From Staples" to add items from your saved staples.' : '.'}
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {/* Staples */}
          {staples.map(({ staple_id, is_checked, staple }) => (
            <div key={`staple-${staple_id}`} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={is_checked}
                onChange={() => handleToggleStapleCheck(staple_id, is_checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className={`flex-1 ${is_checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {staple.display_name}
              </span>
              <button
                onClick={() => handleRemoveStaple(staple_id)}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                aria-label="Remove from list"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {/* Custom items */}
          {customItems.map((item) => (
            <div key={`custom-${item.id}`} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={item.is_checked}
                onChange={() => handleToggleCustomItemCheck(item.id, item.is_checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className={`flex-1 ${item.is_checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {item.name}
              </span>
              <button
                onClick={() => handleRemoveCustomItem(item.id)}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                aria-label="Remove from list"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add staples modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[70vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add from Staples</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedToAdd(new Set());
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {availableStaples.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  All your staples are already on this list! Use the quick add input for one-off items.
                </p>
              ) : (
                <div className="space-y-2">
                  {availableStaples.map((staple) => (
                    <label
                      key={staple.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedToAdd.has(staple.id)}
                        onChange={() => toggleSelectToAdd(staple.id)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="flex-1 text-gray-900">{staple.display_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleAddSelected}
                disabled={adding || selectedToAdd.size === 0}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : `Add ${selectedToAdd.size} Item${selectedToAdd.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
