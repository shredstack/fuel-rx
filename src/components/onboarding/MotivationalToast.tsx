'use client';

import { useEffect, useState } from 'react';

interface Props {
  title: string;
  message: string;
  emoji: string;
  onDismiss: () => void;
  autoHideDuration?: number;
}

/**
 * MotivationalToast shows milestone achievements with auto-dismiss.
 * Uses CSS transitions (no Framer Motion per codebase pattern).
 */
export default function MotivationalToast({
  title,
  message,
  emoji,
  onDismiss,
  autoHideDuration = 5000,
}: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-hide
    const hideTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300);
    }, autoHideDuration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(hideTimer);
    };
  }, [autoHideDuration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-sm transition-all duration-300 transform ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">{emoji}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900">{title}</h4>
            <p className="text-sm text-gray-600 mt-0.5">{message}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-1"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
