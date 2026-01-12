import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/consumption/repeat-day
 *
 * Copies all consumption entries from one day to another.
 * Useful for "Log same as yesterday" feature.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sourceDate, targetDate } = body;

    if (!sourceDate || !targetDate) {
      return NextResponse.json(
        { error: 'Missing sourceDate or targetDate' },
        { status: 400 }
      );
    }

    // Get all entries from the source date
    const { data: sourceEntries, error: fetchError } = await supabase
      .from('meal_consumption_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('consumed_date', sourceDate);

    if (fetchError) {
      console.error('Error fetching source entries:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch source entries' },
        { status: 500 }
      );
    }

    if (!sourceEntries || sourceEntries.length === 0) {
      return NextResponse.json(
        { message: 'No entries to copy', copied: 0 },
        { status: 200 }
      );
    }

    // Prepare entries for the target date
    const newEntries = sourceEntries.map((entry) => ({
      user_id: user.id,
      entry_type: entry.entry_type,
      meal_plan_meal_id: entry.meal_plan_meal_id,
      meal_id: entry.meal_id,
      ingredient_name: entry.ingredient_name,
      display_name: entry.display_name,
      meal_type: entry.meal_type,
      amount: entry.amount,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      consumed_date: targetDate,
      consumed_at: new Date().toISOString(),
      notes: entry.notes,
    }));

    // Insert all new entries
    const { data: inserted, error: insertError } = await supabase
      .from('meal_consumption_log')
      .insert(newEntries)
      .select();

    if (insertError) {
      console.error('Error inserting entries:', insertError);
      return NextResponse.json(
        { error: 'Failed to copy entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Copied ${inserted?.length || 0} entries`,
      copied: inserted?.length || 0,
      entries: inserted,
    });
  } catch (error) {
    console.error('Error in repeat-day:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
