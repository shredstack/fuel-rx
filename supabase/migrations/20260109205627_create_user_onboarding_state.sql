-- User Onboarding State table
-- Tracks user progress through the progressive onboarding system
-- ============================================

CREATE TABLE user_onboarding_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Milestone flags
    profile_completed BOOLEAN DEFAULT FALSE,
    first_plan_started BOOLEAN DEFAULT FALSE,
    first_plan_completed BOOLEAN DEFAULT FALSE,
    first_plan_viewed BOOLEAN DEFAULT FALSE,
    grocery_list_viewed BOOLEAN DEFAULT FALSE,
    prep_view_visited BOOLEAN DEFAULT FALSE,
    first_meal_liked BOOLEAN DEFAULT FALSE,
    first_meal_swapped BOOLEAN DEFAULT FALSE,

    -- Milestone timestamps
    profile_completed_at TIMESTAMPTZ,
    first_plan_started_at TIMESTAMPTZ,
    first_plan_completed_at TIMESTAMPTZ,
    first_plan_viewed_at TIMESTAMPTZ,
    grocery_list_viewed_at TIMESTAMPTZ,
    prep_view_visited_at TIMESTAMPTZ,
    first_meal_liked_at TIMESTAMPTZ,
    first_meal_swapped_at TIMESTAMPTZ,

    -- Feature discovery tracking (array of feature IDs that have been discovered)
    features_discovered TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Tip dismissal tracking (array of tip IDs dismissed by user)
    tips_dismissed TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- First Plan Tour state
    first_plan_tour_completed BOOLEAN DEFAULT FALSE,
    first_plan_tour_current_step INT DEFAULT 0,
    first_plan_tour_skipped BOOLEAN DEFAULT FALSE,

    -- Tutorial replay preferences
    tutorial_replay_count INT DEFAULT 0,
    last_tutorial_replay_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_user_onboarding_state_user_id ON user_onboarding_state(user_id);

-- Enable RLS
ALTER TABLE user_onboarding_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own onboarding state"
    ON user_onboarding_state FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding state"
    ON user_onboarding_state FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding state"
    ON user_onboarding_state FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role full access (for server-side operations)
CREATE POLICY "Service role full access"
    ON user_onboarding_state FOR ALL
    USING (auth.role() = 'service_role');

-- Trigger for updated_at (uses existing function from 001_initial_schema.sql)
CREATE TRIGGER update_user_onboarding_state_updated_at
    BEFORE UPDATE ON user_onboarding_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON user_onboarding_state TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON user_onboarding_state TO authenticated;

COMMENT ON TABLE user_onboarding_state IS 'Tracks user progress through the progressive onboarding system';
COMMENT ON COLUMN user_onboarding_state.features_discovered IS 'Array of feature IDs that have been shown to the user';
COMMENT ON COLUMN user_onboarding_state.tips_dismissed IS 'Array of tip IDs that have been dismissed by the user';
COMMENT ON COLUMN user_onboarding_state.first_plan_tour_current_step IS 'Current step index in the first plan tour (0-indexed)';
