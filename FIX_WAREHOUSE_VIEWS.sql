-- ================================================================
-- KARACHI WAREHOUSE FIX - SIRF YEH SQL SUPABASE MEIN RUN KAREIN
-- Bilty bante hi Karachi Warehouse mein show hogi aur Challan ban sakta hai
-- ================================================================

-- 1. Karachi Warehouse View (pending_warehouse_inventory)
-- Yeh automatically bilties show karta hai jo abhi dispatch nahi hui

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
  COALESCE(NULLIF(b.destination, ''), br.name) AS destination_name,
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

GRANT SELECT ON pending_warehouse_inventory TO anon, authenticated;

-- ================================================================
-- 2. Branch Warehouse View (branch_warehouse_inventory)
-- Branch Office ke liye - jo challans arrive ho chuke hain unki bilties
-- ================================================================

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

GRANT SELECT ON branch_warehouse_inventory TO anon, authenticated;

-- ================================================================
-- DONE! Ab Bilty banane ke baad Karachi Warehouse mein show hogi!
-- ================================================================
