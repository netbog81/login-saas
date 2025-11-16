-- Migration to update service fields with new naming convention

-- Add new columns
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "defaultDuration" INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "defaultPrice" DECIMAL(10,2) DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "bufferTimeBefore" INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "bufferTimeAfter" INTEGER DEFAULT 0;

-- Copy data from old columns to new ones if they exist
UPDATE services SET "defaultDuration" = duration WHERE "defaultDuration" IS NULL AND duration IS NOT NULL;
UPDATE services SET "bufferTimeBefore" = "bufferTime" WHERE "bufferTimeBefore" IS NULL AND "bufferTime" IS NOT NULL;

-- Drop old columns (optional - only if you're sure)
-- ALTER TABLE services DROP COLUMN IF EXISTS duration;
-- ALTER TABLE services DROP COLUMN IF EXISTS "bufferTime";