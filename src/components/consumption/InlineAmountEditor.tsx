'use client';

import { useState, useRef, useEffect } from 'react';
import type { ConsumptionEntry } from '@/lib/types';

interface InlineAmountEditorProps {
  entry: ConsumptionEntry;
  onSave: (newAmount: number, newMacros: { calories: number; protein: number; carbs: number; fat: number }, newGrams?: number) => void;
  onCancel: () => void;
}

export default function InlineAmountEditor({ entry, onSave, onCancel }: InlineAmountEditorProps) {
  const [amount, setAmount] = useState(entry.amount || 1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Calculate per-serving macros from the original entry
  const originalAmount = entry.amount || 1;
  const perServingMacros = {
    calories: entry.calories / originalAmount,
    protein: entry.protein / originalAmount,
    carbs: entry.carbs / originalAmount,
    fat: entry.fat / originalAmount,
  };

  // Calculate new macros based on new amount
  const newMacros = {
    calories: Math.round(perServingMacros.calories * amount),
    protein: Math.round(perServingMacros.protein * amount * 10) / 10,
    carbs: Math.round(perServingMacros.carbs * amount * 10) / 10,
    fat: Math.round(perServingMacros.fat * amount * 10) / 10,
  };

  // Calculate new grams proportionally if this is a fruit/veg entry
  const originalGrams = entry.grams || 0;
  const newGrams = originalGrams > 0 ? Math.round((originalGrams / originalAmount) * amount) : undefined;

  const handleSave = () => {
    if (amount <= 0) return;
    onSave(amount, newMacros, newGrams);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="number"
        value={amount}
        onChange={(e) => setAmount(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        step="0.5"
        min="0.1"
        className="w-16 text-center border border-primary-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <span className="text-xs text-gray-500">{entry.unit}</span>
      <span className="text-xs text-gray-400">({newMacros.calories} cal)</span>
    </div>
  );
}
