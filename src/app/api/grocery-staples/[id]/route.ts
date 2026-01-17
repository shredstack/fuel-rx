/**
 * Single Staple API
 *
 * GET    /api/grocery-staples/[id]      - Get a single staple
 * PUT    /api/grocery-staples/[id]      - Update a staple
 * DELETE /api/grocery-staples/[id]      - Delete a staple
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { GroceryStapleInput } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

// GET - Get a single staple
export async function GET(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_grocery_staples')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Staple not found' }, { status: 404 });
    }

    return NextResponse.json({ staple: data });
  } catch (error) {
    console.error('Error in GET /api/grocery-staples/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a staple
export async function PUT(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: Partial<GroceryStapleInput> = await request.json();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.brand !== undefined) {
      updates.brand = body.brand?.trim() || null;
    }

    if (body.variant !== undefined) {
      updates.variant = body.variant?.trim() || null;
    }

    if (body.category !== undefined) {
      const validCategories = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other'];
      if (!validCategories.includes(body.category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      updates.category = body.category;
    }

    if (body.add_frequency !== undefined) {
      const validFrequencies = ['every_week', 'as_needed'];
      if (!validFrequencies.includes(body.add_frequency)) {
        return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
      }
      updates.add_frequency = body.add_frequency;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_grocery_staples')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This item already exists in your staples' }, { status: 409 });
      }
      console.error('Error updating staple:', error);
      return NextResponse.json({ error: 'Failed to update staple' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Staple not found' }, { status: 404 });
    }

    return NextResponse.json({ staple: data });
  } catch (error) {
    console.error('Error in PUT /api/grocery-staples/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a staple
export async function DELETE(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('user_grocery_staples')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting staple:', error);
      return NextResponse.json({ error: 'Failed to delete staple' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/grocery-staples/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
