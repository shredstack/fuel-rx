/**
 * Grocery Staples API
 *
 * GET    /api/grocery-staples           - List user's staples
 * POST   /api/grocery-staples           - Create a new staple
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { GroceryStapleInput, GroceryStaple } from '@/lib/types';

// GET - List all staples for the current user
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const frequency = searchParams.get('frequency'); // 'every_week' | 'as_needed' | null
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = supabase
      .from('user_grocery_staples')
      .select('*')
      .eq('user_id', user.id)
      .order('times_added', { ascending: false })
      .order('name', { ascending: true })
      .limit(limit);

    if (frequency) {
      query = query.eq('add_frequency', frequency);
    }

    if (search && search.length >= 2) {
      query = query.ilike('display_name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching staples:', error);
      return NextResponse.json({ error: 'Failed to fetch staples' }, { status: 500 });
    }

    return NextResponse.json({ staples: data as GroceryStaple[] });
  } catch (error) {
    console.error('Error in GET /api/grocery-staples:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new staple
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GroceryStapleInput = await request.json();

    // Validation
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const validCategories = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const validFrequencies = ['every_week', 'as_needed'];
    if (!validFrequencies.includes(body.add_frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_grocery_staples')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        brand: body.brand?.trim() || null,
        variant: body.variant?.trim() || null,
        category: body.category,
        add_frequency: body.add_frequency,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'This item already exists in your staples' }, { status: 409 });
      }
      console.error('Error creating staple:', error);
      return NextResponse.json({ error: 'Failed to create staple' }, { status: 500 });
    }

    return NextResponse.json({ staple: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/grocery-staples:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
