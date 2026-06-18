-- Ledger table, named to match the deployed code (lib/ledger/db.ts → "ledger_entries").
-- Supersedes 001_create_transactions.sql, which created a differently-named
-- table ("transactions") the code never queries.
--
-- Single shared ledger (no user_id): the /api/ledger/* routes run the
-- service-role client and enforce auth themselves. RLS is enabled with NO
-- policies, so direct anon/REST access is denied while the service-role client
-- (which bypasses RLS) still works — defence in depth.

CREATE TABLE IF NOT EXISTS ledger_entries (
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

CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_fingerprint ON ledger_entries(fingerprint);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_description
  ON ledger_entries USING gin(to_tsvector('english', description));

-- updated_at trigger (reuse the shared fn if a prior migration defined it)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ledger_entries_updated_at ON ledger_entries;
CREATE TRIGGER update_ledger_entries_updated_at
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: deny direct access; service-role bypasses.
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- Private storage bucket for statement files (PDF/xlsx). Private = no public URL;
-- the process route downloads server-side via the service-role client.
INSERT INTO storage.buckets (id, name, public)
VALUES ('statements', 'statements', false)
ON CONFLICT (id) DO NOTHING;
