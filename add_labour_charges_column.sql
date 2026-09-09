-- Add labour_charges column to booking_receipts table
-- Run this in Supabase Dashboard → SQL Editor
ALTER TABLE booking_receipts ADD COLUMN IF NOT EXISTS labour_charges DECIMAL(15, 2) DEFAULT 0;
