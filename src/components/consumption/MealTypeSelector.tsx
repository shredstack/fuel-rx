'use client';

import type { MealType } from '@/lib/types';
import { MEAL_TYPE_LABELS } from '@/lib/types';

interface MealTypeSelectorProps {
  value: MealType | null;
  onChange: (type: MealType) => void;
  suggestedTypes?: MealType[];
  compact?: boolean;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealTypeSelector({
  value,
  onChange,
  suggestedTypes = [],
  compact = false,
}: MealTypeSelectorProps) {
  return (
    <div className={`flex ${compact ? 'gap-1' : 'gap-2'}`}>
      {MEAL_TYPES.map((type) => {
        const isSelected = value === type;
        const isSuggested = suggestedTypes.includes(type);

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`
              ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
              rounded-full font-medium transition-all
              ${
                isSelected
                  ? 'bg-primary-600 text-white'
                  : isSuggested
                    ? 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
          >
            {MEAL_TYPE_LABELS[type]}
            {isSuggested && !isSelected && (
              <span className="ml-1 text-primary-400">*</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
