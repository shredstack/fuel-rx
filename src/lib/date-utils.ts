/**
 * Shared date helpers for consumption logging.
 *
 * The app's "day" is always the user's LOCAL calendar day. Never derive a
 * consumed_date from a UTC string (e.g. `new Date().toISOString().split('T')[0]`)
 * — after ~5-6pm US time the UTC date has already rolled over to tomorrow.
 */

/** A date's local calendar day as "YYYY-MM-DD". Defaults to today. */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds a true UTC instant (ISO string with Z) for a consumption entry logged
 * against a specific local calendar day.
 *
 * Uses the current wall-clock time placed on `dateStr` in the device's local
 * timezone, so the instant's local day always equals `dateStr`. This is what
 * should be stored in `consumed_at` (a timestamptz column) — never a
 * timezone-less string like `2026-07-27T21:30:00`, which Postgres would
 * interpret as UTC and silently shift the stored instant.
 */
export function consumedAtInstantForDate(dateStr: string, now: Date = new Date()): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return now.toISOString();
  const local = new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  );
  return local.toISOString();
}
