/**
 * Cooked Meal Photo Upload API
 *
 * POST /api/cooked-meal-photos - Upload a photo of a cooked meal
 * DELETE /api/cooked-meal-photos?storagePath=... - Delete a cooked meal photo
 *
 * Uses the existing meal-photos bucket with a 'cooked/' subfolder.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'meal-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max (should be ~100-200KB after compression)

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
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    // Generate unique filename: userId/cooked/timestamp-randomstring.ext
    const fileExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const storagePath = `${user.id}/cooked/${timestamp}-${randomString}.${fileExt}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Error uploading cooked meal photo:', uploadError);
      return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
    }

    // Return the storage path - signed URLs will be generated on-the-fly when needed
    // This prevents URLs from expiring in the database
    return NextResponse.json({
      storagePath,
    });
  } catch (error) {
    console.error('Error handling cooked meal photo upload:', error);
    return NextResponse.json({ error: 'Failed to process photo upload' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get('storagePath');

    if (!storagePath) {
      return NextResponse.json({ error: 'Storage path is required' }, { status: 400 });
    }

    // Verify the file belongs to the user (storagePath starts with userId/)
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Unauthorized to delete this file' }, { status: 403 });
    }

    const { error: deleteError } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);

    if (deleteError) {
      console.error('Error deleting cooked meal photo:', deleteError);
      return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling cooked meal photo deletion:', error);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
