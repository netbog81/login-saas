-- Add description column if it doesn't exist
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;