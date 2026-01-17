'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import MobileTabBar from '@/components/MobileTabBar';
import AddStapleModal from '@/components/grocery-staples/AddStapleModal';
import StapleCard from '@/components/grocery-staples/StapleCard';
import type { GroceryStaple, GroceryStapleInput } from '@/lib/types';

interface Props {
  initialStaples: GroceryStaple[];
}

export default function GroceryStaplesClient({ initialStaples }: Props) {
  const [staples, setStaples] = useState<GroceryStaple[]>(initialStaples);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaple, setEditingStaple] = useState<GroceryStaple | null>(null);
  const [error, setError] = useState<string | null>(null);

  const everyWeekStaples = staples.filter(s => s.add_frequency === 'every_week');
  const asNeededStaples = staples.filter(s => s.add_frequency === 'as_needed');

  const handleAddStaple = useCallback(async (input: GroceryStapleInput) => {
    try {
      const response = await fetch('/api/grocery-staples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add staple');
      }

      const { staple } = await response.json();
      setStaples(prev => [staple, ...prev]);
      setShowAddModal(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staple');
    }
  }, []);

  const handleUpdateStaple = useCallback(async (id: string, input: Partial<GroceryStapleInput>) => {
    try {
      const response = await fetch(`/api/grocery-staples/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update staple');
      }

      const { staple } = await response.json();
      setStaples(prev => prev.map(s => s.id === id ? staple : s));
      setEditingStaple(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staple');
    }
  }, []);

  const handleDeleteStaple = useCallback(async (id: string) => {
    if (!confirm('Remove this item from your staples?')) return;

    try {
      const response = await fetch(`/api/grocery-staples/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete staple');
      }

      setStaples(prev => prev.filter(s => s.id !== id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staple');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/profile" className="text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Grocery Staples</h1>
            <p className="text-sm text-gray-600">Items you buy regularly, beyond your meal plan</p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Add button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors mb-6 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add a staple item
        </button>

        {/* Every Week Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-green-600">*</span>
            Every Week
            <span className="text-sm font-normal text-gray-500">
              (auto-added to grocery lists)
            </span>
          </h2>

          {everyWeekStaples.length === 0 ? (
            <p className="text-gray-500 text-sm p-4 bg-gray-100 rounded-lg">
              No items yet. Items marked "every week" will automatically appear on each grocery list.
            </p>
          ) : (
            <div className="space-y-2">
              {everyWeekStaples.map(staple => (
                <StapleCard
                  key={staple.id}
                  staple={staple}
                  onEdit={() => setEditingStaple(staple)}
                  onDelete={() => handleDeleteStaple(staple.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* As Needed Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-blue-600">*</span>
            As Needed
            <span className="text-sm font-normal text-gray-500">
              (add manually each week)
            </span>
          </h2>

          {asNeededStaples.length === 0 ? (
            <p className="text-gray-500 text-sm p-4 bg-gray-100 rounded-lg">
              No items yet. "As needed" items can be quickly added to any week's grocery list.
            </p>
          ) : (
            <div className="space-y-2">
              {asNeededStaples.map(staple => (
                <StapleCard
                  key={staple.id}
                  staple={staple}
                  onEdit={() => setEditingStaple(staple)}
                  onDelete={() => handleDeleteStaple(staple.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Info box */}
        <div className="bg-primary-50 p-4 rounded-lg">
          <p className="text-sm text-primary-800">
            <strong>Tip:</strong> "Every week" items are automatically added to each new grocery list.
            "As needed" items can be quickly added with one tap from the grocery list view.
          </p>
        </div>
      </main>

      <MobileTabBar />

      {/* Add/Edit Modal */}
      {(showAddModal || editingStaple) && (
        <AddStapleModal
          staple={editingStaple}
          onSave={editingStaple
            ? (input) => handleUpdateStaple(editingStaple.id, input)
            : handleAddStaple
          }
          onClose={() => {
            setShowAddModal(false);
            setEditingStaple(null);
          }}
        />
      )}
    </div>
  );
}
