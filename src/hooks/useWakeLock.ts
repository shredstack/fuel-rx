'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePlatform } from './usePlatform'

interface UseWakeLockReturn {
  isSupported: boolean
  isActive: boolean
  request: () => Promise<boolean>
  release: () => Promise<void>
}

export function useWakeLock(): UseWakeLockReturn {
  const { isNative } = usePlatform()
  const [isSupported, setIsSupported] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)

  // Check support on mount
  useEffect(() => {
    // Check for Screen Wake Lock API support
    const supported = 'wakeLock' in navigator
    setIsSupported(supported)
  }, [])

  // Handle visibility change - re-acquire lock when page becomes visible
  useEffect(() => {
    if (!wakeLock) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLock) {
        try {
          const newLock = await navigator.wakeLock.request('screen')
          setWakeLock(newLock)
          setIsActive(true)
        } catch (err) {
          console.error('Failed to re-acquire wake lock:', err)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [wakeLock])

  // Request wake lock
  const request = useCallback(async (): Promise<boolean> => {
    // For native apps, Capacitor has KeepAwake plugin but we'll use the web API
    // which works in WKWebView on iOS
    if (!isSupported) {
      console.warn('Wake Lock API not supported')
      return false
    }

    try {
      const lock = await navigator.wakeLock.request('screen')
      setWakeLock(lock)
      setIsActive(true)

      // Handle lock release
      lock.addEventListener('release', () => {
        setIsActive(false)
        setWakeLock(null)
      })

      return true
    } catch (err) {
      console.error('Failed to request wake lock:', err)
      return false
    }
  }, [isSupported])

  // Release wake lock
  const release = useCallback(async (): Promise<void> => {
    if (wakeLock) {
      try {
        await wakeLock.release()
        setWakeLock(null)
        setIsActive(false)
      } catch (err) {
        console.error('Failed to release wake lock:', err)
      }
    }
  }, [wakeLock])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(console.error)
      }
    }
  }, [wakeLock])

  return {
    isSupported,
    isActive,
    request,
    release,
  }
}
