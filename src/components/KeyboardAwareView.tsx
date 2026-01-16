'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlatform } from '@/hooks/usePlatform';

interface KeyboardAwareViewProps {
  children: ReactNode;
  className?: string;
}

/**
 * A wrapper component that handles iOS keyboard visibility.
 * - Adds padding at the bottom when the keyboard is visible on native iOS
 * - Scrolls focused inputs into view when the keyboard opens
 * - No effect on web to preserve the web experience
 */
export function KeyboardAwareView({ children, className = '' }: KeyboardAwareViewProps) {
  const { isKeyboardVisible, keyboardHeight } = useKeyboard();
  const { isNative } = usePlatform();
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll focused input into view when keyboard opens on native
  useEffect(() => {
    if (isKeyboardVisible && isNative) {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [isKeyboardVisible, isNative]);

  // Also handle visualViewport resize as a fallback for PWA/Safari
  useEffect(() => {
    if (!isNative) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, [isNative]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={isNative && isKeyboardVisible ? { paddingBottom: keyboardHeight } : undefined}
    >
      {children}
    </div>
  );
}
