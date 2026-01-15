import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid verification link')}`);
  }

  const supabase = createServiceRoleClient();

  // Look up the token
  const { data: tokenData, error: tokenError } = await supabase
    .from('email_verification_tokens')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .single();

  if (tokenError || !tokenData) {
    console.error('[Verify Email] Token not found or already used:', tokenError);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Invalid or expired verification link. Please sign up again.')}`
    );
  }

  // Check if token is expired
  if (new Date(tokenData.expires_at) < new Date()) {
    console.error('[Verify Email] Token expired');
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Verification link has expired. Please sign up again.')}`
    );
  }

  // Confirm the user's email using admin API
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    tokenData.user_id,
    { email_confirm: true }
  );

  if (updateError) {
    console.error('[Verify Email] Failed to confirm user:', updateError);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Failed to verify email. Please try again.')}`
    );
  }

  // Mark the token as used
  await supabase
    .from('email_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenData.id);

  // Redirect to login with success message
  return NextResponse.redirect(
    `${origin}/login?verified=true`
  );
}
