'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function ChatInput({ onSend, disabled, placeholder, compact }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  // Scroll input into view when focused (helps with iOS keyboard)
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    // Small delay to allow keyboard to open
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  // Handle visualViewport resize (keyboard open/close on iOS)
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // When keyboard opens, scroll input into view
      if (document.activeElement === textareaRef.current) {
        setTimeout(() => {
          textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className={`${compact ? 'p-3' : 'p-4 border-t'} bg-white shrink-0`}
      style={compact ? undefined : { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={handleFocus}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={placeholder || "Type your question..."}
          disabled={disabled}
          rows={1}
          className={`flex-1 resize-none rounded-2xl border border-gray-300 ${
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-[15px]'
          } focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed`}
          style={{
            minHeight: compact ? '36px' : '44px',
            maxHeight: compact ? '80px' : '128px',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className={`shrink-0 ${
            compact ? 'w-9 h-9' : 'w-11 h-11'
          } bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed`}
          aria-label="Send message"
        >
          <svg
            className={compact ? 'w-4 h-4' : 'w-5 h-5'}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </form>
  );
}
