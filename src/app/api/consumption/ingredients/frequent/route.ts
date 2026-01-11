/**
 * Frequent Ingredients API
 *
 * GET /api/consumption/ingredients/frequent
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFrequentIngredients } from '@/lib/consumption-service';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ingredients = await getFrequentIngredients(user.id);

    return NextResponse.json({ ingredients });
  } catch (error) {
    console.error('Error fetching frequent ingredients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
