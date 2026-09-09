-- Create the branch_ledgers table
CREATE TABLE branch_ledgers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  branch_name TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster filtering by branch and date
CREATE INDEX idx_branch_ledgers_branch_on_date ON branch_ledgers (branch_name, entry_date);

-- Enable RLS (Assuming you want to keep it secure)
ALTER TABLE branch_ledgers ENABLE ROW LEVEL SECURITY;

-- Simple policy to allow all actions for authenticated users (common in these internal ERPs)
CREATE POLICY "Allow all actions for authenticated users" ON branch_ledgers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
