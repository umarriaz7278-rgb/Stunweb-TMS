-- Add tt_expense column to bilties table if it doesn't exist
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bilties' AND column_name = 'tt_expense'
  ) THEN
    ALTER TABLE bilties ADD COLUMN tt_expense DECIMAL(15, 2) DEFAULT 0;
  END IF;
END $$;
