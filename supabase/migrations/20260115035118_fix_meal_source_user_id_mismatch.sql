-- DISABLED: This migration caused data corruption by incorrectly reassigning meal ownership.
-- The logic assumed meals with the same name_normalized were equivalent, but they're not.
-- Keeping as no-op since it already ran on production.
--
-- Original intent was to fix RLS access issues, but it broke meal plans instead.
-- See: https://github.com/shredstack/fuel-rx/issues/XX (if you create an issue to track this)

SELECT 1; -- no-op
