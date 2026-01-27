import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateFoodImage } from '@/lib/claude/food-validation';

const BUCKET_NAME = 'meal-photos';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max (before compression)

export async function POST(request: Request) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    const mealType = formData.get('mealType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // ========== Safety + Food validation ==========
    // Convert file to base64 for validation
    const validationBuffer = await file.arrayBuffer();
    const validationBase64 = Buffer.from(validationBuffer).toString('base64');

    // Determine media type for validation
    let validationMediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
    if (file.type === 'image/png') {
      validationMediaType = 'image/png';
    } else if (file.type === 'image/webp') {
      validationMediaType = 'image/webp';
    }

    // Validate that the image is safe and contains food
    const validation = await validateFoodImage(validationBase64, validationMediaType, user.id);

    if (!validation.isSafe || !validation.isFood) {
      console.log('[Meal Photo Upload] Rejected image:', {
        userId: user.id,
        isSafe: validation.isSafe,
        isFood: validation.isFood,
        category: validation.category,
        detected: validation.detectedContent,
        confidence: validation.confidence
      });

      return NextResponse.json(
        {
          error: validation.rejectionMessage || 'Please upload an image of food.',
          code: validation.isSafe ? 'NOT_FOOD' : 'INAPPROPRIATE_CONTENT',
          category: validation.category,
          detected: validation.isSafe ? validation.detectedContent : undefined // Don't expose details for inappropriate content
        },
        { status: 400 }
      );
    }
    // ========== END: Safety + Food validation ==========

    // Generate unique filename: userId/timestamp-randomstring.ext
    const fileExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileName = `${user.id}/${timestamp}-${randomString}.${fileExt}`;

    // Use the buffer we already created for validation
    const fileBuffer = new Uint8Array(validationBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Error uploading meal photo:', uploadError);
      return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
    }

    // Generate signed URL for private bucket (1 hour expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 3600);

    if (signedUrlError || !signedUrlData) {
      console.error('Error creating signed URL:', signedUrlError);
      // Clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([fileName]);
      return NextResponse.json({ error: 'Failed to generate image URL' }, { status: 500 });
    }

    // Create database record (store storage_path, not the signed URL which expires)
    const { data: photoRecord, error: dbError } = await supabase
      .from('meal_photos')
      .insert({
        user_id: user.id,
        storage_path: fileName,
        image_url: signedUrlData.signedUrl,
        analysis_status: 'pending',
      })
      .select('id, image_url, analysis_status')
      .single();

    if (dbError) {
      console.error('Error creating meal_photos record:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([fileName]);
      return NextResponse.json({ error: 'Failed to create photo record' }, { status: 500 });
    }

    return NextResponse.json(
      {
        photoId: photoRecord.id,
        imageUrl: photoRecord.image_url,
        status: photoRecord.analysis_status,
        mealType: mealType || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error handling meal photo upload:', error);
    return NextResponse.json({ error: 'Failed to process photo upload' }, { status: 500 });
  }
}
