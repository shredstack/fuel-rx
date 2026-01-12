import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Generate unique filename: userId/timestamp-randomstring.ext
    const fileExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileName = `${user.id}/${timestamp}-${randomString}.${fileExt}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

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
