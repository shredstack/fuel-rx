-- Snap-a-Meal library saves stored the 1-hour signed URL from meal_photos.image_url
-- in meals.image_url, so saved meal images went dead after an hour. The save route
-- now stores the durable storage_path instead (read paths re-sign on demand).
-- Backfill existing photo-analyzed meals with the storage path from their photo.
UPDATE meals m
SET image_url = mp.storage_path
FROM meal_photos mp
WHERE mp.saved_meal_id = m.id
  AND m.source_type = 'photo_analyzed'
  AND mp.storage_path IS NOT NULL;
