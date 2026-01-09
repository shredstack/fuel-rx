'use client'

interface Props {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  min?: number
  max?: number
}

export default function GuestCountInput({
  value,
  onChange,
  disabled,
  min = 2,
  max = 100,
}: Props) {
  const handleChange = (newValue: number) => {
    if (newValue < min) newValue = min
    if (newValue > max) newValue = max
    onChange(newValue)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => handleChange(value - 1)}
        disabled={disabled || value <= min}
        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      <div className="flex-1 relative">
        <input
          type="number"
          value={value}
          onChange={(e) => handleChange(parseInt(e.target.value) || min)}
          disabled={disabled}
          min={min}
          max={max}
          className="w-full text-center py-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed text-lg font-medium"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          guests
        </span>
      </div>

      <button
        type="button"
        onClick={() => handleChange(value + 1)}
        disabled={disabled || value >= max}
        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
