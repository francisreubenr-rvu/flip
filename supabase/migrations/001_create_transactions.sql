-- Create transactions table for the ledger system
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  debit DECIMAL(12,2),
  credit DECIMAL(12,2),
  balance DECIMAL(12,2) NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  statement_source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint ON transactions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_transactions_description ON transactions USING gin(to_tsvector('english', description));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket setup (run separately in Supabase Dashboard Storage section)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('statements', 'statements', false);
