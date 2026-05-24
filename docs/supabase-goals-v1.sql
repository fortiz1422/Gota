-- Goals v1
-- Ejecutar en Supabase SQL Editor sobre una base ya existente

-- ============================================
-- GOALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  emoji TEXT NULL,
  color_token TEXT NULL,

  target_amount DECIMAL(14,2) NOT NULL CHECK (target_amount > 0),
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('ARS', 'USD')),

  target_date DATE NULL,
  starting_amount DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (starting_amount >= 0),
  planned_monthly_contribution DECIMAL(14,2) NULL CHECK (planned_monthly_contribution > 0),

  linked_account_id UUID NULL REFERENCES accounts(id) ON DELETE SET NULL,
  notes TEXT NULL CHECK (notes IS NULL OR length(notes) <= 500),

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  paused_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON goals(user_id, status);

CREATE INDEX IF NOT EXISTS idx_goals_user_target_date
  ON goals(user_id, target_date)
  WHERE target_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goals_user_created
  ON goals(user_id, created_at DESC);

DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_policy" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert_policy" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update_policy" ON goals FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_delete_policy" ON goals FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- GOAL_CONTRIBUTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('ARS', 'USD')),

  contributed_at DATE NOT NULL,

  source_type VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'transfer_linked', 'income_linked', 'adjustment')),

  note TEXT NULL CHECK (note IS NULL OR length(note) <= 300),

  related_transfer_id UUID NULL REFERENCES transfers(id) ON DELETE SET NULL,
  related_income_entry_id UUID NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal
  ON goal_contributions(goal_id, contributed_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_user
  ON goal_contributions(user_id, contributed_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_transfer
  ON goal_contributions(related_transfer_id)
  WHERE related_transfer_id IS NOT NULL;

DROP TRIGGER IF EXISTS goal_contributions_updated_at ON goal_contributions;
CREATE TRIGGER goal_contributions_updated_at
  BEFORE UPDATE ON goal_contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_contributions_select_policy" ON goal_contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goal_contributions_insert_policy" ON goal_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goal_contributions_update_policy" ON goal_contributions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goal_contributions_delete_policy" ON goal_contributions FOR DELETE USING (auth.uid() = user_id);
