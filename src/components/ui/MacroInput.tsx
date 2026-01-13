'use client';

import { useState, useRef, useEffect, InputHTMLAttributes } from 'react';

type MacroType = 'calories' | 'protein' | 'carbs' | 'fat' | 'amount';

interface MacroInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'size'> {
  /** The macro type - affects label, validation, and styling */
  macroType: MacroType;
  /** Current value */
  value: number;
  /** Callback when value changes (only called with valid values) */
  onChange: (value: number) => void;
  /** Whether to allow decimal values (default: false for calories, true for macros) */
  allowDecimals?: boolean;
  /** Minimum allowed value (default: 0) */
  min?: number;
  /** Maximum allowed value (optional) */
  max?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the label */
  showLabel?: boolean;
  /** Custom label text (overrides default) */
  label?: string;
  /** Whether the input is in an error state */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
}

const MACRO_CONFIG: Record<MacroType, { label: string; shortLabel: string; unit: string; color: string; allowDecimals: boolean }> = {
  calories: { label: 'Calories', shortLabel: 'Cal', unit: '', color: 'text-orange-600', allowDecimals: false },
  protein: { label: 'Protein', shortLabel: 'P', unit: 'g', color: 'text-red-600', allowDecimals: true },
  carbs: { label: 'Carbs', shortLabel: 'C', unit: 'g', color: 'text-blue-600', allowDecimals: true },
  fat: { label: 'Fat', shortLabel: 'F', unit: 'g', color: 'text-yellow-600', allowDecimals: true },
  amount: { label: 'Amount', shortLabel: 'Amt', unit: '', color: 'text-gray-600', allowDecimals: true },
};

export default function MacroInput({
  macroType,
  value,
  onChange,
  allowDecimals,
  min = 0,
  max,
  size = 'md',
  showLabel = true,
  label,
  error = false,
  errorMessage,
  disabled = false,
  className = '',
  ...props
}: MacroInputProps) {
  const config = MACRO_CONFIG[macroType];
  const inputRef = useRef<HTMLInputElement>(null);

  // Use string for display to handle typing states
  const [displayValue, setDisplayValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Determine if decimals are allowed
  const decimalsAllowed = allowDecimals ?? config.allowDecimals;

  // Sync external value changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value.toString());
    }
  }, [value, isFocused]);

  const validateValue = (val: string): { valid: boolean; error: string | null; numericValue: number } => {
    // Allow empty string while typing
    if (val === '' || val === '-') {
      return { valid: false, error: null, numericValue: 0 };
    }

    const numericValue = decimalsAllowed ? parseFloat(val) : parseInt(val, 10);

    if (isNaN(numericValue)) {
      return { valid: false, error: 'Enter a valid number', numericValue: 0 };
    }

    if (numericValue < min) {
      return { valid: false, error: `Must be at least ${min}`, numericValue };
    }

    if (max !== undefined && numericValue > max) {
      return { valid: false, error: `Must be at most ${max}`, numericValue };
    }

    return { valid: true, error: null, numericValue };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Allow typing decimal point or digits (no negative for macro inputs)
    const validPattern = decimalsAllowed ? /^\d*\.?\d*$/ : /^\d*$/;
    if (!validPattern.test(newValue) && newValue !== '') {
      return; // Don't update if invalid characters
    }

    setDisplayValue(newValue);

    const { valid, error, numericValue } = validateValue(newValue);
    setLocalError(error);

    if (valid) {
      onChange(numericValue);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Select all text on focus for easy replacement
    e.target.select();
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);

    // On blur, validate and reset to last valid value if invalid
    const { valid, numericValue } = validateValue(displayValue);
    if (valid) {
      // Format the display value nicely
      setDisplayValue(decimalsAllowed ? numericValue.toString() : Math.round(numericValue).toString());
      onChange(numericValue);
    } else {
      // Reset to the prop value
      setDisplayValue(value.toString());
    }
    setLocalError(null);
    props.onBlur?.(e);
  };

  // Size classes - ensuring minimum 44px height for touch targets
  const sizeClasses = {
    sm: 'h-11 text-sm px-3',
    md: 'h-12 text-base px-3',
    lg: 'h-14 text-lg px-4',
  };

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const displayLabel = label ?? config.shortLabel;
  const showError = error || localError;
  const errorText = errorMessage ?? localError;

  return (
    <div className={`flex flex-col ${className}`}>
      {showLabel && (
        <label
          className={`font-medium mb-1 ${labelSizeClasses[size]} ${config.color}`}
          onClick={() => inputRef.current?.focus()}
        >
          {displayLabel}
          {config.unit && <span className="text-gray-400 ml-0.5">{config.unit}</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={`
            w-full rounded-lg border-2 font-medium
            transition-all duration-150 ease-in-out
            ${sizeClasses[size]}
            ${isFocused
              ? 'border-primary-500 ring-2 ring-primary-200 bg-white'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }
            ${showError ? 'border-red-500 ring-2 ring-red-200' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-text'}
            focus:outline-none
            text-gray-900
            [appearance:textfield]
            [&::-webkit-outer-spin-button]:appearance-none
            [&::-webkit-inner-spin-button]:appearance-none
          `}
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? `${macroType}-error` : undefined}
          {...props}
        />
        {!showLabel && config.unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {config.unit}
          </span>
        )}
      </div>
      {showError && errorText && (
        <p
          id={`${macroType}-error`}
          className="text-red-600 text-xs mt-1"
          role="alert"
        >
          {errorText}
        </p>
      )}
    </div>
  );
}
