'use client';

import type { GroceryStaple, GroceryCategory } from '@/lib/types';

interface Props {
  staple: GroceryStaple;
  onEdit: () => void;
  onDelete: () => void;
}

const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  grains: 'Grains',
  pantry: 'Pantry',
  frozen: 'Frozen',
  other: 'Other',
};

const CATEGORY_COLORS: Record<GroceryCategory, string> = {
  produce: 'bg-green-100 text-green-700',
  protein: 'bg-red-100 text-red-700',
  dairy: 'bg-blue-100 text-blue-700',
  grains: 'bg-amber-100 text-amber-700',
  pantry: 'bg-gray-100 text-gray-700',
  frozen: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function StapleCard({ staple, onEdit, onDelete }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 truncate">
          {staple.display_name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[staple.category]}`}>
            {CATEGORY_LABELS[staple.category]}
          </span>
          {staple.times_added > 0 && (
            <span className="text-xs text-gray-400">
              Added {staple.times_added} time{staple.times_added !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Edit staple"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
          aria-label="Delete staple"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
