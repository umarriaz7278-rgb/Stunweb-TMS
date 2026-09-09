-- ================================================================
-- GOODS TRANSPORT MANAGEMENT SYSTEM (TMS) - 100% CLOUD/ONLINE SETUP
-- Supabase SQL Editor mein poora copy-paste karke "RUN" karein.
-- Tamaam pages aur features ab 100% Supabase Online Database par chalenge!
-- ================================================================

-- 1. Enable UUID & Crypto Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 2. CORE BOOKING & BILTY MODULE
-- ================================================================

-- 2.1 Branches Table
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Branches
INSERT INTO branches (name) 
VALUES ('Karachi'), ('Rawalpindi'), ('Islamabad'), ('Lahore'), ('Peshawar'), ('Faisalabad'), ('Multan')
ON CONFLICT (name) DO NOTHING;

-- 2.2 Bilties Table
CREATE TABLE IF NOT EXISTS bilties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bilty_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  bilty_date DATE DEFAULT CURRENT_DATE,
  destination_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  destination TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  description TEXT,
  note TEXT,
  total_quantity INTEGER DEFAULT 1,
  weight_kg DECIMAL(15, 2) DEFAULT 0,
  cbm DECIMAL(15, 2) DEFAULT 0,
  lcl_number TEXT,
  container_number TEXT,
  local_freight DECIMAL(15, 2) DEFAULT 0,
  labor_charges DECIMAL(15, 2) DEFAULT 0,
  other_charges DECIMAL(15, 2) DEFAULT 0,
  tt_expense DECIMAL(15, 2) DEFAULT 0,
  custom_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  order_number TEXT,
  expense_name TEXT,
  booking_clerk TEXT,
  exclude_charges_from_print BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Booking Receipts (FTL)
CREATE TABLE IF NOT EXISTS booking_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'Advance Fare',
  date DATE DEFAULT CURRENT_DATE,
  mobile TEXT,
  sender_name TEXT,
  receiver_name TEXT,
  receiver_mobile TEXT,
  broker_name TEXT,
  loading_points TEXT DEFAULT 'karachi',
  destination TEXT DEFAULT 'Lahore',
  qty INTEGER DEFAULT 0,
  cbm DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  freight DECIMAL(15, 2) DEFAULT 0,
  local_freight DECIMAL(15, 2) DEFAULT 0,
  shifting_charges DECIMAL(15, 2) DEFAULT 0,
  labour_charges DECIMAL(15, 2) DEFAULT 0,
  other_expense DECIMAL(15, 2) DEFAULT 0,
  total_freight DECIMAL(15, 2) DEFAULT 0,
  weight_kg DECIMAL(15, 2) DEFAULT 0,
  container_no TEXT,
  lc_number TEXT,
  bl_number TEXT,
  order_number TEXT,
  gd_number TEXT,
  vehicle_number TEXT,
  vehicle_fare DECIMAL(15, 2) DEFAULT 0,
  vehicle_mobile TEXT DEFAULT '',
  additional_items TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Challans Table
