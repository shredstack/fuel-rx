-- Create email_verification_tokens table for custom email verification flow
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Index for fast token lookups
CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens(token);

-- Index for cleanup of expired tokens
CREATE INDEX idx_email_verification_tokens_expires_at ON public.email_verification_tokens(expires_at);

-- RLS policies - only service role should access this table
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can read/write
-- Service role bypasses RLS automatically

COMMENT ON TABLE public.email_verification_tokens IS 'Stores email verification tokens for custom signup flow using Resend';
