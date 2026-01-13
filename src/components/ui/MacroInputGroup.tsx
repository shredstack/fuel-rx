'use client';

import MacroInput from './MacroInput';

interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MacroInputGroupProps {
  /** Current macro values */
  values: Macros;
  /** Callback when any macro changes */
  onChange: (macros: Macros) => void;
  /** Layout orientation */
  layout?: 'horizontal' | 'vertical' | 'grid';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether inputs are disabled */
  disabled?: boolean;
  /** Show full labels or short labels */
  showFullLabels?: boolean;
  /** Additional className */
  className?: string;
  /** Whether calories should be disabled/read-only (for auto-calculated scenarios) */
  caloriesDisabled?: boolean;
}

export default function MacroInputGroup({
  values,
  onChange,
  layout = 'grid',
  size = 'md',
  disabled = false,
  showFullLabels = false,
  className = '',
  caloriesDisabled = false,
}: MacroInputGroupProps) {
  const handleChange = (macro: keyof Macros) => (value: number) => {
    onChange({ ...values, [macro]: value });
  };

  const layoutClasses = {
    horizontal: 'flex flex-row gap-2 items-end',
    vertical: 'flex flex-col gap-3',
    grid: 'grid grid-cols-2 sm:grid-cols-4 gap-3',
  };

  return (
    <div className={`${layoutClasses[layout]} ${className}`}>
      <MacroInput
        macroType="calories"
        value={values.calories}
        onChange={handleChange('calories')}
        size={size}
        disabled={disabled || caloriesDisabled}
        label={showFullLabels ? 'Calories' : undefined}
      />
      <MacroInput
        macroType="protein"
        value={values.protein}
        onChange={handleChange('protein')}
        size={size}
        disabled={disabled}
        label={showFullLabels ? 'Protein (g)' : undefined}
      />
      <MacroInput
        macroType="carbs"
        value={values.carbs}
        onChange={handleChange('carbs')}
        size={size}
        disabled={disabled}
        label={showFullLabels ? 'Carbs (g)' : undefined}
      />
      <MacroInput
        macroType="fat"
        value={values.fat}
        onChange={handleChange('fat')}
        size={size}
        disabled={disabled}
        label={showFullLabels ? 'Fat (g)' : undefined}
      />
    </div>
  );
}
