'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TourStep } from '@/lib/types';

interface Props {
  step: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

/**
 * SpotlightTip shows a single tour step with positioning relative to target element.
 * Uses CSS transitions (no Framer Motion per codebase pattern).
 */
export default function SpotlightTip({
  step,
  currentStepIndex,
  totalSteps,
  onNext,
  onSkip,
  onComplete,
}: Props) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const target = document.querySelector(step.targetSelector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    setTargetRect(rect);

    const tipWidth = tipRef.current?.offsetWidth || 300;
    const tipHeight = tipRef.current?.offsetHeight || 150;
    const padding = 16;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - tipHeight - padding + window.scrollY;
        left = rect.left + rect.width / 2 - tipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + padding + window.scrollY;
        left = rect.left + rect.width / 2 - tipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tipHeight / 2 + window.scrollY;
        left = rect.left - tipWidth - padding;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tipHeight / 2 + window.scrollY;
        left = rect.right + padding;
        break;
    }

    // Keep within viewport
    const viewportWidth = window.innerWidth;

    if (left < padding) left = padding;
    if (left + tipWidth > viewportWidth - padding) left = viewportWidth - tipWidth - padding;
    if (top < padding) top = padding;

    setPosition({ top, left });
  }, [step]);

  // Find and position relative to target element
  useEffect(() => {
    const target = document.querySelector(step.targetSelector);
    if (!target) return;

    // Initial position update
    updatePosition();

    // Scroll target into view if needed
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Fade in after a short delay
    const fadeTimer = setTimeout(() => setIsVisible(true), 100);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearTimeout(fadeTimer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [step, updatePosition]);

  const isLastStep = currentStepIndex === totalSteps - 1;

  // Calculate spotlight position (fixed, relative to viewport)
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - 4,
        left: targetRect.left - 4,
        width: targetRect.width + 8,
        height: targetRect.height + 8,
      }
    : null;

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        {/* Semi-transparent overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-50" />

        {/* Spotlight cutout */}
        {spotlightStyle && (
          <div
            className="absolute bg-transparent rounded-lg ring-4 ring-primary-400 ring-opacity-50"
            style={spotlightStyle}
          />
        )}
      </div>

      {/* Tip card */}
      <div
        ref={tipRef}
        className={`absolute z-50 bg-white rounded-xl shadow-xl p-4 w-72 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ top: position.top, left: position.left }}
      >
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Content */}
        <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
        <p className="text-sm text-gray-600 mb-4">{step.description}</p>

        {/* Navigation */}
        <div className="flex justify-end gap-2">
          {isLastStep ? (
            <button onClick={onComplete} className="btn-primary text-sm py-1.5 px-4">
              Got it!
            </button>
          ) : (
            <button onClick={onNext} className="btn-primary text-sm py-1.5 px-4">
              Next
            </button>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= currentStepIndex ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
