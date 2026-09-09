-- ============================================
-- SUPABASE SQL EDITOR MEIN YE PASTE KARKE RUN KAREIN
-- Sirf DATA delete hoga, Tables ka STRUCTURE safe rahega
-- ============================================

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

-- ============================================
-- DONE! Sara practice data delete ho gaya
-- Tables ka structure bilkul safe hai
-- Kal se real company data enter karein
-- ============================================
