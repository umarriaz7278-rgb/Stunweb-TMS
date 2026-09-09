-- ============================================
-- YE SQL SUPABASE DASHBOARD → SQL EDITOR MEIN RUN KAREIN (SIRF 1 BAAR)
-- Ye ek function banayega jo Reset button se kaam karega
-- ============================================

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

  -- Branches
  TRUNCATE TABLE branches CASCADE;
  TRUNCATE TABLE branch_ledgers CASCADE;
  TRUNCATE TABLE branch_expenses CASCADE;

  -- Deliveries & Claims
  TRUNCATE TABLE deliveries CASCADE;
  TRUNCATE TABLE receiving_verifications CASCADE;
  TRUNCATE TABLE short_claims CASCADE;

  -- Broker
  TRUNCATE TABLE broker_ledgers CASCADE;
  TRUNCATE TABLE broker_received_islamabad CASCADE;
  TRUNCATE TABLE broker_received_lahore CASCADE;
  TRUNCATE TABLE broker_received_rawalpindi CASCADE;

  -- Profit
  TRUNCATE TABLE profit_received_islamabad CASCADE;
  TRUNCATE TABLE profit_received_lahore CASCADE;
  TRUNCATE TABLE profit_received_rawalpindi CASCADE;

  -- Commission
  TRUNCATE TABLE commission_received_islamabad CASCADE;

  -- Finance
  TRUNCATE TABLE finance_overview CASCADE;

  -- Karachi Ledger
  TRUNCATE TABLE karachi_ledgers CASCADE;

  -- Local Freight
  TRUNCATE TABLE local_freight_parties CASCADE;
  TRUNCATE TABLE local_freight_transactions CASCADE;

  -- Warehouse Rentals
  TRUNCATE TABLE warehouse_rental_deliveries CASCADE;
  TRUNCATE TABLE warehouse_rental_items CASCADE;
  TRUNCATE TABLE warehouse_rental_clients CASCADE;
END;
$$;

-- Allow anon and authenticated users to call this function
GRANT EXECUTE ON FUNCTION reset_all_data() TO anon;
GRANT EXECUTE ON FUNCTION reset_all_data() TO authenticated;
