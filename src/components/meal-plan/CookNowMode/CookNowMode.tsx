'use client'

import { useState, useEffect } from 'react'
import type { MealSlot, MealType } from '@/lib/types'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useCookingAssistant } from '@/hooks/useCookingAssistant'
import { ChatMessage } from '@/components/CookingAssistant/ChatMessage'
import { SuggestedQuestions } from '@/components/CookingAssistant/SuggestedQuestions'
import { ChatInput } from '@/components/CookingAssistant/ChatInput'
import PaywallModal from '@/components/PaywallModal'
import { useSubscription } from '@/hooks/useSubscription'
import { LogMealModal } from '../LogMealModal'
import { StepDisplay } from './StepDisplay'

interface CookNowModeProps {
  mealSlot: MealSlot
  mealPlanMealId: string
  onClose: () => void
  onLogSuccess?: () => void
}

export function CookNowMode({
  mealSlot,
  mealPlanMealId,
  onClose,
  onLogSuccess,
}: CookNowModeProps) {
  const meal = mealSlot.meal
  const [currentStep, setCurrentStep] = useState(0)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const { refresh: refreshSubscription } = useSubscription()

  // Wake lock to keep screen on
  const { isSupported: wakeLockSupported, isActive: wakeLockActive, request: requestWakeLock, release: releaseWakeLock } = useWakeLock()

  // Cooking assistant
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
    mealId: meal.id,
    autoInitialize: false,
  })

  // Request wake lock on mount
  useEffect(() => {
    if (wakeLockSupported) {
      requestWakeLock()
    }
    return () => {
      releaseWakeLock()
    }
  }, [wakeLockSupported, requestWakeLock, releaseWakeLock])

  // Handle assistant toggle
  const handleToggleAssistant = async () => {
    if (!showAssistant) {
      setShowAssistant(true)
      await initializeSession()
    } else {
      setShowAssistant(false)
    }
  }

  // Handle done cooking
  const handleDoneCooking = () => {
    setShowLogModal(true)
  }

  // Handle log success
  const handleLogSuccess = () => {
    setShowLogModal(false)
    onLogSuccess?.()
    onClose()
  }

  // Navigation handlers
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleNext = () => {
    if (currentStep < meal.instructions.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Last step - done cooking
      handleDoneCooking()
    }
  }

  const handleStepSelect = (step: number) => {
    setCurrentStep(step)
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700"
            aria-label="Close Cook Now mode"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h2 className="font-semibold text-gray-900">{meal.name}</h2>
            <p className="text-sm text-gray-500">{meal.prep_time_minutes} min</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Wake lock indicator */}
          {wakeLockSupported && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                wakeLockActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
              title={wakeLockActive ? 'Screen will stay on' : 'Screen may turn off'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {wakeLockActive ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                )}
              </svg>
              {wakeLockActive ? 'On' : 'Off'}
            </div>
          )}
          {/* Ask Assistant button */}
          <button
            onClick={handleToggleAssistant}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showAssistant
                ? 'bg-teal-100 text-teal-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            {showAssistant ? 'Hide Help' : 'Need Help?'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Step display */}
        <div className={`flex-1 flex flex-col ${showAssistant ? 'md:w-1/2' : ''}`}>
          <StepDisplay
            steps={meal.instructions}
            currentStep={currentStep}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onStepSelect={handleStepSelect}
          />
        </div>

        {/* Assistant panel (slides in) */}
        {showAssistant && (
          <div className="h-1/2 md:h-auto md:w-1/2 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col bg-gray-50">
            <div className="p-3 border-b bg-white">
              <h3 className="font-medium text-gray-900 text-sm">Cooking Assistant</h3>
              <p className="text-xs text-gray-500">Ask questions about this recipe</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 py-4">
                  <p className="text-sm">Need help? Just ask!</p>
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

            {/* Suggested questions */}
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
            <div className="border-t border-gray-200 bg-white">
              <ChatInput
                onSend={sendMessage}
                disabled={isLoading || showPaywall}
                placeholder="Ask about this step..."
                compact
              />
            </div>
          </div>
        )}
      </div>

      {/* Log meal modal */}
      <LogMealModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        mealSlot={mealSlot}
        mealPlanMealId={mealPlanMealId}
        defaultMealType={mealSlot.meal_type}
        onLogSuccess={handleLogSuccess}
      />

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
