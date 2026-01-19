-- Create password_reset_tokens table for password reset flow
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Index for fast token lookups
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- Index for cleanup of expired tokens
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- RLS policies - only service role should access this table
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can read/write
-- Service role bypasses RLS automatically

COMMENT ON TABLE public.password_reset_tokens IS 'Stores password reset tokens for forgot password flow using Resend';
