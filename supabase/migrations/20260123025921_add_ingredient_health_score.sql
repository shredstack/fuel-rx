-- Add health_score column to ingredients table for USDA food health scoring
-- Health score ranges from 0-100 (higher = healthier)
-- Used to indicate food quality: whole foods (80-100), minimally processed (60-79),
-- healthy processed (40-59), heavily processed (0-39)

ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100);

COMMENT ON COLUMN ingredients.health_score IS 'Calculated health score 0-100 (higher = healthier)';

-- Add index for potential filtering by health score
CREATE INDEX IF NOT EXISTS idx_ingredients_health_score ON ingredients(health_score);
