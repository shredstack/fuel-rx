'use client'

import { useState } from 'react'
import { useCookingAssistant } from '@/hooks/useCookingAssistant'
import { ChatMessage } from '@/components/CookingAssistant/ChatMessage'
import { SuggestedQuestions } from '@/components/CookingAssistant/SuggestedQuestions'
import { ChatInput } from '@/components/CookingAssistant/ChatInput'
import PaywallModal from '@/components/PaywallModal'
import { useSubscription } from '@/hooks/useSubscription'

interface InlineCookingAssistantProps {
  mealId: string
  mealName: string
  isVisible: boolean
}

export function InlineCookingAssistant({
  mealId,
  mealName,
  isVisible,
}: InlineCookingAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { refresh: refreshSubscription } = useSubscription()

  const {
    messages,
    suggestedQuestions,
    isLoading,
    error,
    showPaywall,
    setShowPaywall,
    initializeSession,
    sendMessage,
    messagesEndRef,
  } = useCookingAssistant({
    mealId,
    autoInitialize: false, // Only initialize when user expands
  })

  const handleExpand = async () => {
    if (!isExpanded) {
      setIsExpanded(true)
      await initializeSession()
    } else {
      setIsExpanded(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      {/* Header - always visible */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-teal-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <h5 className="font-medium text-gray-900 text-sm">Cooking Assistant</h5>
            <p className="text-xs text-gray-500">Get help with this meal</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded chat */}
      {isExpanded && (
        <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200">
          {/* Messages area */}
          <div className="max-h-64 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">
                  Ask me anything about cooking &quot;{mealName}&quot;!
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <ChatMessage key={msg.id || idx} message={msg} compact />
            ))}

            {isLoading && messages.length > 0 && (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:100ms]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:200ms]" />
                </div>
                <span className="text-xs">Thinking...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions - only show when no messages */}
          {messages.length === 0 && suggestedQuestions.length > 0 && !isLoading && (
            <div className="px-4 pb-2">
              <SuggestedQuestions
                questions={suggestedQuestions.slice(0, 3)}
                onSelect={sendMessage}
                compact
              />
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200">
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading || showPaywall}
              placeholder="Ask a cooking question..."
              compact
            />
          </div>
        </div>
      )}

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => {
          setShowPaywall(false)
          refreshSubscription()
        }}
      />
    </div>
  )
}
