'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CookingChatMessage } from '@/lib/types'

interface UseCookingAssistantOptions {
  mealId: string
  autoInitialize?: boolean
  batchContext?: {
    totalServings: number
    days: string[]
  }
}

interface UseCookingAssistantReturn {
  sessionId: string | null
  messages: CookingChatMessage[]
  suggestedQuestions: string[]
  isLoading: boolean
  error: string | null
  showPaywall: boolean
  setShowPaywall: (show: boolean) => void
  initializeSession: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  endSession: () => Promise<void>
  messagesEndRef: React.RefObject<HTMLDivElement>
}

export function useCookingAssistant({
  mealId,
  autoInitialize = true,
  batchContext,
}: UseCookingAssistantOptions): UseCookingAssistantReturn {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<CookingChatMessage[]>([])
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initializingRef = useRef(false)

  // Initialize session
  const initializeSession = useCallback(async () => {
    // Prevent double initialization
    if (initializingRef.current || sessionId) return
    initializingRef.current = true

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/cooking-assistant/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId }),
      })

      if (response.status === 402) {
        setShowPaywall(true)
        return
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to initialize session')
      }

      setSessionId(data.sessionId)
      setMessages(data.messages || [])
      setSuggestedQuestions(data.suggestedQuestions || [])
    } catch (err) {
      console.error('Error initializing session:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to connect: ${errorMessage}`)
    } finally {
      setIsLoading(false)
      initializingRef.current = false
    }
  }, [mealId, sessionId])

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim()) return

      // Optimistically add user message
      const userMessage: CookingChatMessage = {
        id: `temp-${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/cooking-assistant/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: content.trim(),
            batchContext,
          }),
        })

        if (response.status === 402) {
          setShowPaywall(true)
          // Remove the optimistically added message
          setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id))
          return
        }

        if (!response.ok) {
          throw new Error('Failed to send message')
        }

        const data = await response.json()

        // Add assistant reply
        const assistantMessage: CookingChatMessage = {
          id: `assistant-${Date.now()}`,
          session_id: sessionId,
          role: 'assistant',
          content: data.reply,
          created_at: data.created_at,
        }

        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        console.error('Error sending message:', err)
        setError('Failed to send message. Please check your connection and try again.')
        // Remove the optimistically added message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id))
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, batchContext]
  )

  // End session
  const endSession = useCallback(async () => {
    if (!sessionId) return

    try {
      await fetch('/api/cooking-assistant/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    } catch (err) {
      console.error('Error ending session:', err)
    }

    setSessionId(null)
    setMessages([])
    setSuggestedQuestions([])
  }, [sessionId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-initialize if enabled
  useEffect(() => {
    if (autoInitialize && !sessionId && !initializingRef.current) {
      initializeSession()
    }
  }, [autoInitialize, sessionId, initializeSession])

  return {
    sessionId,
    messages,
    suggestedQuestions,
    isLoading,
    error,
    showPaywall,
    setShowPaywall,
    initializeSession,
    sendMessage,
    endSession,
    messagesEndRef,
  }
}
