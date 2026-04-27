-- ============================================================
-- Gota — Database Schema v1.0
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================
-- EXPENSES TABLE
-- ============================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 1),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),

  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL CHECK (length(description) <= 100),
  is_want BOOLEAN,
  is_legacy_card_payment BOOLEAN,

  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'DEBIT', 'TRANSFER', 'CREDIT')),
  card_id VARCHAR(50),

  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT no_credit_card_payment
    CHECK (category != 'Pago de Tarjetas' OR payment_method != 'CREDIT'),

  CONSTRAINT card_required_when_credit
    CHECK (
      (payment_method = 'CREDIT' AND card_id IS NOT NULL) OR
      (category = 'Pago de Tarjetas' AND card_id IS NOT NULL) OR
      (payment_method != 'CREDIT' AND category != 'Pago de Tarjetas')
    )
);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX idx_expenses_user_created ON expenses(user_id, created_at DESC);
CREATE INDEX idx_expenses_category ON expenses(user_id, category);
CREATE INDEX idx_expenses_is_want ON expenses(user_id, is_want) WHERE is_want IS NOT NULL;
CREATE INDEX idx_expenses_payment ON expenses(user_id, payment_method);
CREATE INDEX idx_expenses_currency ON expenses(user_id, currency);
CREATE INDEX idx_expenses_card ON expenses(user_id, card_id) WHERE card_id IS NOT NULL;
CREATE INDEX idx_expenses_dashboard ON expenses(user_id, date DESC, currency, category)
  WHERE category != 'Pago de Tarjetas';

COMMENT ON TABLE expenses IS 'User expenses with multi-currency support';
COMMENT ON COLUMN expenses.is_want IS 'NULL for Pago de Tarjetas category';
COMMENT ON COLUMN expenses.card_id IS 'Required when payment_method=CREDIT or category=Pago de Tarjetas';

-- ============================================
-- MONTHLY_INCOME TABLE
-- ============================================

CREATE TABLE monthly_income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  month DATE NOT NULL,

  amount_ars DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount_ars >= 0),
  amount_usd DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
  saldo_inicial_ars DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial_ars >= 0),
  saldo_inicial_usd DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial_usd >= 0),

  closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_month UNIQUE(user_id, month)
);

CREATE INDEX idx_monthly_income_user_month ON monthly_income(user_id, month DESC);

COMMENT ON TABLE monthly_income IS 'User monthly income in ARS and USD';
COMMENT ON COLUMN monthly_income.month IS 'Always first day of month (YYYY-MM-01)';

-- ============================================
-- USER_CONFIG TABLE
-- ============================================

CREATE TABLE user_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  default_currency VARCHAR(3) NOT NULL DEFAULT 'ARS' CHECK (default_currency IN ('ARS', 'USD')),
  hero_balance_mode VARCHAR(20) NOT NULL DEFAULT 'combined_ars' CHECK (hero_balance_mode IN ('combined_ars', 'combined_usd', 'default_currency')),

  cards JSONB NOT NULL DEFAULT '[
    {"id": "bbva_visa", "name": "BBVA VISA", "archived": false},
    {"id": "bbva_master", "name": "BBVA MÁSTER", "archived": false},
    {"id": "bna_master", "name": "BNA MASTER", "archived": false}
  ]'::jsonb,

  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  rollover_mode VARCHAR(10) NOT NULL DEFAULT 'off' CHECK (rollover_mode IN ('auto', 'manual', 'off')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_config IS 'User configuration and preferences';
COMMENT ON COLUMN user_config.cards IS 'Array of card objects: [{"id": "...", "name": "...", "archived": false}]';

-- ============================================
-- SHARED FUNCTIONS & TRIGGERS
-- ============================================

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER monthly_income_updated_at
  BEFORE UPDATE ON monthly_income
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_config_updated_at
  BEFORE UPDATE ON user_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Normalize month to first day of month
CREATE OR REPLACE FUNCTION normalize_month()
RETURNS TRIGGER AS $$
BEGIN
  NEW.month = DATE_TRUNC('month', NEW.month)::DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_income_normalize_month
  BEFORE INSERT OR UPDATE ON monthly_income
  FOR EACH ROW EXECUTE FUNCTION normalize_month();

-- Validate cards JSONB
CREATE OR REPLACE FUNCTION validate_cards_jsonb()
RETURNS TRIGGER AS $$
BEGIN
  IF jsonb_typeof(NEW.cards) != 'array' THEN
    RAISE EXCEPTION 'cards must be a JSON array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.cards) AS card
    WHERE NOT (card ? 'id' AND card ? 'name')
  ) THEN
    RAISE EXCEPTION 'Each card must have id and name fields';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_config_validate_cards
  BEFORE INSERT OR UPDATE ON user_config
  FOR EACH ROW EXECUTE FUNCTION validate_cards_jsonb();

