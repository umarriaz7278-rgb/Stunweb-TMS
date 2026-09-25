-- ================================================================
-- CONTAINER TRANSPORT (FTL) - MULTI-TENANT CLOUD DATABASE SETUP
-- Supabase SQL Editor mein copy karke "RUN" karein.
-- ================================================================

-- 1. FTL Brokers Table
CREATE TABLE IF NOT EXISTS ftl_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES saas_tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  cnic TEXT,
  ntn TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure tenant_id column exists if table already existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ftl_brokers' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE ftl_brokers ADD COLUMN tenant_id UUID REFERENCES saas_tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. FTL Trips Management Table
CREATE TABLE IF NOT EXISTS ftl_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES saas_tenants(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  bilty_number TEXT,
  vehicle_number TEXT,
  from_location TEXT DEFAULT 'Karachi',
  to_location TEXT,
  total_bilty_fare DECIMAL(15, 2) DEFAULT 0,
  vehicle_fare DECIMAL(15, 2) DEFAULT 0,
  gross_profit DECIMAL(15, 2) DEFAULT 0,
  net_profit DECIMAL(15, 2) DEFAULT 0,
  total_expenses DECIMAL(15, 2) DEFAULT 0,
  broker_name TEXT,
  expenses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure tenant_id & profit columns exist if table already existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ftl_trips' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE ftl_trips ADD COLUMN tenant_id UUID REFERENCES saas_tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ftl_trips' AND column_name = 'gross_profit'
  ) THEN
    ALTER TABLE ftl_trips ADD COLUMN gross_profit DECIMAL(15, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ftl_trips' AND column_name = 'net_profit'
  ) THEN
    ALTER TABLE ftl_trips ADD COLUMN net_profit DECIMAL(15, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ftl_trips' AND column_name = 'total_expenses'
  ) THEN
    ALTER TABLE ftl_trips ADD COLUMN total_expenses DECIMAL(15, 2) DEFAULT 0;
  END IF;
END $$;

-- 3. FTL Broker Receivables Table
CREATE TABLE IF NOT EXISTS ftl_broker_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES saas_tenants(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  vehicle_number TEXT,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure tenant_id column exists if table already existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ftl_broker_receivables' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE ftl_broker_receivables ADD COLUMN tenant_id UUID REFERENCES saas_tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Enable RLS and Open Anon Access Policies
ALTER TABLE ftl_brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ftl_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE ftl_broker_receivables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_ftl_brokers" ON ftl_brokers;
CREATE POLICY "anon_all_ftl_brokers" ON ftl_brokers FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_ftl_trips" ON ftl_trips;
CREATE POLICY "anon_all_ftl_trips" ON ftl_trips FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_ftl_broker_receivables" ON ftl_broker_receivables;
CREATE POLICY "anon_all_ftl_broker_receivables" ON ftl_broker_receivables FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Create Indexes for Fast Multi-Tenant Queries
CREATE INDEX IF NOT EXISTS idx_ftl_brokers_tenant ON ftl_brokers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ftl_trips_tenant ON ftl_trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ftl_trips_date ON ftl_trips(date);
CREATE INDEX IF NOT EXISTS idx_ftl_trips_broker ON ftl_trips(broker_name);
CREATE INDEX IF NOT EXISTS idx_ftl_broker_receivables_tenant ON ftl_broker_receivables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ftl_broker_receivables_broker ON ftl_broker_receivables(broker_name);

