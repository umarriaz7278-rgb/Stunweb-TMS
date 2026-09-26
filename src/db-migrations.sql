-- ============================================================
-- MULTI-BRANCH FEATURE — SQL MIGRATION
-- Run this in your Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Generic commission received (Delivery Report) for new branches
CREATE TABLE IF NOT EXISTS branch_commission_received (
  id         BIGSERIAL PRIMARY KEY,
  branch_name TEXT NOT NULL,
  date        DATE,
  description TEXT,
  vehicle_number TEXT,
  amount      NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Generic profit / A/C receivable received for new branches
CREATE TABLE IF NOT EXISTS branch_profit_received (
  id         BIGSERIAL PRIMARY KEY,
  branch_name TEXT NOT NULL,
  date        DATE,
  description TEXT,
  vehicle_number TEXT,
  amount      NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Generic broker received payments for new branches
CREATE TABLE IF NOT EXISTS branch_broker_received (
  id         BIGSERIAL PRIMARY KEY,
  branch_name TEXT NOT NULL,
  broker_name TEXT,
  date        DATE,
  description TEXT,
  amount      NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Generic account statement entries for new branches
CREATE TABLE IF NOT EXISTS branch_account_entries (
  id         BIGSERIAL PRIMARY KEY,
  branch_name TEXT NOT NULL,
  entry_date  DATE,
  entry_type  TEXT, -- 'debit' or 'credit'
  description TEXT,
  amount      NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Client & System Settings (Bilty, Challan, Booking Receipt Headers & Company Details)
CREATE TABLE IF NOT EXISTS app_settings (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT app_settings_tenant_key_unique UNIQUE (tenant_id, key)
);

