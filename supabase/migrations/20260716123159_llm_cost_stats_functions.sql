-- Aggregate functions for the admin LLM cost dashboard.
-- Aggregation happens in Postgres so the API never pulls raw llm_logs rows
-- (the table grows unbounded and prompts/outputs are large text blobs).
-- Input tokens are approximated as length(prompt) / 4 since only output
-- tokens (tokens_used) were recorded historically.

-- Per prompt_type + model rollup for a time window
CREATE OR REPLACE FUNCTION admin_llm_usage_summary(start_date TIMESTAMPTZ)
RETURNS TABLE (
    prompt_type TEXT,
    model TEXT,
    calls BIGINT,
    unique_users BIGINT,
    output_tokens BIGINT,
    approx_input_tokens BIGINT,
    avg_duration_ms NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        l.prompt_type,
        l.model,
        COUNT(*) AS calls,
        COUNT(DISTINCT l.user_id) AS unique_users,
        COALESCE(SUM(l.tokens_used), 0)::BIGINT AS output_tokens,
        (COALESCE(SUM(LENGTH(l.prompt)), 0) / 4)::BIGINT AS approx_input_tokens,
        ROUND(AVG(l.duration_ms)) AS avg_duration_ms
    FROM llm_logs l
    WHERE l.created_at >= start_date
    GROUP BY l.prompt_type, l.model
    ORDER BY output_tokens DESC;
$$;

-- Daily usage trend for a time window
CREATE OR REPLACE FUNCTION admin_llm_daily_usage(start_date TIMESTAMPTZ)
RETURNS TABLE (
    day DATE,
    model TEXT,
    calls BIGINT,
    output_tokens BIGINT,
    approx_input_tokens BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        (l.created_at AT TIME ZONE 'UTC')::DATE AS day,
        l.model,
        COUNT(*) AS calls,
        COALESCE(SUM(l.tokens_used), 0)::BIGINT AS output_tokens,
        (COALESCE(SUM(LENGTH(l.prompt)), 0) / 4)::BIGINT AS approx_input_tokens
    FROM llm_logs l
    WHERE l.created_at >= start_date
    GROUP BY 1, 2
    ORDER BY 1 ASC;
$$;

-- Highest-cost users for a time window (token totals; pricing applied in app code)
CREATE OR REPLACE FUNCTION admin_llm_top_users(start_date TIMESTAMPTZ, user_limit INT DEFAULT 20)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    calls BIGINT,
    output_tokens BIGINT,
    approx_input_tokens BIGINT,
    sonnet_output_tokens BIGINT,
    sonnet_approx_input_tokens BIGINT,
    haiku_output_tokens BIGINT,
    haiku_approx_input_tokens BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        l.user_id,
        p.email,
        COUNT(*) AS calls,
        COALESCE(SUM(l.tokens_used), 0)::BIGINT AS output_tokens,
        (COALESCE(SUM(LENGTH(l.prompt)), 0) / 4)::BIGINT AS approx_input_tokens,
        COALESCE(SUM(l.tokens_used) FILTER (WHERE l.model ILIKE '%sonnet%'), 0)::BIGINT AS sonnet_output_tokens,
        (COALESCE(SUM(LENGTH(l.prompt)) FILTER (WHERE l.model ILIKE '%sonnet%'), 0) / 4)::BIGINT AS sonnet_approx_input_tokens,
        COALESCE(SUM(l.tokens_used) FILTER (WHERE l.model ILIKE '%haiku%'), 0)::BIGINT AS haiku_output_tokens,
        (COALESCE(SUM(LENGTH(l.prompt)) FILTER (WHERE l.model ILIKE '%haiku%'), 0) / 4)::BIGINT AS haiku_approx_input_tokens
    FROM llm_logs l
    JOIN user_profiles p ON p.id = l.user_id
    WHERE l.created_at >= start_date
    GROUP BY l.user_id, p.email
    ORDER BY output_tokens DESC
    LIMIT user_limit;
$$;
