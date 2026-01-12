import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/consumption/ingredients/pin
 *
 * Toggle pin status for a frequent ingredient.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ingredientName, isPinned } = body;

    if (!ingredientName || typeof isPinned !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing ingredientName or isPinned' },
        { status: 400 }
      );
    }

    const normalizedName = ingredientName.toLowerCase().trim();

    // Update the pin status
    const { data, error } = await supabase
      .from('user_frequent_ingredients')
      .update({ is_pinned: isPinned })
      .eq('user_id', user.id)
      .eq('ingredient_name_normalized', normalizedName)
      .select()
      .single();

    if (error) {
      // If ingredient doesn't exist, we can't pin it
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Ingredient not found in your frequent list' },
          { status: 404 }
        );
      }
      console.error('Error toggling pin:', error);
      return NextResponse.json(
        { error: 'Failed to toggle pin' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: isPinned ? 'Ingredient pinned' : 'Ingredient unpinned',
      ingredient: data,
    });
  } catch (error) {
    console.error('Error in pin endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
