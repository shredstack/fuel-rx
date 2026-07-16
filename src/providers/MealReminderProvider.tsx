'use client';

/**
 * MealReminderProvider
 *
 * App-level orchestrator for meal reminders. It:
 *  - keeps the OS local-notification batch in sync with settings + resolution
 *    state (cancel-and-replace on every change, and at midnight / on resume),
 *  - runs the in-app ticker that opens the blocking alarm modal when a fire time
 *    is crossed while the app is foregrounded,
 *  - reconciles on launch (app may have been killed mid-nag),
 *  - opens the alarm modal when the user taps an OS notification,
 *  - renders the alarm modal and the snap-to-journal modal.
 *
 * It only does work for a signed-in user; otherwise it just renders children.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { trackEvent } from '@/lib/analytics';
import {
  useMealReminderSettings,
  useMealReminderStatus,
  useResolveMealReminder,
} from '@/hooks/queries/useMealReminders';
import { useMealReminderTicker } from '@/hooks/useMealReminderTicker';
import {
  getAlarmExpiry,
  getLocalDateString,
  isMealCurrentlyDue,
} from '@/lib/meal-reminders/fire-times';
import {
  syncSchedule,
  cancelMealReminders,
  addReminderTapListener,
} from '@/lib/meal-reminders/scheduler';
import { REMINDER_MEAL_TYPES, type ReminderMealType } from '@/lib/meal-reminders/types';

const MealReminderAlarmModal = dynamic(
  () => import('@/components/reminders/MealReminderAlarmModal'),
  { ssr: false }
);
const JournalPhotoModal = dynamic(() => import('@/components/reminders/JournalPhotoModal'), {
  ssr: false,
});

// While an alarm is open, poll status so the modal self-dismisses after the
// meal is logged on another device (realtime alone drops out in idle tabs).
const ALARM_STATUS_POLL_MS = 20_000;

function MealReminderController() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const resolveReminder = useResolveMealReminder();

  const [today, setToday] = useState(() => getLocalDateString());
  const [activeAlarm, setActiveAlarm] = useState<ReminderMealType | null>(null);
  const [snapForMeal, setSnapForMeal] = useState<ReminderMealType | null>(null);

  const { data: settings } = useMealReminderSettings();
  const { data: status } = useMealReminderStatus(today, true, {
    refetchIntervalMs: activeAlarm ? ALARM_STATUS_POLL_MS : undefined,
  });

  // Reconcile (launch-time modal reopen) runs once per local date.
  const reconciledForDateRef = useRef<string | null>(null);

  const openAlarm = useCallback((mealType: ReminderMealType, wasForeground: boolean) => {
    setActiveAlarm((current) => {
      if (current) return current; // one modal at a time
      trackEvent('meal_reminder_fired', {
        meal_type: mealType,
        was_foreground: wasForeground,
      });
      return mealType;
    });
  }, []);

  // --- In-app ticker: open the modal the moment a fire time is crossed. ---
  useMealReminderTicker({
    settings,
    status,
    dateStr: today,
    onFire: (mealType) => openAlarm(mealType, true),
    paused: activeAlarm !== null,
  });

  // --- Reconcile on launch: app may have been killed mid-nag. ---
  useEffect(() => {
    if (!settings || !status) return;
    if (reconciledForDateRef.current === today) return;
    reconciledForDateRef.current = today;
    if (activeAlarm) return;

    for (const mealType of REMINDER_MEAL_TYPES) {
      if (!settings[mealType].enabled) continue;
      if (status[mealType] !== 'pending') continue;
      if (isMealCurrentlyDue(settings[mealType], today)) {
        openAlarm(mealType, true);
        break;
      }
    }
  }, [settings, status, today, activeAlarm, openAlarm]);

  // --- Close the alarm if its meal becomes resolved (e.g. logged elsewhere). ---
  useEffect(() => {
    if (activeAlarm && status && status[activeAlarm] === 'resolved') {
      setActiveAlarm(null);
      setSnapForMeal(null);
    }
  }, [activeAlarm, status]);

  // --- Keep the OS notification batch in sync with settings + resolutions. ---
  useEffect(() => {
    if (settings && status) {
      void syncSchedule(settings, status, today);
    }
  }, [settings, status, today]);

  // --- Open the modal when the user taps an OS notification. ---
  useEffect(() => {
    let cleanup = () => {};
    void addReminderTapListener((mealType, date) => {
      // Ignore stale notifications (e.g. yesterday's tapped from Notification
      // Center this morning) — they'd open an alarm for the wrong day.
      if (date !== getLocalDateString()) return;
      openAlarm(mealType, false);
    }).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup();
  }, [openAlarm]);

  // --- Roll the date over at local midnight. ---
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5
      );
      timeoutId = setTimeout(() => {
        setToday(getLocalDateString());
        scheduleNext();
      }, nextMidnight.getTime() - now.getTime());
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  // --- On app resume: refresh date + reminder data (catches timezone shifts). ---
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup = () => {};
    import('@capacitor/app')
      .then(({ App }) => {
        const listener = App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) return;
          setToday(getLocalDateString());
          queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
        });
        cleanup = () => {
          void listener.then((l) => l.remove());
        };
      })
      .catch(() => {});
    return () => cleanup();
  }, [queryClient]);

  // --- Modal actions. ---
  const handleLogMeal = useCallback(() => {
    const mealType = activeAlarm;
    setActiveAlarm(null);
    router.push(`/log-meal${mealType ? `?reminder=${mealType}` : ''}`);
  }, [activeAlarm, router]);

  const handleSnapPhoto = useCallback(() => {
    if (activeAlarm) setSnapForMeal(activeAlarm);
  }, [activeAlarm]);

  const handleSkipToday = useCallback(async () => {
    const mealType = activeAlarm;
    if (!mealType) return;
    setActiveAlarm(null);
    trackEvent('meal_reminder_skipped_today', { meal_type: mealType });
    try {
      await resolveReminder.mutateAsync({
        mealType,
        date: today,
        source: 'manual_dismiss',
      });
      await cancelMealReminders(mealType);
    } catch (error) {
      console.error('[MealReminderProvider] skip failed:', error);
    }
  }, [activeAlarm, today, resolveReminder]);

  // The alarm gave up for the day (past the meal's final fire time). Close it
  // without resolving — the meal stays pending, but the nagging stops.
  const handleAlarmExpired = useCallback(() => {
    setActiveAlarm((current) => {
      if (current) {
        trackEvent('meal_reminder_expired', { meal_type: current });
      }
      return null;
    });
  }, []);

  const handleJournaled = useCallback(() => {
    setSnapForMeal(null);
    setActiveAlarm(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
  }, [queryClient]);

  return (
    <>
      {activeAlarm && !snapForMeal && settings && (
        <MealReminderAlarmModal
          mealType={activeAlarm}
          soundEnabled={settings[activeAlarm].sound_enabled}
          hapticsEnabled={settings[activeAlarm].haptics_enabled}
          expiresAt={getAlarmExpiry(settings[activeAlarm], today)}
          onLogMeal={handleLogMeal}
          onSnapPhoto={handleSnapPhoto}
          onSkipToday={handleSkipToday}
          onExpire={handleAlarmExpired}
        />
      )}
      {snapForMeal && (
        <JournalPhotoModal
          isOpen
          onClose={() => setSnapForMeal(null)}
          mealType={snapForMeal}
          lockMealType
          source="reminder_dismiss"
          reminderDate={today}
          onJournaled={handleJournaled}
        />
      )}
    </>
  );
}

export function MealReminderProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      {children}
      {userId && <MealReminderController key={userId} />}
    </>
  );
}