-- Auto-create user_config on first login
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_config (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;

-- Expenses
CREATE POLICY "expenses_select_policy" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert_policy" ON expenses FOR INSERT WITH CHECK (
  auth.uid() = user_id AND amount >= 1 AND length(description) <= 100
);
CREATE POLICY "expenses_update_policy" ON expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND amount >= 1 AND length(description) <= 100);
CREATE POLICY "expenses_delete_policy" ON expenses FOR DELETE USING (auth.uid() = user_id);

-- Monthly Income
CREATE POLICY "monthly_income_select_policy" ON monthly_income FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "monthly_income_insert_policy" ON monthly_income FOR INSERT WITH CHECK (
  auth.uid() = user_id AND amount_ars >= 0 AND amount_usd >= 0
);
CREATE POLICY "monthly_income_update_policy" ON monthly_income FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND amount_ars >= 0 AND amount_usd >= 0);
CREATE POLICY "monthly_income_delete_policy" ON monthly_income FOR DELETE USING (auth.uid() = user_id);

-- User Config
CREATE POLICY "user_config_select_policy" ON user_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_config_insert_policy" ON user_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_config_update_policy" ON user_config FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_config_delete_policy" ON user_config FOR DELETE USING (false);

-- ============================================
-- HELPER VIEWS
-- ============================================

CREATE OR REPLACE VIEW user_active_cards AS
SELECT
  user_id,
  jsonb_agg(card) AS cards
FROM (
  SELECT
    user_id,
    jsonb_array_elements(cards) AS card
  FROM user_config
) t
WHERE (card->>'archived')::boolean = false OR card->>'archived' IS NULL
GROUP BY user_id;

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Dashboard analytics
CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_user_id UUID,
  p_month DATE,
  p_currency VARCHAR(3)
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'saldo_vivo', (
      SELECT json_build_object(
        'saldo_inicial', COALESCE(
          CASE WHEN p_currency = 'ARS' THEN saldo_inicial_ars ELSE saldo_inicial_usd END, 0
        ),
        'ingresos', COALESCE(
          CASE WHEN p_currency = 'ARS' THEN amount_ars ELSE amount_usd END, 0
        ),
        'gastos_percibidos', COALESCE((
          SELECT SUM(amount) FROM expenses
          WHERE user_id = p_user_id AND currency = p_currency
            AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
            AND payment_method IN ('CASH', 'DEBIT', 'TRANSFER')
            AND category != 'Pago de Tarjetas'
        ), 0),
        'pago_tarjetas', COALESCE((
          SELECT SUM(amount) FROM expenses
          WHERE user_id = p_user_id AND currency = p_currency
            AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
            AND category = 'Pago de Tarjetas'
        ), 0)
      )
      FROM monthly_income
      WHERE user_id = p_user_id AND month = DATE_TRUNC('month', p_month)
    ),
    'gastos_tarjeta', COALESCE((
      SELECT SUM(amount) FROM expenses
      WHERE user_id = p_user_id AND currency = p_currency
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        AND payment_method = 'CREDIT' AND category != 'Pago de Tarjetas'
    ), 0),
    'filtro_estoico', (
      SELECT json_build_object(
        'necesidad_count', COUNT(*) FILTER (WHERE is_want = false),
        'deseo_count', COUNT(*) FILTER (WHERE is_want = true),
        'total_count', COUNT(*),
        'necesidad_amount', COALESCE(SUM(amount) FILTER (WHERE is_want = false), 0),
        'deseo_amount', COALESCE(SUM(amount) FILTER (WHERE is_want = true), 0)
      )
      FROM expenses
      WHERE user_id = p_user_id AND currency = p_currency
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        AND category != 'Pago de Tarjetas' AND is_want IS NOT NULL
    ),
    'top_3', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT category, SUM(amount) AS total, COUNT(*) AS count
        FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
          AND category != 'Pago de Tarjetas'
        GROUP BY category
        ORDER BY SUM(amount) DESC, COUNT(*) DESC
        LIMIT 3
      ) t
    ),
    'ultimos_5', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, amount, currency, category, description, is_want,
               payment_method, card_id, date, created_at
        FROM expenses
        WHERE user_id = p_user_id
          AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        ORDER BY date DESC, created_at DESC
        LIMIT 5
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Daily expense limit check (50/day)
CREATE OR REPLACE FUNCTION check_daily_expense_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM expenses
  WHERE user_id = p_user_id AND DATE(created_at) = CURRENT_DATE;
  RETURN v_count < 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Duplicate detection
