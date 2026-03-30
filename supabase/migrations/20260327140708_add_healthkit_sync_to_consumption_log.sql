-- Track which consumption entries have been synced to Apple Health

ALTER TABLE meal_consumption_log
ADD COLUMN healthkit_synced BOOLEAN DEFAULT FALSE,
ADD COLUMN healthkit_sample_ids TEXT[],
ADD COLUMN healthkit_synced_at TIMESTAMPTZ;

-- Index for finding unsynced entries (for retry/batch sync)
CREATE INDEX idx_consumption_healthkit_unsynced
    ON meal_consumption_log(user_id, healthkit_synced)
    WHERE healthkit_synced = FALSE;

COMMENT ON COLUMN meal_consumption_log.healthkit_synced
    IS 'Whether this entry has been written to Apple Health';
COMMENT ON COLUMN meal_consumption_log.healthkit_sample_ids
    IS 'Apple Health sample UUIDs for deletion if meal is un-logged';
COMMENT ON COLUMN meal_consumption_log.healthkit_synced_at
    IS 'Timestamp when this entry was synced to Apple Health';
