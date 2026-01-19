import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendPasswordResetEmail } from '@/lib/email/resend';
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
      console.error('[Forgot Password] Error listing users:', listError);
      // Don't reveal whether email exists
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, we sent a password reset link.',
      });
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      // Don't reveal whether email exists - return same success message
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, we sent a password reset link.',
      });
    }

    // Generate a secure reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store the reset token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        email: user.email,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('[Forgot Password] Error storing reset token:', tokenError);
      return NextResponse.json(
        { error: 'Failed to create reset token' },
        { status: 500 }
      );
    }

    // Build the reset URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuelrx.app';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // Send reset email via Resend
    const emailResult = await sendPasswordResetEmail({
      to: user.email!,
      resetUrl,
    });

    if (!emailResult.success) {
      console.error('[Forgot Password] Failed to send reset email:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, we sent a password reset link.',
    });
  } catch (error) {
    console.error('[Forgot Password] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
