import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeMealPhoto } from '@/lib/claude/meal-photo-analysis';

interface RouteParams {
  params: Promise<{
    photoId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { photoId } = await params;

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get photo record and verify ownership
    const { data: photo, error: photoError } = await supabase
      .from('meal_photos')
      .select('*')
      .eq('id', photoId)
      .eq('user_id', user.id)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // If already analyzed, return existing results
    if (photo.analysis_status === 'completed' && photo.raw_analysis) {
      // Fetch ingredients
      const { data: ingredients } = await supabase
        .from('meal_photo_ingredients')
        .select('*')
        .eq('meal_photo_id', photoId)
        .order('display_order');

      return NextResponse.json({
        photoId: photo.id,
        imageUrl: photo.image_url,
        status: 'completed',
        analysis: photo.raw_analysis,
        mealName: photo.meal_name,
        totalCalories: photo.total_calories,
        totalProtein: photo.total_protein,
        totalCarbs: photo.total_carbs,
        totalFat: photo.total_fat,
        confidenceScore: photo.confidence_score,
        ingredients: ingredients || [],
      });
    }

    // Update status to analyzing
    await supabase.from('meal_photos').update({ analysis_status: 'analyzing' }).eq('id', photoId);

    // Download photo from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('meal-photos')
      .download(photo.storage_path);

    if (downloadError || !fileData) {
      await supabase
        .from('meal_photos')
        .update({ analysis_status: 'failed', analysis_error: 'Failed to download photo from storage' })
        .eq('id', photoId);
      return NextResponse.json({ error: 'Failed to download photo' }, { status: 500 });
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
    if (photo.storage_path.endsWith('.png')) {
      mediaType = 'image/png';
    } else if (photo.storage_path.endsWith('.webp')) {
      mediaType = 'image/webp';
    }

    // Run Claude Vision analysis
    let analysisResult;
    try {
      analysisResult = await analyzeMealPhoto(base64, mediaType, user.id);
    } catch (analysisError) {
      const errorMessage = analysisError instanceof Error ? analysisError.message : 'Analysis failed';
      await supabase
        .from('meal_photos')
        .update({ analysis_status: 'failed', analysis_error: errorMessage })
        .eq('id', photoId);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // Save analysis results to meal_photos
    const { error: updateError } = await supabase
      .from('meal_photos')
      .update({
        analysis_status: 'completed',
        analyzed_at: new Date().toISOString(),
        raw_analysis: analysisResult,
        meal_name: analysisResult.meal_name,
        meal_description: analysisResult.meal_description || null,
        total_calories: analysisResult.total_macros.calories,
        total_protein: analysisResult.total_macros.protein,
        total_carbs: analysisResult.total_macros.carbs,
        total_fat: analysisResult.total_macros.fat,
        confidence_score: analysisResult.overall_confidence,
      })
      .eq('id', photoId);

    if (updateError) {
      console.error('Error updating meal_photos:', updateError);
    }

    // Save ingredients
    const ingredientsToInsert = analysisResult.ingredients.map((ing, index) => ({
      meal_photo_id: photoId,
      name: ing.name,
      estimated_amount: ing.estimated_amount,
      estimated_unit: ing.estimated_unit,
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
      confidence_score: ing.confidence,
      category: ing.category || null,
      display_order: index,
    }));

    const { data: savedIngredients, error: ingredientsError } = await supabase
      .from('meal_photo_ingredients')
      .insert(ingredientsToInsert)
      .select();

    if (ingredientsError) {
      console.error('Error saving ingredients:', ingredientsError);
    }

    return NextResponse.json({
      photoId: photo.id,
      imageUrl: photo.image_url,
      status: 'completed',
      analysis: analysisResult,
      mealName: analysisResult.meal_name,
      mealDescription: analysisResult.meal_description,
      totalCalories: analysisResult.total_macros.calories,
      totalProtein: analysisResult.total_macros.protein,
      totalCarbs: analysisResult.total_macros.carbs,
      totalFat: analysisResult.total_macros.fat,
      confidenceScore: analysisResult.overall_confidence,
      analysisNotes: analysisResult.analysis_notes,
      ingredients: savedIngredients || ingredientsToInsert,
    });
  } catch (error) {
    console.error('Error analyzing meal photo:', error);

    // Update status to failed
    await supabase
      .from('meal_photos')
      .update({
        analysis_status: 'failed',
        analysis_error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', photoId);

    return NextResponse.json({ error: 'Failed to analyze photo' }, { status: 500 });
  }
}
