/**
 * Food Journal Entry API (single entry)
 *
 * GET    /api/food-journal/[id]  - fetch one entry with a signed photo URL
 * PATCH  /api/food-journal/[id]  - update note / meal_type / promotion link
 * DELETE /api/food-journal/[id]  - delete the entry
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isReminderMealType } from '@/lib/meal-reminders/resolution-service';
import type { FoodJournalEntry } from '@/lib/meal-reminders/types';

const BUCKET_NAME = 'meal-photos';
const SIGNED_URL_TTL = 3600;

interface RouteParams {
  params: Promise<{ id: string }>;
}

type JournalRow = FoodJournalEntry & {
  meal_photos: { storage_path: string } | null;
};

async function signEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: JournalRow
): Promise<FoodJournalEntry> {
  const { meal_photos, ...entry } = row;
  let photoUrl: string | null = null;
  if (meal_photos?.storage_path) {
    const { data } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(meal_photos.storage_path, SIGNED_URL_TTL);
    photoUrl = data?.signedUrl ?? null;
  }
  return { ...entry, photo_url: photoUrl };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: entry, error } = await supabase
    .from('food_journal_entries')
    .select('*, meal_photos!inner(storage_path)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  return NextResponse.json({ entry: await signEntry(supabase, entry as JournalRow) });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { note?: string | null; meal_type?: string | null; promoted_consumption_log_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if ('note' in body) {
    updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;
  }
  if ('meal_type' in body) {
    if (body.meal_type !== null && !isReminderMealType(body.meal_type)) {
      return NextResponse.json(
        { error: 'meal_type must be one of breakfast, lunch, dinner, snack' },
        { status: 400 }
      );
    }
    updates.meal_type = body.meal_type ?? null;
  }
  if ('promoted_consumption_log_id' in body) {
    updates.promoted_consumption_log_id = body.promoted_consumption_log_id ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: entry, error } = await supabase
    .from('food_journal_entries')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, meal_photos!inner(storage_path)')
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  return NextResponse.json({ entry: await signEntry(supabase, entry as JournalRow) });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('food_journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[food-journal] delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
