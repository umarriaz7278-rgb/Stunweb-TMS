-- ============================================
-- Add bilty_date column to bilties table
-- Bilty ke liye custom date rakhne ke liye
-- ============================================

ALTER TABLE bilties
ADD COLUMN bilty_date DATE DEFAULT CURRENT_DATE;

-- ============================================
-- DONE! Column add ho gya
-- ============================================
