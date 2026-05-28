/**
 * Food Journal API
 *
 * GET  /api/food-journal?from=YYYY-MM-DD&to=YYYY-MM-DD
 *      Returns journal entries (with freshly signed photo URLs) for the range.
 *      Defaults to today when no range is given.
 *
 * POST /api/food-journal
 *      Body: { meal_photo_id, meal_type?, note?, source, reminder_date? }
 *      Creates a journal entry. Journaling is free (no paywall) — it only needs
 *      a photo that already passed food validation at upload time.
 *      When source = 'reminder_dismiss', also records the reminder resolution.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { paginateQuery } from '@/lib/supabase/pagination';
import { upsertResolution, isReminderMealType } from '@/lib/meal-reminders/resolution-service';
import { trackEvent } from '@/lib/analytics';
import type { FoodJournalEntry, FoodJournalSource } from '@/lib/meal-reminders/types';

const BUCKET_NAME = 'meal-photos';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SIGNED_URL_TTL = 3600; // 1 hour

function todayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

type JournalRow = FoodJournalEntry & {
  meal_photos: { storage_path: string } | null;
};

/** Attach freshly signed photo URLs to a batch of journal rows. */
async function withSignedUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: JournalRow[]
): Promise<FoodJournalEntry[]> {
  const paths = rows
    .map((r) => r.meal_photos?.storage_path)
    .filter((p): p is string => !!p);

  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
    }
  }

  return rows.map((row) => {
    const { meal_photos, ...entry } = row;
    return {
      ...entry,
      photo_url: meal_photos?.storage_path
        ? urlByPath.get(meal_photos.storage_path) ?? null
        : null,
    };
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') ?? todayUtc();
  const to = searchParams.get('to') ?? from;

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: 'from and to must be YYYY-MM-DD dates' },
      { status: 400 }
    );
  }

  try {
    const rows = await paginateQuery<JournalRow>(async (offset, pageSize) => {
      const { data, error } = await supabase
        .from('food_journal_entries')
        .select('*, meal_photos!inner(storage_path)')
        .eq('user_id', user.id)
        .gte('journaled_at', `${from}T00:00:00`)
        .lte('journaled_at', `${to}T23:59:59.999`)
        .order('journaled_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(error.message);
      return (data as JournalRow[]) || [];
    });

    const entries = await withSignedUrls(supabase, rows);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('[food-journal] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load journal' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    meal_photo_id?: string;
    meal_type?: string;
    note?: string;
    source?: string;
    reminder_date?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.meal_photo_id) {
    return NextResponse.json({ error: 'meal_photo_id is required' }, { status: 400 });
  }
  const source: FoodJournalSource =
    body.source === 'reminder_dismiss' ? 'reminder_dismiss' : 'manual';

  if (body.meal_type !== undefined && body.meal_type !== null && !isReminderMealType(body.meal_type)) {
    return NextResponse.json(
      { error: 'meal_type must be one of breakfast, lunch, dinner, snack' },
      { status: 400 }
    );
  }
  if (source === 'reminder_dismiss') {
    if (!isReminderMealType(body.meal_type)) {
      return NextResponse.json(
        { error: 'reminder_dismiss entries require a meal_type' },
        { status: 400 }
      );
    }
    if (!body.reminder_date || !DATE_RE.test(body.reminder_date)) {
      return NextResponse.json(
        { error: 'reminder_dismiss entries require a reminder_date (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
  }

  // Verify the photo belongs to the caller, and re-check food validation as a
  // defense-in-depth measure (the upload route already rejects non-food).
  const { data: photo, error: photoError } = await supabase
    .from('meal_photos')
    .select('id, validation_result')
    .eq('id', body.meal_photo_id)
    .eq('user_id', user.id)
    .single();

  if (photoError || !photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  const validation = photo.validation_result as
    | { isSafe?: boolean; isFood?: boolean }
    | null;
  if (validation && (validation.isSafe === false || validation.isFood === false)) {
    return NextResponse.json(
      { error: 'This photo did not pass food validation' },
      { status: 400 }
    );
  }

  // Insert the journal entry.
  const { data: entry, error: insertError } = await supabase
    .from('food_journal_entries')
    .insert({
      user_id: user.id,
      meal_photo_id: body.meal_photo_id,
      meal_type: isReminderMealType(body.meal_type) ? body.meal_type : null,
      note: body.note?.trim() || null,
      source,
    })
    .select('*, meal_photos!inner(storage_path)')
    .single();

  if (insertError || !entry) {
    console.error('[food-journal] insert failed:', insertError);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }

  // For reminder dismissals, also record the resolution. If that fails, roll
  // back the journal entry so the two stay consistent.
  if (source === 'reminder_dismiss' && isReminderMealType(body.meal_type) && body.reminder_date) {
    try {
      await upsertResolution(supabase, {
        userId: user.id,
        reminderDate: body.reminder_date,
        mealType: body.meal_type,
        source: 'photo_snapped',
        foodJournalEntryId: entry.id,
      });
    } catch (error) {
      console.error('[food-journal] resolution write failed, rolling back entry:', error);
      await supabase.from('food_journal_entries').delete().eq('id', entry.id);
      return NextResponse.json(
        { error: 'Failed to record reminder resolution' },
        { status: 500 }
      );
    }
  }

  trackEvent('food_journal_entry_created', { source });

  const [withUrl] = await withSignedUrls(supabase, [entry as JournalRow]);
  return NextResponse.json({ entry: withUrl }, { status: 201 });
}
