-- Cooking Assistant Tables
-- Enables context-aware chat sessions for users while preparing meals

-- Cooking chat sessions table
CREATE TABLE cooking_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  -- Ensure only one active session per user per meal
  CONSTRAINT unique_active_session UNIQUE (user_id, meal_id, ended_at)
);

-- Index for finding active sessions
CREATE INDEX idx_cooking_sessions_user_active ON cooking_chat_sessions(user_id, ended_at)
  WHERE ended_at IS NULL;

-- Index for meal-based lookups
CREATE INDEX idx_cooking_sessions_meal ON cooking_chat_sessions(meal_id, created_at);

-- Chat messages table
CREATE TABLE cooking_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cooking_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching messages by session
CREATE INDEX idx_cooking_messages_session ON cooking_chat_messages(session_id, created_at);

-- Enable Row Level Security
ALTER TABLE cooking_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cooking_chat_sessions
CREATE POLICY "Users can view their own chat sessions"
  ON cooking_chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions"
  ON cooking_chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
  ON cooking_chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for cooking_chat_messages
CREATE POLICY "Users can view messages from their sessions"
  ON cooking_chat_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM cooking_chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their sessions"
  ON cooking_chat_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM cooking_chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cooking_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_cooking_session_updated_at
  BEFORE UPDATE ON cooking_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_cooking_session_timestamp();

-- Comments for documentation
COMMENT ON TABLE cooking_chat_sessions IS 'Chat sessions between users and cooking assistant for specific meals';
COMMENT ON TABLE cooking_chat_messages IS 'Individual messages within cooking chat sessions';
COMMENT ON COLUMN cooking_chat_sessions.ended_at IS 'NULL for active sessions, timestamp when user ended the session';
