-- Allow users to view meals that are part of their own meal plans.
-- This is needed for shared meal plans: when a meal plan is shared,
-- the recipient gets a copy of meal_plan_meals pointing to the same
-- meal records. Without this policy, RLS on the meals table blocks
-- access because the meals have source_user_id = the original creator
-- and is_public = false.
CREATE POLICY "Users can view meals in their meal plans"
  ON meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM meal_plan_meals mpm
      JOIN meal_plans mp ON mp.id = mpm.meal_plan_id
      WHERE mpm.meal_id = meals.id
        AND mp.user_id = auth.uid()
    )
  );
