/**
 * Ingredient Search API
 *
 * GET /api/consumption/ingredients/search?q=chicken
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchIngredients } from '@/lib/consumption-service';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchIngredients(user.id, query);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching ingredients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
