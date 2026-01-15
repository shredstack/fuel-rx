import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendVerificationEmail } from '@/lib/email/resend';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Create user with email_confirm set to false (unverified)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (createError) {
      // Check for duplicate email
      if (createError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 400 }
        );
      }
      console.error('[Signup] Error creating user:', createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    if (!userData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Generate a secure verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Store the verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: userData.user.id,
        email,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('[Signup] Error storing verification token:', tokenError);
      // Clean up the created user since we couldn't store the token
      await supabase.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json(
        { error: 'Failed to create verification token' },
        { status: 500 }
      );
    }

    // Build the verification URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuelrx.app';
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    // Send verification email via Resend
    const emailResult = await sendVerificationEmail({
      to: email,
      verificationUrl,
    });

    if (!emailResult.success) {
      console.error('[Signup] Failed to send verification email:', emailResult.error);
      // Don't fail the signup - the user can request a new verification email
    }

    return NextResponse.json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
    });
  } catch (error) {
    console.error('[Signup] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
