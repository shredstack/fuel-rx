/**
 * Consumption Entry API Endpoint
 *
 * DELETE /api/consumption/[id] - Remove a consumption entry
 * PATCH /api/consumption/[id] - Update a consumption entry (e.g., meal type)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { removeConsumptionEntry, updateConsumptionEntryMealType } from '@/lib/consumption-service';
import type { MealType } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await removeConsumptionEntry(id, user.id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error removing consumption entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { meal_type } = body;

    if (!meal_type) {
      return NextResponse.json({ error: 'meal_type is required' }, { status: 400 });
    }

    // Validate meal_type
    const validMealTypes: MealType[] = ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'];
    if (!validMealTypes.includes(meal_type)) {
      return NextResponse.json({ error: 'Invalid meal_type' }, { status: 400 });
    }

    const entry = await updateConsumptionEntryMealType(id, user.id, meal_type);

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error updating consumption entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
