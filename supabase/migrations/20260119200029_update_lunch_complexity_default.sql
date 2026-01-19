-- Update the default lunch_complexity for new users to 'quick_assembly'
-- Most athletes don't have much time for lunch preparation

ALTER TABLE user_profiles
ALTER COLUMN lunch_complexity SET DEFAULT 'quick_assembly';
