-- ====================================================================
-- FIX BOOKING RECEIPTS UNIQUE CONSTRAINT & TENANT ISOLATION
-- ====================================================================

-- 1. Drop the global unique constraint on booking_number if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'booking_receipts_booking_number_key' 
          AND table_name = 'booking_receipts'
    ) THEN
        ALTER TABLE booking_receipts DROP CONSTRAINT booking_receipts_booking_number_key;
    END IF;
END $$;

-- 2. Add tenant_id column to booking_receipts if not present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_receipts') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_receipts' AND column_name = 'tenant_id') THEN
            ALTER TABLE booking_receipts ADD COLUMN tenant_id UUID;
            CREATE INDEX IF NOT EXISTS idx_booking_receipts_tenant ON booking_receipts(tenant_id);
        END IF;
    END IF;
END $$;

-- 3. Add tenant_id to FTL support tables (ftl_trips, ftl_brokers, ftl_broker_receivables) if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ftl_trips') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ftl_trips' AND column_name = 'tenant_id') THEN
            ALTER TABLE ftl_trips ADD COLUMN tenant_id UUID;
            CREATE INDEX IF NOT EXISTS idx_ftl_trips_tenant ON ftl_trips(tenant_id);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ftl_brokers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ftl_brokers' AND column_name = 'tenant_id') THEN
            ALTER TABLE ftl_brokers ADD COLUMN tenant_id UUID;
            CREATE INDEX IF NOT EXISTS idx_ftl_brokers_tenant ON ftl_brokers(tenant_id);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ftl_broker_receivables') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ftl_broker_receivables' AND column_name = 'tenant_id') THEN
            ALTER TABLE ftl_broker_receivables ADD COLUMN tenant_id UUID;
            CREATE INDEX IF NOT EXISTS idx_ftl_broker_receivables_tenant ON ftl_broker_receivables(tenant_id);
        END IF;
    END IF;
END $$;

-- 4. Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
