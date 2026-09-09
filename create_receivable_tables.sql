-- profit_received_lahore
CREATE TABLE profit_received_lahore (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE profit_received_lahore ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON profit_received_lahore FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- broker_received_lahore
CREATE TABLE broker_received_lahore (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE broker_received_lahore ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON broker_received_lahore FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- profit_received_rawalpindi
CREATE TABLE profit_received_rawalpindi (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE profit_received_rawalpindi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON profit_received_rawalpindi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- broker_received_rawalpindi
CREATE TABLE broker_received_rawalpindi (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vehicle_number TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE broker_received_rawalpindi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON broker_received_rawalpindi FOR ALL TO authenticated USING (true) WITH CHECK (true);
