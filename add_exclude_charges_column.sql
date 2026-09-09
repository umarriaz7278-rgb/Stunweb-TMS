-- ============================================
-- Add exclude_charges_from_print column to bilties table
-- Charges ko print se hide karne ke liye
-- ============================================

ALTER TABLE bilties
ADD COLUMN exclude_charges_from_print BOOLEAN DEFAULT FALSE;

-- ============================================
-- DONE! Column add ho gya
-- Ab charges ko print se exclude kar sakte ho
-- ============================================
