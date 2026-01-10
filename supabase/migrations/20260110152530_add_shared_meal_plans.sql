-- Migration: Add shared_meal_plans table for meal plan sharing between users
-- When a user shares a meal plan, we create a copy of the meal_plan and its meal_plan_meals
-- for the recipient, linking back to the original sharer

-- Create shared_meal_plans table to track sharing relationships
CREATE TABLE shared_meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The original meal plan that was shared (owned by sharer)
  original_meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,

  -- The copied meal plan for the recipient (owned by recipient)
  recipient_meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,

  -- User who shared the meal plan
  sharer_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- User who received the shared meal plan
  recipient_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- When the sharing occurred
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate shares of same plan to same user
  UNIQUE(original_meal_plan_id, recipient_user_id)
);

-- Add sharer info columns to meal_plans for quick access without joins
-- These are denormalized for performance when displaying "Shared by" badge
ALTER TABLE meal_plans
ADD COLUMN shared_from_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
ADD COLUMN shared_from_user_name TEXT;

-- Create indexes for common queries
CREATE INDEX idx_shared_meal_plans_recipient ON shared_meal_plans(recipient_user_id);
CREATE INDEX idx_shared_meal_plans_sharer ON shared_meal_plans(sharer_user_id);
CREATE INDEX idx_shared_meal_plans_original ON shared_meal_plans(original_meal_plan_id);
CREATE INDEX idx_meal_plans_shared_from_user ON meal_plans(shared_from_user_id) WHERE shared_from_user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE shared_meal_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_meal_plans

-- Users can view shares where they are the sharer or recipient
CREATE POLICY "Users can view their own shares"
ON shared_meal_plans FOR SELECT
USING (
  auth.uid() = sharer_user_id OR
  auth.uid() = recipient_user_id
);

-- Users can only create shares for meal plans they own
CREATE POLICY "Users can share their own meal plans"
ON shared_meal_plans FOR INSERT
WITH CHECK (
  auth.uid() = sharer_user_id AND
  EXISTS (
    SELECT 1 FROM meal_plans
    WHERE id = original_meal_plan_id
    AND user_id = auth.uid()
  )
);

-- Users can delete shares they created
CREATE POLICY "Users can delete shares they created"
ON shared_meal_plans FOR DELETE
USING (auth.uid() = sharer_user_id);

-- Grant access
GRANT ALL ON shared_meal_plans TO authenticated;
