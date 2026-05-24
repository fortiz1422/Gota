-- Budgets v1
-- Ejecutar en Supabase SQL Editor sobre una base ya existente

CREATE TABLE IF NOT EXISTS budget_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'ARS' CHECK (base_currency IN ('ARS', 'USD')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budget_plans_unique_user_month_currency UNIQUE (user_id, period_month, base_currency)
);

CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(80) NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budget_items_unique_plan_category UNIQUE (plan_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budget_plans_user_month
  ON budget_plans(user_id, period_month DESC, base_currency);

CREATE INDEX IF NOT EXISTS idx_budget_items_plan_sort
  ON budget_items(plan_id, sort_order, category);

CREATE INDEX IF NOT EXISTS idx_budget_items_user_plan
  ON budget_items(user_id, plan_id);

DROP TRIGGER IF EXISTS budget_plans_updated_at ON budget_plans;
CREATE TRIGGER budget_plans_updated_at
  BEFORE UPDATE ON budget_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS budget_items_updated_at ON budget_items;
CREATE TRIGGER budget_items_updated_at
  BEFORE UPDATE ON budget_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION normalize_budget_period_month()
RETURNS TRIGGER AS $$
BEGIN
  NEW.period_month = DATE_TRUNC('month', NEW.period_month)::DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS budget_plans_normalize_month ON budget_plans;
CREATE TRIGGER budget_plans_normalize_month
  BEFORE INSERT OR UPDATE ON budget_plans
  FOR EACH ROW EXECUTE FUNCTION normalize_budget_period_month();

ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_plans_select_policy" ON budget_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budget_plans_insert_policy" ON budget_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budget_plans_update_policy" ON budget_plans FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budget_plans_delete_policy" ON budget_plans FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "budget_items_select_policy" ON budget_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budget_items_insert_policy" ON budget_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budget_items_update_policy" ON budget_items FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budget_items_delete_policy" ON budget_items FOR DELETE USING (auth.uid() = user_id);
