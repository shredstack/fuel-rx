'use client';

interface SwapButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Small swap button displayed on meal cards.
 * Opens the swap modal when clicked.
 */
export function SwapButton({ onClick, className = '' }: SwapButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`p-2 rounded-full hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-600 ${className}`}
      title="Swap meal"
      aria-label="Swap meal"
    >
      {/* Arrows swap icon */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    </button>
  );
}