CREATE OR REPLACE FUNCTION detect_duplicate_expenses(
  p_user_id UUID,
  p_amount DECIMAL,
  p_category VARCHAR,
  p_date DATE
)
RETURNS TABLE (id UUID, description TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.description, e.created_at
  FROM expenses e
  WHERE e.user_id = p_user_id
    AND e.amount = p_amount
    AND e.category = p_category
    AND DATE(e.date) = p_date
  ORDER BY e.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATIONS — run on existing DBs
-- ============================================

-- v1.1 — Onboarding + Rollover
ALTER TABLE monthly_income
  ADD COLUMN IF NOT EXISTS closed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE user_config
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollover_mode VARCHAR(10) NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS hero_balance_mode VARCHAR(20) NOT NULL DEFAULT 'combined_ars';

ALTER TABLE user_config
  DROP CONSTRAINT IF EXISTS user_config_rollover_mode_check;
ALTER TABLE user_config
  ADD CONSTRAINT user_config_rollover_mode_check
    CHECK (rollover_mode IN ('auto', 'manual', 'off'));

ALTER TABLE user_config
  DROP CONSTRAINT IF EXISTS user_config_hero_balance_mode_check;
ALTER TABLE user_config
  ADD CONSTRAINT user_config_hero_balance_mode_check
    CHECK (hero_balance_mode IN ('combined_ars', 'combined_usd', 'default_currency'));

-- Mark existing users with data as onboarding complete
UPDATE user_config
SET onboarding_completed = true
WHERE user_id IN (SELECT DISTINCT user_id FROM monthly_income);

-- ============================================
-- v1.2 — Accounts (multi-cuenta)
-- ============================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('bank', 'cash', 'digital')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  opening_balance_ars DECIMAL(12,2) NOT NULL DEFAULT 0,
  opening_balance_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one primary account per user allowed
CREATE UNIQUE INDEX IF NOT EXISTS one_primary_per_user
  ON accounts (user_id) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_accounts_user
  ON accounts(user_id, archived, created_at DESC);

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- Add account_id FK to expenses (nullable, non-breaking)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_legacy_card_payment BOOLEAN;

-- ============================================
-- v1.3 — Income Entries + Account Period Balance
-- ============================================

CREATE TABLE IF NOT EXISTS income_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  description VARCHAR(100) NOT NULL DEFAULT '',
  category VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (category IN ('salary', 'freelance', 'other')),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_entries_user_date ON income_entries(user_id, date DESC);
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ie_select" ON income_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ie_insert" ON income_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ie_delete" ON income_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS account_period_balance (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period DATE NOT NULL,          -- siempre YYYY-MM-01
  balance_ars DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('opening', 'rollover_auto', 'manual')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, period)
);

ALTER TABLE account_period_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apb_select" ON account_period_balance FOR SELECT
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "apb_insert" ON account_period_balance FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "apb_update" ON account_period_balance FOR UPDATE
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "apb_delete" ON account_period_balance FOR DELETE
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_id AND accounts.user_id = auth.uid()));

-- Update get_dashboard_data to use new tables with COALESCE fallback to monthly_income
CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_user_id UUID,
  p_month DATE,
  p_currency VARCHAR(3)
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_saldo_cutoff DATE := LEAST(
    CURRENT_DATE,
    (DATE_TRUNC('month', p_month) + INTERVAL '1 month - 1 day')::DATE
  );
