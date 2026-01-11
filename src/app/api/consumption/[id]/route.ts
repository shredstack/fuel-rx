/**
 * Consumption Entry API Endpoint
 *
 * DELETE /api/consumption/[id] - Remove a consumption entry
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { removeConsumptionEntry } from '@/lib/consumption-service';

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
