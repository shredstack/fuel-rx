'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { SuggestedQuestions } from './SuggestedQuestions';
import { ChatInput } from './ChatInput';
import PaywallModal from '@/components/PaywallModal';
import { useSubscription } from '@/hooks/useSubscription';
import type { CookingChatMessage } from '@/lib/types';

interface CookingAssistantFullScreenProps {
  mealId: string;
  mealName: string;
  onClose: () => void;
  batchContext?: {
    totalServings: number;
    days: string[];
  };
}

/**
 * Full-screen cooking assistant view optimized for native iOS.
 * Uses flex layout instead of fixed positioning with keyboard height calculations,
 * which ensures the input is always visible when the keyboard is open.
 */
export function CookingAssistantFullScreen({
  mealId,
  mealName,
  onClose,
  batchContext,
}: CookingAssistantFullScreenProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CookingChatMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { refresh: refreshSubscription } = useSubscription();

  // Initialize session on mount
  const initializeSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/cooking-assistant/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId }),
      });

      if (response.status === 402) {
        setShowPaywall(true);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to initialize session');
      }
      setSessionId(data.sessionId);
      setMessages(data.messages || []);
      setSuggestedQuestions(data.suggestedQuestions || []);
    } catch (err) {
      console.error('Error initializing session:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to connect: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [mealId]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!sessionId || !content.trim()) return;

    // Optimistically add user message
    const userMessage: CookingChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cooking-assistant/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: content.trim(),
          batchContext,
        }),
      });

      if (response.status === 402) {
        setShowPaywall(true);
        // Remove the optimistically added message
        setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Add assistant reply
      const assistantMessage: CookingChatMessage = {
        id: `assistant-${Date.now()}`,
        session_id: sessionId,
        role: 'assistant',
        content: data.reply,
        created_at: data.created_at,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please check your connection and try again.');
      // Remove the optimistically added message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      onClose();
      return;
    }

    try {
      await fetch('/api/cooking-assistant/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (err) {
      console.error('Error ending session:', err);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleEndSession}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700"
            aria-label="Close cooking assistant"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">Cooking Assistant</h2>
            <p className="text-sm text-gray-500 truncate">Helping with: {mealName}</p>
          </div>
        </div>
      </div>

      {/* Messages area - flex-1 makes it grow and overflow-y-auto handles scrolling */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 py-8">
            <p className="font-medium mb-2">Need help with this meal?</p>
            <p className="text-sm">
              Ask me about techniques, timing, substitutions, or any cooking questions!
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage key={msg.id || idx} message={msg} />
        ))}

        {isLoading && messages.length > 0 && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:100ms]" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:200ms]" />
            </div>
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length === 0 && suggestedQuestions.length > 0 && !isLoading && (
        <div className="shrink-0 px-4 pb-2 bg-gray-50">
          <SuggestedQuestions
            questions={suggestedQuestions}
            onSelect={sendMessage}
          />
        </div>
      )}

      {/* Input - shrink-0 ensures it never shrinks, stays at bottom */}
      <div className="shrink-0 border-t border-gray-200 bg-white">
        <ChatInput
          onSend={sendMessage}
          disabled={isLoading || showPaywall}
          placeholder="Ask about this meal..."
        />
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          refreshSubscription();
        }}
      />
    </div>
  );
}
