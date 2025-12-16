-- LLM Logs table for monitoring and analyzing LLM prompts and outputs
CREATE TABLE llm_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    output TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_type TEXT NOT NULL, -- e.g., 'meal_plan_generation', 'meal_type_batch'
    tokens_used INT,
    duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying by user and time
CREATE INDEX idx_llm_logs_user_id ON llm_logs(user_id);
CREATE INDEX idx_llm_logs_created_at ON llm_logs(created_at DESC);
CREATE INDEX idx_llm_logs_prompt_type ON llm_logs(prompt_type);

-- Enable Row Level Security
ALTER TABLE llm_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own logs
CREATE POLICY "Users can view own llm logs"
    ON llm_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert logs (from API routes)
CREATE POLICY "Service role can insert llm logs"
    ON llm_logs FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON llm_logs TO postgres, service_role;
GRANT SELECT ON llm_logs TO authenticated;
