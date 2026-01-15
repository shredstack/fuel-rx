'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { SuggestedQuestions } from './SuggestedQuestions';
import { ChatInput } from './ChatInput';
import type { CookingChatMessage } from '@/lib/types';

interface CookingAssistantDrawerProps {
  mealId: string;
  mealName: string;
  onClose: () => void;
  batchContext?: {
    totalServings: number;
    days: string[];
  };
}

export function CookingAssistantDrawer({
  mealId,
  mealName,
  onClose,
  batchContext,
}: CookingAssistantDrawerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CookingChatMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle iOS keyboard visibility
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // Calculate keyboard height by comparing viewport height to window height
      const keyboardH = window.innerHeight - viewport.height;
      setKeyboardHeight(keyboardH > 0 ? keyboardH : 0);
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Initialize session on mount
  const initializeSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/cooking-assistant/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId }),
      });

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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={(e) => {
          e.stopPropagation();
          handleEndSession();
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-x-0 bg-white rounded-t-3xl shadow-2xl z-50 flex flex-col md:right-0 md:left-auto md:w-[420px] md:h-screen md:rounded-none md:inset-y-0 md:bottom-0"
        style={{
          bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
          maxHeight: keyboardHeight > 0 ? `calc(100vh - ${keyboardHeight}px)` : '85vh',
          transition: 'bottom 0.1s ease-out, max-height 0.1s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span>Cooking Assistant</span>
            </h3>
            <p className="text-sm text-gray-600 truncate">
              Helping with: {mealName}
            </p>
          </div>
          <button
            onClick={handleEndSession}
            className="text-gray-400 hover:text-gray-600 ml-2 p-2"
            aria-label="Close cooking assistant"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-gray-500 py-8">
              <p className="font-medium mb-2">Need help with this meal?</p>
              <p className="text-sm">
                Ask me about techniques, timing, substitutions, or any cooking
                questions!
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
          <SuggestedQuestions
            questions={suggestedQuestions}
            onSelect={sendMessage}
          />
        )}

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </>
  );
}
