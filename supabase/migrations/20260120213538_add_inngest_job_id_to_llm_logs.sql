-- Add inngest_job_id column to llm_logs table
-- This allows linking all LLM calls from a single meal plan generation job together
-- for fine-tuning analysis and debugging purposes

ALTER TABLE llm_logs ADD COLUMN inngest_job_id UUID;

-- Index for querying all LLM calls for a specific job
CREATE INDEX idx_llm_logs_inngest_job_id ON llm_logs(inngest_job_id);

-- Note: Not adding a foreign key constraint to meal_plan_jobs because:
-- 1. Jobs may be cleaned up while logs are retained for ML training
-- 2. Some LLM logs (photo analysis, admin tools) don't have associated jobs
