-- Migration: Fix usda_match_status check constraint
-- ============================================
-- The previous migration may not have properly updated the constraint.
-- This migration drops ALL constraints on the column and recreates.
-- ============================================

-- First, find and drop any existing check constraints on usda_match_status
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find all check constraints that reference usda_match_status
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'ingredient_nutrition'
        AND nsp.nspname = 'public'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%usda_match_status%'
    LOOP
        EXECUTE 'ALTER TABLE ingredient_nutrition DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- Now add the constraint with the correct values including 'needs_review'
ALTER TABLE ingredient_nutrition
ADD CONSTRAINT ingredient_nutrition_usda_match_status_check
CHECK (usda_match_status IS NULL OR usda_match_status IN ('pending', 'matched', 'no_match', 'manual_override', 'needs_review'));