BEGIN
  SELECT json_build_object(
    'saldo_vivo', json_build_object(
      'saldo_inicial', COALESCE(
        (SELECT SUM(CASE WHEN p_currency = 'ARS' THEN a.opening_balance_ars ELSE a.opening_balance_usd END)
         FROM accounts a
         WHERE a.user_id = p_user_id
           AND a.archived = false),
        0
      ),
      'ingresos', COALESCE(
        (SELECT SUM(amount) FROM income_entries
         WHERE user_id = p_user_id
           AND currency = p_currency
           AND date <= v_saldo_cutoff),
        0
      ),
      'gastos_percibidos', COALESCE((
        SELECT SUM(amount) FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND date <= v_saldo_cutoff
          AND payment_method IN ('CASH', 'DEBIT', 'TRANSFER')
          AND category != 'Pago de Tarjetas'
      ), 0),
      'pago_tarjetas', COALESCE((
        SELECT SUM(amount) FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND date <= v_saldo_cutoff
          AND category = 'Pago de Tarjetas'
      ), 0)
    ),
    'gastos_tarjeta', COALESCE((
      SELECT SUM(amount) FROM expenses
      WHERE user_id = p_user_id AND currency = p_currency
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        AND payment_method = 'CREDIT' AND category != 'Pago de Tarjetas'
    ), 0),
    'filtro_estoico', (
      SELECT json_build_object(
        'necesidad_count', COUNT(*) FILTER (WHERE is_want = false),
        'deseo_count', COUNT(*) FILTER (WHERE is_want = true),
        'total_count', COUNT(*),
        'necesidad_amount', COALESCE(SUM(amount) FILTER (WHERE is_want = false), 0),
        'deseo_amount', COALESCE(SUM(amount) FILTER (WHERE is_want = true), 0)
      )
      FROM expenses
      WHERE user_id = p_user_id AND currency = p_currency
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        AND category != 'Pago de Tarjetas' AND is_want IS NOT NULL
    ),
    'top_3', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT category, SUM(amount) AS total, COUNT(*) AS count
        FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
          AND category != 'Pago de Tarjetas'
        GROUP BY category
        ORDER BY SUM(amount) DESC, COUNT(*) DESC
        LIMIT 3
      ) t
    ),
    'ultimos_5', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, amount, currency, category, description, is_want,
               payment_method, card_id, date, created_at
        FROM expenses
        WHERE user_id = p_user_id
          AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        ORDER BY date DESC, created_at DESC
        LIMIT 5
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- v2.0 — Transferencias entre cuentas
-- ============================================

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount_from DECIMAL(12,2) NOT NULL CHECK (amount_from > 0),
  amount_to DECIMAL(12,2) NOT NULL CHECK (amount_to > 0),
  currency_from VARCHAR(3) NOT NULL CHECK (currency_from IN ('ARS', 'USD')),
  currency_to VARCHAR(3) NOT NULL CHECK (currency_to IN ('ARS', 'USD')),
  exchange_rate DECIMAL(14,4),  -- null si misma moneda
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date DESC);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_select" ON transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transfers_insert" ON transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transfers_delete" ON transfers FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- v2.1 — Rendimiento diario (cuentas remuneradas)
-- ============================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS daily_yield_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_yield_rate    DECIMAL(8,4);  -- % TNA. Ej: 78.5000. DECIMAL(8,4) soporta hasta 9999.9999%

CREATE TABLE IF NOT EXISTS yield_accumulator (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month               CHAR(7) NOT NULL,            -- formato YYYY-MM. Ej: '2026-03'
  accumulated         DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_manual_override  BOOLEAN NOT NULL DEFAULT false,
  last_accrued_date   DATE,                        -- última fecha procesada; NULL = no acreditado aún. Usado para idempotencia en GOT-30.
  confirmed_at        TIMESTAMPTZ,                 -- NULL = mes en curso, fecha = mes cerrado
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, month)
);

CREATE INDEX IF NOT EXISTS idx_yield_acc_user_month    ON yield_accumulator(user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_yield_acc_account_month ON yield_accumulator(account_id, month);

CREATE TRIGGER yield_accumulator_updated_at
  BEFORE UPDATE ON yield_accumulator
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE yield_accumulator ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ya_select" ON yield_accumulator FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ya_insert" ON yield_accumulator FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ya_update" ON yield_accumulator FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ya_delete" ON yield_accumulator FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- v2.2 — Instruments (plazo_fijo / fci)
-- ============================================

CREATE TABLE IF NOT EXISTS instruments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('plazo_fijo', 'fci')),
  label           TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  rate            NUMERIC(6,4),
  account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  opened_at       DATE NOT NULL,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  closed_at       DATE,
  closed_amount   NUMERIC(12,2),
  auto_egress_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instruments_user_status ON instruments(user_id, status);

ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instruments_select" ON instruments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "instruments_insert" ON instruments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "instruments_update" ON instruments FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "instruments_delete" ON instruments FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- v2.3 — Ingresos Recurrentes
-- ============================================

