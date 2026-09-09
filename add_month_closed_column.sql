-- Add month_closed column to local_freight_transactions table
-- This tracks which transactions belong to finalized months

ALTER TABLE local_freight_transactions ADD COLUMN IF NOT EXISTS month_closed BOOLEAN DEFAULT FALSE;

-- Create a table to track closed months
CREATE TABLE IF NOT EXISTS closed_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES local_freight_parties(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  closed_date TIMESTAMP DEFAULT NOW(),
  UNIQUE(party_id, year_month)
);
