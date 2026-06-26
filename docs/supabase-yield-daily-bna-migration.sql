-- Rendimientos diarios reconciliables para cuentas remuneradas (BNA)
-- Ejecutar en Supabase SQL editor o con credenciales de DB admin.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS daily_yield_provider TEXT,
  ADD COLUMN IF NOT EXISTS daily_yield_cap_amount DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS daily_yield_checkin_interval_days SMALLINT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS daily_yield_last_checkin_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS yield_daily_entries (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id                 UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date                       DATE NOT NULL,
  currency                   TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  expected_amount            DECIMAL(14,2),
  expected_rate_tna          DECIMAL(8,4),
  expected_cap_amount        DECIMAL(14,2),
  expected_base_balance      DECIMAL(14,2),
  actual_amount              DECIMAL(14,2),
  actual_concept             TEXT,
  actual_statement_balance   DECIMAL(14,2),
  actual_source              TEXT CHECK (actual_source IS NULL OR actual_source IN ('statement_csv', 'manual')),
  status                     TEXT NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated', 'matched', 'actual_only', 'difference', 'ignored', 'manual_adjusted')),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_yield_daily_user_date ON yield_daily_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_yield_daily_account_date ON yield_daily_entries(account_id, date DESC);

DROP TRIGGER IF EXISTS yield_daily_entries_updated_at ON yield_daily_entries;
CREATE TRIGGER yield_daily_entries_updated_at
  BEFORE UPDATE ON yield_daily_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE yield_daily_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yde_select" ON yield_daily_entries;
DROP POLICY IF EXISTS "yde_insert" ON yield_daily_entries;
DROP POLICY IF EXISTS "yde_update" ON yield_daily_entries;
DROP POLICY IF EXISTS "yde_delete" ON yield_daily_entries;
CREATE POLICY "yde_select" ON yield_daily_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "yde_insert" ON yield_daily_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "yde_update" ON yield_daily_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "yde_delete" ON yield_daily_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS statement_imports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id            UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  file_name             TEXT,
  row_count             INTEGER NOT NULL DEFAULT 0,
  matched_yield_count   INTEGER NOT NULL DEFAULT 0,
  ignored_count         INTEGER NOT NULL DEFAULT 0,
  imported_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE statement_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "statement_imports_select" ON statement_imports;
DROP POLICY IF EXISTS "statement_imports_insert" ON statement_imports;
CREATE POLICY "statement_imports_select" ON statement_imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "statement_imports_insert" ON statement_imports FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS statement_import_rows (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_id                UUID NOT NULL REFERENCES statement_imports(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id               UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date                     DATE NOT NULL,
  comprobante              TEXT,
  concept                  TEXT NOT NULL,
  amount                   DECIMAL(14,2) NOT NULL,
  balance                  DECIMAL(14,2),
  raw                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_yield_entry_id   UUID REFERENCES yield_daily_entries(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statement_import_rows_import ON statement_import_rows(import_id);

ALTER TABLE statement_import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "statement_import_rows_select" ON statement_import_rows;
DROP POLICY IF EXISTS "statement_import_rows_insert" ON statement_import_rows;
CREATE POLICY "statement_import_rows_select" ON statement_import_rows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "statement_import_rows_insert" ON statement_import_rows FOR INSERT WITH CHECK (auth.uid() = user_id);