CREATE TABLE IF NOT EXISTS recurring_incomes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency     TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  category     TEXT NOT NULL DEFAULT 'salary' CHECK (category IN ('salary', 'freelance', 'other')),
  description  TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 100),
  account_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
  day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_incomes_user ON recurring_incomes(user_id, is_active);

CREATE TRIGGER recurring_incomes_updated_at
  BEFORE UPDATE ON recurring_incomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE recurring_incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ri_select" ON recurring_incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ri_insert" ON recurring_incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ri_update" ON recurring_incomes FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ri_delete" ON recurring_incomes FOR DELETE USING (auth.uid() = user_id);

-- Link income_entries to recurring config (nullable, non-breaking)
ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS recurring_income_id UUID REFERENCES recurring_incomes(id) ON DELETE SET NULL;

-- ============================================
-- v2.3b — Cards (tabla de tarjetas por usuario)
-- ============================================

CREATE TABLE IF NOT EXISTS cards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  closing_day INTEGER,
  due_day     INTEGER NOT NULL DEFAULT 10,
  account_id  UUID REFERENCES accounts(id) ON DELETE SET NULL,
  archived    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id, archived, created_at DESC);

CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_select" ON cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cards_insert" ON cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cards_update" ON cards FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cards_delete" ON cards FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- v2.4 — Card Cycles
-- ============================================

