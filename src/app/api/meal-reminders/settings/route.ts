/**
 * Meal Reminder Settings API
 *
 * GET  - returns the user's reminder settings (allowed for everyone, so the
 *        settings UI can render an upsell for non-subscribers).
 * PUT  - saves reminder settings (paid feature — 402 if no access).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkReminderAccess,
  createReminderAccessDeniedResponse,
} from '@/lib/subscription/check-reminder-access';
import { mergeWithDefaults, validateSettings } from '@/lib/meal-reminders/settings';
import { trackEvent } from '@/lib/analytics';
import { REMINDER_MEAL_TYPES } from '@/lib/meal-reminders/types';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('meal_reminder_settings')
    .eq('id', user.id)
    .single();

  // mergeWithDefaults never throws — a missing/malformed blob falls back cleanly.
  return NextResponse.json({
    settings: mergeWithDefaults(profile?.meal_reminder_settings),
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Paid feature — settings cannot be enabled without access.
  const access = await checkReminderAccess(user.id);
  if (!access.allowed) {
    return createReminderAccessDeniedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Accept either the raw settings object or a { settings } envelope.
  const raw =
    body && typeof body === 'object' && 'settings' in body
      ? (body as { settings: unknown }).settings
      : body;

  const settings = mergeWithDefaults(raw);
  const validationError = validateSettings(settings);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ meal_reminder_settings: settings })
    .eq('id', user.id);

  if (updateError) {
    console.error('[meal-reminders/settings] update failed:', updateError);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  const enabledMeals = REMINDER_MEAL_TYPES.filter((m) => settings[m].enabled);
  trackEvent('meal_reminder_settings_changed', {
    enabled_count: enabledMeals.length,
    enabled_meals: enabledMeals.join(',') || 'none',
  });

  return NextResponse.json({ settings });
}
