-- ── BYOX Progress table ──────────────────────────────────────────────────────
-- Stores per-user progress and notes for each build-your-own-x tutorial.
-- Tutorial data is static (lib/byox/data.json); only progress lives in the DB.

CREATE TABLE IF NOT EXISTS byox_progress (
  id            bigint generated always as identity primary key,
  user_id       uuid   not null default auth.uid() references auth.users on delete cascade,
  tutorial_id   text   not null,
  status        text   not null default 'todo'
                check (status in ('todo', 'in_progress', 'done')),
  notes         text   not null default '',
  updated_at    timestamptz default now(),
  unique (user_id, tutorial_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_byox_progress_user
  ON byox_progress (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE byox_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "byox_select" ON byox_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "byox_insert" ON byox_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "byox_update" ON byox_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "byox_delete" ON byox_progress
  FOR DELETE USING (auth.uid() = user_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_byox_updated_at ON byox_progress;
CREATE TRIGGER set_byox_updated_at
  BEFORE UPDATE ON byox_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
