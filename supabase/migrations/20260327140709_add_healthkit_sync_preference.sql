-- User toggle for Apple Health nutrition sync

ALTER TABLE user_profiles
ADD COLUMN healthkit_nutrition_sync_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_profiles.healthkit_nutrition_sync_enabled
    IS 'When enabled, logged meals are automatically written to Apple Health';
