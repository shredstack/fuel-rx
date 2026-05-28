/**
 * Lightweight analytics event tracking.
 *
 * FuelRx has no analytics vendor wired up yet, so this is a thin, typed shim:
 * call sites stay clean and a real provider (PostHog, Amplitude, etc.) can be
 * dropped into `dispatch()` later without touching feature code.
 *
 * Safe to call from both client and server; failures never throw.
 */

export type AnalyticsEvent =
  | 'meal_reminder_settings_changed'
  | 'meal_reminder_fired'
  | 'meal_reminder_resolved'
  | 'meal_reminder_skipped_today'
  | 'meal_reminder_test_fired'
  | 'food_journal_entry_created'
  | 'food_journal_entry_promoted';

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

function dispatch(event: AnalyticsEvent, props?: AnalyticsProps): void {
  // No-op shim for now. Wire a real provider here when one is adopted.
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', event, props ?? {});
  }
}

/** Track an analytics event. Never throws. */
export function trackEvent(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    dispatch(event, props);
  } catch {
    // Analytics must never break a user flow.
  }
}