CREATE TABLE IF NOT EXISTS card_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_card_cycle_period UNIQUE (card_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_card_cycles_user_card_period
  ON card_cycles(user_id, card_id, period_month DESC);

CREATE TRIGGER card_cycles_updated_at
  BEFORE UPDATE ON card_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER card_cycles_normalize_period_month
  BEFORE INSERT OR UPDATE ON card_cycles
  FOR EACH ROW EXECUTE FUNCTION normalize_month();

ALTER TABLE card_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_cycles_select" ON card_cycles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "card_cycles_insert" ON card_cycles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_cycles_update" ON card_cycles FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_cycles_delete" ON card_cycles FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- v2.4.1 — Card Payment Allocations
-- ============================================

CREATE TABLE IF NOT EXISTS card_payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  card_cycle_id UUID NOT NULL REFERENCES card_cycles(id) ON DELETE CASCADE,
  amount_applied NUMERIC(12,2) NOT NULL CHECK (amount_applied > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_card_payment_allocation UNIQUE (expense_id, card_cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_card_payment_allocations_user_cycle
  ON card_payment_allocations(user_id, card_cycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_payment_allocations_user_expense
  ON card_payment_allocations(user_id, expense_id, created_at DESC);

CREATE TRIGGER card_payment_allocations_updated_at
  BEFORE UPDATE ON card_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE card_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_payment_allocations_select" ON card_payment_allocations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "card_payment_allocations_insert" ON card_payment_allocations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_payment_allocations_update" ON card_payment_allocations FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_payment_allocations_delete" ON card_payment_allocations FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- v2.5 — Card Cycles: montos de resumen y pago
-- ============================================

ALTER TABLE card_cycles
  ADD COLUMN IF NOT EXISTS amount_draft NUMERIC(12,2),   -- suma automática del devengado (calculada al cerrar)
  ADD COLUMN IF NOT EXISTS amount_paid  NUMERIC(12,2),   -- monto efectivamente pagado por el usuario
  ADD COLUMN IF NOT EXISTS paid_at      TIMESTAMPTZ;     -- null = abierto/vencido; fecha = pagado

-- ============================================
-- v2.6 — Disponible Real: deuda pendiente neta de tarjetas
-- Cambia gastos_tarjeta de devengado mensual a deuda acumulada sin pagar
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_user_id UUID,
  p_month DATE,
  p_currency VARCHAR(3)
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_saldo_cutoff DATE := LEAST(
    CURRENT_DATE,
    (DATE_TRUNC('month', p_month) + INTERVAL '1 month - 1 day')::DATE
  );
BEGIN
  SELECT json_build_object(
    'saldo_vivo', json_build_object(
      'saldo_inicial', COALESCE(
        (SELECT SUM(CASE WHEN p_currency = 'ARS' THEN a.opening_balance_ars ELSE a.opening_balance_usd END)
         FROM accounts a
         WHERE a.user_id = p_user_id
           AND a.archived = false),
        0
      ),
      'ingresos', COALESCE(
        (SELECT SUM(amount) FROM income_entries
         WHERE user_id = p_user_id
           AND currency = p_currency
           AND date <= v_saldo_cutoff),
        0
      ),
      'gastos_percibidos', COALESCE((
        SELECT SUM(amount) FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND date <= v_saldo_cutoff
          AND payment_method IN ('CASH', 'DEBIT', 'TRANSFER')
          AND category != 'Pago de Tarjetas'
      ), 0),
      'pago_tarjetas', COALESCE((
        SELECT SUM(amount) FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND date <= v_saldo_cutoff
          AND category = 'Pago de Tarjetas'
      ), 0)
    ),
    -- Deuda pendiente neta: total devengado en tarjeta - total pagos realizados (acumulado histórico).
    -- Representa lo comprometido que todavía no salió de la cuenta.
    -- disponibleReal (frontend) = saldoVivo - gastos_tarjeta.
    -- Como saldoVivo ya descuenta pago_tarjetas, los pagos se cancelan y queda:
    --   disponibleReal = opening + ingresos - gastos_percibidos - total_devengado_credito
    'gastos_tarjeta', GREATEST(0,
      COALESCE((
        SELECT SUM(amount) FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND date <= v_saldo_cutoff
          AND payment_method = 'CREDIT'
          AND category != 'Pago de Tarjetas'
      ), 0)
      -
      COALESCE((
        SELECT SUM(amount) FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND date <= v_saldo_cutoff
          AND category = 'Pago de Tarjetas'
          -- Legacy payments lower Saldo Vivo but do not reduce pending card debt.
          AND COALESCE(is_legacy_card_payment, false) = false
      ), 0)
    ),
    'filtro_estoico', (
      SELECT json_build_object(
        'necesidad_count', COUNT(*) FILTER (WHERE is_want = false),
        'deseo_count', COUNT(*) FILTER (WHERE is_want = true),
        'total_count', COUNT(*),
        'necesidad_amount', COALESCE(SUM(amount) FILTER (WHERE is_want = false), 0),
        'deseo_amount', COALESCE(SUM(amount) FILTER (WHERE is_want = true), 0)
      )
      FROM expenses
      WHERE user_id = p_user_id AND currency = p_currency
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        AND category != 'Pago de Tarjetas' AND is_want IS NOT NULL
    ),
    'top_3', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT category, SUM(amount) AS total, COUNT(*) AS count
        FROM expenses
        WHERE user_id = p_user_id AND currency = p_currency
          AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
          AND category != 'Pago de Tarjetas'
        GROUP BY category
        ORDER BY SUM(amount) DESC, COUNT(*) DESC
        LIMIT 3
      ) t
    ),
    'ultimos_5', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, amount, currency, category, description, is_want,
               payment_method, card_id, date, created_at
        FROM expenses
        WHERE user_id = p_user_id
          AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        ORDER BY date DESC, created_at DESC
        LIMIT 5
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PRODUCT_EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS product_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'onboarding_started',
      'onboarding_completed',
      'first_account_created',
      'first_expense_created',
      'smartinput_parse_started',
      'smartinput_parse_succeeded',
      'smartinput_parse_failed',
      'parsepreview_confirmed',
      'parsepreview_cancelled',
      'anonymous_banner_seen',
      'anonymous_link_started',
      'anonymous_link_completed',
      'card_payment_prompt_seen',
      'card_payment_prompt_confirmed',
      'card_payment_prompt_dismissed',
      'dashboard_loaded_with_data'
    )
  ),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_id TEXT,
  path TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_user_created
  ON product_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_name_created
  ON product_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_created
  ON product_events(created_at DESC);

ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_events_insert_own" ON product_events;
CREATE POLICY "product_events_insert_own" ON product_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No SELECT policy by design: product analytics is queried directly in Supabase.

-- ============================================
-- VERIFY
-- ============================================

-- Run after migration to confirm:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Should return: expenses, monthly_income, user_config, accounts, income_entries, account_period_balance, transfers, yield_accumulator, instruments, recurring_incomes, cards, card_cycles, product_events
