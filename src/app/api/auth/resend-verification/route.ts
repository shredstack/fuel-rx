import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendVerificationEmail } from '@/lib/email/resend';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Look up user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('[Resend Verification] Error listing users:', listError);
      // Don't reveal whether email exists
      return NextResponse.json({
        success: true,
        message: 'If an unverified account with that email exists, we sent a new verification link.',
      });
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      // Don't reveal whether email exists
      return NextResponse.json({
        success: true,
        message: 'If an unverified account with that email exists, we sent a new verification link.',
      });
    }

    // Check if user is already verified
    if (user.email_confirmed_at) {
      return NextResponse.json({
        success: true,
        message: 'If an unverified account with that email exists, we sent a new verification link.',
      });
    }

    // Invalidate any existing unused tokens for this user
    await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    // Generate a new verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Store the verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        email: user.email,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('[Resend Verification] Error storing verification token:', tokenError);
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
      to: user.email!,
      verificationUrl,
    });

    if (!emailResult.success) {
      console.error('[Resend Verification] Failed to send verification email:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: 'If an unverified account with that email exists, we sent a new verification link.',
    });
  } catch (error) {
    console.error('[Resend Verification] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
