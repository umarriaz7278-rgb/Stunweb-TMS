-- Create deliveries table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bilty_id UUID NOT NULL REFERENCES bilties(id) ON DELETE CASCADE,
  customer_cnic TEXT,
  customer_phone TEXT,
  delivered_qty INTEGER DEFAULT 0,
  paid_amount DECIMAL(15, 2) DEFAULT 0,
  extra_labor DECIMAL(15, 2) DEFAULT 0,
  extra_unloading DECIMAL(15, 2) DEFAULT 0,
  local_fare DECIMAL(15, 2) DEFAULT 0,
  extra_other DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