CREATE TABLE IF NOT EXISTS challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  vehicle_number TEXT NOT NULL,
  route_number TEXT,
  broker_name TEXT,
  driver_name TEXT,
  challan_date DATE DEFAULT CURRENT_DATE,
  total_bilty_amount DECIMAL(15, 2) DEFAULT 0,
  labor_deduction DECIMAL(15, 2) DEFAULT 0,
  commission_deduction DECIMAL(15, 2) DEFAULT 0,
  other_deduction DECIMAL(15, 2) DEFAULT 0,
  vehicle_freight DECIMAL(15, 2) DEFAULT 0,
  branch_deposit DECIMAL(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'in_transit',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Challan Bilties Mapping Table
CREATE TABLE IF NOT EXISTS challan_bilties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  bilty_id UUID NOT NULL REFERENCES bilties(id) ON DELETE CASCADE,
  loaded_quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Deliveries Table
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 Receiving Verifications
CREATE TABLE IF NOT EXISTS receiving_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID REFERENCES challans(id) ON DELETE CASCADE,
  challan_bilty_id UUID REFERENCES challan_bilties(id) ON DELETE CASCADE,
  bilty_id UUID REFERENCES bilties(id) ON DELETE CASCADE,
  expected_qty INTEGER DEFAULT 0,
  received_qty INTEGER DEFAULT 0,
  short_qty INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 Short Claims
CREATE TABLE IF NOT EXISTS short_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_verification_id UUID REFERENCES receiving_verifications(id) ON DELETE CASCADE,
  bilty_id UUID REFERENCES bilties(id) ON DELETE CASCADE,
  short_qty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. FINANCE, EXPENSES & LEDGERS
-- ================================================================

-- 3.1 Branch Ledgers
CREATE TABLE IF NOT EXISTS branch_ledgers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  branch_name TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 Branch Expenses
CREATE TABLE IF NOT EXISTS branch_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 Finance Overview
CREATE TABLE IF NOT EXISTS finance_overview (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_income DECIMAL(15, 2) DEFAULT 0,
  total_expense DECIMAL(15, 2) DEFAULT 0,
  net_profit DECIMAL(15, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 Karachi Ledgers
CREATE TABLE IF NOT EXISTS karachi_ledgers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 Broker Ledgers
CREATE TABLE IF NOT EXISTS broker_ledgers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  broker_name TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.6 Broker Received (City-wise)
CREATE TABLE IF NOT EXISTS broker_received_islamabad (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_received_lahore (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_received_rawalpindi (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.7 Profit Received (City-wise)
CREATE TABLE IF NOT EXISTS profit_received_islamabad (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profit_received_lahore (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profit_received_rawalpindi (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.8 Commission Received Islamabad
CREATE TABLE IF NOT EXISTS commission_received_islamabad (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 4. LOCAL FREIGHT & PARTIES
-- ================================================================

CREATE TABLE IF NOT EXISTS local_freight_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS local_freight_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES local_freight_parties(id) ON DELETE CASCADE,
  bilty_id UUID REFERENCES bilties(id) ON DELETE SET NULL,
  date DATE DEFAULT CURRENT_DATE,
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'fare',
  month_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS closed_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES local_freight_parties(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  closed_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, year_month)
);

-- ================================================================
-- 5. WAREHOUSE RENTALS MODULE
-- ================================================================

CREATE TABLE IF NOT EXISTS warehouse_rental_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES warehouse_rental_clients(id) ON DELETE CASCADE,
  bag_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  weight_per_item DECIMAL(15, 2) DEFAULT 0,
  date_in DATE DEFAULT CURRENT_DATE,
  rent_period_days INTEGER DEFAULT 30,
  expected_payment DECIMAL(15, 2) DEFAULT 0,
  warehouse_section TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_rental_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES warehouse_rental_items(id) ON DELETE CASCADE,
  date_out DATE DEFAULT CURRENT_DATE,
  delivered_quantity INTEGER NOT NULL DEFAULT 0,
  payment_received DECIMAL(15, 2) DEFAULT 0,
  late_charges DECIMAL(15, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 6. FULL CLOUD / ONLINE EXTENSION TABLES
-- (FTL BROKERS, TRIPS, VEHICLE FLEET, ISLAMABAD STATEMENTS & SETTINGS)
-- ================================================================

-- 6.1 Company Settings (Cloud Branding)
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'GUL-E-PAKISTAN',
  address TEXT DEFAULT 'Plot #12, Phase II, Port Qasim, Karachi',
  contact TEXT DEFAULT '+92 300 1234567',
  ntn TEXT DEFAULT '',
  email TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO company_settings (name, address, contact)
SELECT 'GUL-E-PAKISTAN', 'Plot #12, Phase II, Port Qasim, Karachi', '+92 300 1234567'
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- 6.2 FTL Brokers
CREATE TABLE IF NOT EXISTS ftl_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  cnic TEXT,
  ntn TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.3 FTL Trips Management
CREATE TABLE IF NOT EXISTS ftl_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  bilty_number TEXT,
  vehicle_number TEXT,
  from_location TEXT DEFAULT 'Karachi',
  to_location TEXT,
  total_bilty_fare DECIMAL(15, 2) DEFAULT 0,
  vehicle_fare DECIMAL(15, 2) DEFAULT 0,
  broker_name TEXT,
  expenses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.4 FTL Broker Receivables
CREATE TABLE IF NOT EXISTS ftl_broker_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  vehicle_number TEXT,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.5 Vehicle Management - Suppliers
CREATE TABLE IF NOT EXISTS vm_suppliers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  balance DECIMAL(15, 2) DEFAULT 0,
  payments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Suppliers
INSERT INTO vm_suppliers (name, description, address)
SELECT 'Awan Logistics', 'Main fleet provider', 'Karachi, Port Qasim'
WHERE NOT EXISTS (SELECT 1 FROM vm_suppliers WHERE name = 'Awan Logistics');

INSERT INTO vm_suppliers (name, description, address)
SELECT 'Bilal Goods', 'Container specialist', 'Lahore, Goods Naka'
WHERE NOT EXISTS (SELECT 1 FROM vm_suppliers WHERE name = 'Bilal Goods');

INSERT INTO vm_suppliers (name, description, address)
SELECT 'Sindh Carriers', 'Local transport', 'Hyderabad'
WHERE NOT EXISTS (SELECT 1 FROM vm_suppliers WHERE name = 'Sindh Carriers');

-- 6.6 Vehicle Management - Fleet Vehicles
CREATE TABLE IF NOT EXISTS vm_vehicles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  number TEXT NOT NULL UNIQUE,
  supplier_id BIGINT REFERENCES vm_suppliers(id) ON DELETE SET NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.7 Vehicle Management - Vehicle Trips
CREATE TABLE IF NOT EXISTS vm_trips (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id BIGINT REFERENCES vm_vehicles(id) ON DELETE CASCADE,
  from_location TEXT DEFAULT 'Karachi',
  to_location TEXT,
  one_way_fare DECIMAL(15, 2) DEFAULT 0,
  return_fare DECIMAL(15, 2) DEFAULT 0,
  total_fare DECIMAL(15, 2) DEFAULT 0,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  expenses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.8 Islamabad Account Statements
CREATE TABLE IF NOT EXISTS islamabad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  cnic TEXT,
  ntn TEXT,
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS islamabad_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES islamabad_accounts(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  bilty_id UUID REFERENCES bilties(id) ON DELETE SET NULL,
  bilty_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.9 Online Audit & Report Month Closures
CREATE TABLE IF NOT EXISTS report_closed_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  year_month TEXT NOT NULL,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_type, year_month)
);

-- ================================================================
-- 7. HELPER RPC FUNCTIONS
-- ================================================================

-- 7.1 Get Next Bilty Number
CREATE OR REPLACE FUNCTION get_next_bilty_number()
RETURNS bigint
LANGUAGE sql
AS $$
  SELECT COALESCE(MAX(bilty_number), 0) + 1 FROM bilties;
$$;

GRANT EXECUTE ON FUNCTION get_next_bilty_number() TO anon, authenticated;

-- 7.2 Reset All Practice Data Function
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Booking & Bilty
  TRUNCATE TABLE bilties CASCADE;
  TRUNCATE TABLE booking_receipts CASCADE;

  -- Challans
  TRUNCATE TABLE challan_bilties CASCADE;
  TRUNCATE TABLE challans CASCADE;

  -- Deliveries & Claims
  TRUNCATE TABLE deliveries CASCADE;
  TRUNCATE TABLE receiving_verifications CASCADE;
  TRUNCATE TABLE short_claims CASCADE;

  -- Ledgers & Expenses
  TRUNCATE TABLE branch_ledgers CASCADE;
  TRUNCATE TABLE branch_expenses CASCADE;
  TRUNCATE TABLE karachi_ledgers CASCADE;

  -- Broker & Profit Reports
  TRUNCATE TABLE broker_ledgers CASCADE;
  TRUNCATE TABLE broker_received_islamabad CASCADE;
  TRUNCATE TABLE broker_received_lahore CASCADE;
  TRUNCATE TABLE broker_received_rawalpindi CASCADE;
  TRUNCATE TABLE profit_received_islamabad CASCADE;
  TRUNCATE TABLE profit_received_lahore CASCADE;
  TRUNCATE TABLE profit_received_rawalpindi CASCADE;
  TRUNCATE TABLE commission_received_islamabad CASCADE;

  -- Local Freight
  TRUNCATE TABLE local_freight_parties CASCADE;
  TRUNCATE TABLE local_freight_transactions CASCADE;
  TRUNCATE TABLE closed_months CASCADE;

  -- Warehouse Rentals
  TRUNCATE TABLE warehouse_rental_deliveries CASCADE;
  TRUNCATE TABLE warehouse_rental_items CASCADE;
  TRUNCATE TABLE warehouse_rental_clients CASCADE;

  -- FTL & Fleet
  TRUNCATE TABLE ftl_trips CASCADE;
  TRUNCATE TABLE ftl_broker_receivables CASCADE;
  TRUNCATE TABLE vm_trips CASCADE;

  -- Islamabad Accounts
  TRUNCATE TABLE islamabad_transactions CASCADE;
  TRUNCATE TABLE islamabad_accounts CASCADE;

  -- Month Closures
  TRUNCATE TABLE report_closed_months CASCADE;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_all_data() TO anon, authenticated;

-- ================================================================
-- 8. PENDING WAREHOUSE INVENTORY VIEW (CRITICAL - Karachi Warehouse & Challan)
-- ================================================================

-- Yeh VIEW automatically bilties table se un biltiyon ko show karta hai
-- jo abhi tak kisi challan mein fully dispatch nahi hui hain.
-- Warehouse.jsx aur ChallanCreate.jsx dono is VIEW se data lete hain.

CREATE OR REPLACE VIEW pending_warehouse_inventory AS
SELECT
  b.id,
  b.bilty_number,
  b.bilty_date AS date,
  b.total_quantity,
  b.weight_kg,
  b.total_amount,
  b.sender_name,
  b.receiver_name,
  b.description,
  b.note,
  b.local_freight,
  b.labor_charges,
  b.tt_expense,
  b.custom_amount,
  b.other_charges,
  b.exclude_charges_from_print,
  b.order_number,
  b.booking_clerk,
  b.lcl_number,
  b.container_number,
  b.sender_phone,
  b.receiver_phone,
  b.cbm,
  b.destination,
  b.destination_branch_id,
  br.name AS destination_name,
  -- Remaining quantity = total - already loaded in any challan
  GREATEST(
    b.total_quantity - COALESCE(
      (SELECT SUM(cb.loaded_quantity)
       FROM challan_bilties cb
       INNER JOIN challans c ON cb.challan_id = c.id
       WHERE cb.bilty_id = b.id
         AND c.status IN ('in_transit', 'arrived')),
      0
    ),
    0
  ) AS remaining_quantity
FROM bilties b
LEFT JOIN branches br ON br.id = b.destination_branch_id
WHERE
  -- Only bilties that have remaining quantity > 0
  GREATEST(
    b.total_quantity - COALESCE(
      (SELECT SUM(cb.loaded_quantity)
       FROM challan_bilties cb
       INNER JOIN challans c ON cb.challan_id = c.id
       WHERE cb.bilty_id = b.id
         AND c.status IN ('in_transit', 'arrived')),
      0
    ),
    0
  ) > 0;

-- Grant access to anon and authenticated roles
GRANT SELECT ON pending_warehouse_inventory TO anon, authenticated;

-- ================================================================
-- 9. BRANCH WAREHOUSE INVENTORY VIEW (Branch Office - Arrived Items)
-- ================================================================

-- Yeh VIEW branch office ke liye hai - jo challans branch par 'arrived' ho chuke hain
-- unki bilties jo abhi deliver nahi hui hain.

CREATE OR REPLACE VIEW branch_warehouse_inventory AS
SELECT
  cb.id AS challan_bilty_id,
  cb.bilty_id,
  cb.challan_id,
  cb.loaded_quantity,
  b.bilty_number,
  b.bilty_date AS date,
  b.total_quantity,
  b.weight_kg,
  b.total_amount,
  b.sender_name,
  b.receiver_name,
  b.description,
  b.local_freight,
  b.labor_charges,
  br_dest.name AS destination_name,
  b.destination_branch_id,
  c.vehicle_number,
  c.challan_number,
  c.challan_date,
  br_dest.name AS branch_name,
  -- Remaining = loaded - already delivered
  GREATEST(
    cb.loaded_quantity - COALESCE(
      (SELECT SUM(d.delivered_qty)
       FROM deliveries d
       WHERE d.bilty_id = cb.bilty_id),
      0
    ),
    0
  ) AS remaining_quantity
FROM challan_bilties cb
INNER JOIN challans c ON cb.challan_id = c.id AND c.status = 'arrived'
INNER JOIN bilties b ON cb.bilty_id = b.id
LEFT JOIN branches br_dest ON br_dest.id = b.destination_branch_id
WHERE
  GREATEST(
    cb.loaded_quantity - COALESCE(
      (SELECT SUM(d.delivered_qty)
       FROM deliveries d
       WHERE d.bilty_id = cb.bilty_id),
      0
    ),
    0
  ) > 0;

-- Grant access
GRANT SELECT ON branch_warehouse_inventory TO anon, authenticated;

-- ================================================================
-- 10. ROW LEVEL SECURITY & PERMISSIONS FOR 100% ONLINE CLOUD
-- ================================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'branches', 'bilties', 'booking_receipts', 'challans', 'challan_bilties',
    'deliveries', 'receiving_verifications', 'short_claims', 'branch_ledgers',
    'branch_expenses', 'finance_overview', 'karachi_ledgers', 'broker_ledgers',
    'broker_received_islamabad', 'broker_received_lahore', 'broker_received_rawalpindi',
    'profit_received_islamabad', 'profit_received_lahore', 'profit_received_rawalpindi',
    'commission_received_islamabad', 'local_freight_parties', 'local_freight_transactions',
    'closed_months', 'warehouse_rental_clients', 'warehouse_rental_items', 'warehouse_rental_deliveries',
    'company_settings', 'ftl_brokers', 'ftl_trips', 'ftl_broker_receivables',
    'vm_suppliers', 'vm_vehicles', 'vm_trips', 'islamabad_accounts', 'islamabad_transactions',
    'report_closed_months'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow All" ON %I;', tbl);
    EXECUTE format('CREATE POLICY "Allow All" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', tbl);
  END LOOP;
END $$;

-- ================================================================
-- 100% CLOUD DATABASE SETUP COMPLETED!
-- ================================================================
