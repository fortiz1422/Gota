# Gota — Backend Structure v1.0

**Versión:** 1.0 · actualizado post-MVP
**Fecha:** 3 Febrero 2026 · revisado Febrero 2026
**Database:** Supabase PostgreSQL 15
**Auth:** Supabase Auth (Google OAuth)
**Status:** ✅ MVP Completo — todos los endpoints implementados

---

## ÍNDICE

1. [Database Schema](#1-database-schema)
2. [Row Level Security (RLS)](#2-row-level-security-rls)
3. [Database Functions](#3-database-functions)
4. [API Endpoints](#4-api-endpoints)
5. [Server Actions](#5-server-actions)
6. [Authentication Flow](#6-authentication-flow)
7. [Middleware](#7-middleware)
8. [Validation Schemas (Zod)](#8-validation-schemas-zod)
9. [Error Handling](#9-error-handling)
10. [Rate Limiting](#10-rate-limiting)
11. [Query Patterns](#11-query-patterns)

---

## 1. DATABASE SCHEMA

### 1.1 Tables Overview

```
auth.users (Supabase managed)
├── expenses
├── monthly_income
└── user_config
```

### 1.2 Complete SQL Schema

```sql
-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance

-- ============================================
-- EXPENSES TABLE
-- ============================================

CREATE TABLE expenses (
  -- Primary
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Amount & Currency
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 1),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),

  -- Classification
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL CHECK (length(description) <= 100),
  is_want BOOLEAN, -- NULL for "Pago de Tarjetas"

  -- Payment
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'DEBIT', 'TRANSFER', 'CREDIT')),
  card_id VARCHAR(50),

  -- Dates
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT no_credit_card_payment
    CHECK (category != 'Pago de Tarjetas' OR payment_method != 'CREDIT'),

  CONSTRAINT card_required_when_credit
    CHECK (
      (payment_method = 'CREDIT' AND card_id IS NOT NULL) OR
      (category = 'Pago de Tarjetas' AND card_id IS NOT NULL) OR
      (payment_method != 'CREDIT' AND category != 'Pago de Tarjetas')
    )
);

-- Indexes
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX idx_expenses_user_created ON expenses(user_id, created_at DESC);
CREATE INDEX idx_expenses_category ON expenses(user_id, category);
CREATE INDEX idx_expenses_is_want ON expenses(user_id, is_want) WHERE is_want IS NOT NULL;
CREATE INDEX idx_expenses_payment ON expenses(user_id, payment_method);
CREATE INDEX idx_expenses_currency ON expenses(user_id, currency);
CREATE INDEX idx_expenses_card ON expenses(user_id, card_id) WHERE card_id IS NOT NULL;

-- Composite index for dashboard queries
CREATE INDEX idx_expenses_dashboard ON expenses(
  user_id,
  date DESC,
  currency,
  category
) WHERE category != 'Pago de Tarjetas';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE expenses IS 'User expenses with multi-currency support';
COMMENT ON COLUMN expenses.is_want IS 'NULL for Pago de Tarjetas category';
COMMENT ON COLUMN expenses.card_id IS 'Required when payment_method=CREDIT or category=Pago de Tarjetas';

-- ============================================
-- MONTHLY_INCOME TABLE
-- ============================================

CREATE TABLE monthly_income (
  -- Primary
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Month (always first day)
  month DATE NOT NULL,

  -- Multi-currency income
  amount_ars DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount_ars >= 0),
  amount_usd DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),

  -- Dates
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique per user per month
  CONSTRAINT unique_user_month UNIQUE(user_id, month)
);

-- Indexes
CREATE INDEX idx_monthly_income_user_month ON monthly_income(user_id, month DESC);

-- Trigger for updated_at
CREATE TRIGGER monthly_income_updated_at
  BEFORE UPDATE ON monthly_income
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to normalize month to first day
CREATE OR REPLACE FUNCTION normalize_month()
RETURNS TRIGGER AS $$
BEGIN
  NEW.month = DATE_TRUNC('month', NEW.month)::DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_income_normalize_month
  BEFORE INSERT OR UPDATE ON monthly_income
  FOR EACH ROW
  EXECUTE FUNCTION normalize_month();

-- Comments
COMMENT ON TABLE monthly_income IS 'User monthly income in ARS and USD';
COMMENT ON COLUMN monthly_income.month IS 'Always first day of month (YYYY-MM-01)';

-- ============================================
-- USER_CONFIG TABLE
-- ============================================

CREATE TABLE user_config (
  -- Primary (one config per user)
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Currency preference
  default_currency VARCHAR(3) NOT NULL DEFAULT 'ARS' CHECK (default_currency IN ('ARS', 'USD')),

  -- Cards (JSONB array)
  cards JSONB NOT NULL DEFAULT '[
    {"id": "bbva_visa", "name": "BBVA VISA", "archived": false},
    {"id": "bbva_master", "name": "BBVA MÁSTER", "archived": false},
    {"id": "bna_master", "name": "BNA MASTER", "archived": false}
  ]'::jsonb,

  -- Dates
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER user_config_updated_at
  BEFORE UPDATE ON user_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Validation function for cards JSONB
CREATE OR REPLACE FUNCTION validate_cards_jsonb()
RETURNS TRIGGER AS $$
BEGIN
  -- Check cards is array
  IF jsonb_typeof(NEW.cards) != 'array' THEN
    RAISE EXCEPTION 'cards must be a JSON array';
  END IF;

  -- Check each card has required fields
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
  FOR EACH ROW
  EXECUTE FUNCTION validate_cards_jsonb();

-- Comments
COMMENT ON TABLE user_config IS 'User configuration and preferences';
COMMENT ON COLUMN user_config.cards IS 'Array of card objects: [{"id": "...", "name": "...", "archived": false}]';

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Active cards only
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
-- DATABASE STATISTICS
-- ============================================

-- Function to get table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  total_size TEXT,
  table_size TEXT,
  indexes_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) AS indexes_size
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT * FROM get_table_sizes();
```

---

## 2. ROW LEVEL SECURITY (RLS)

### 2.1 Enable RLS

```sql
-- Enable RLS on all tables
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;
```

### 2.2 Expenses Policies

```sql
-- ============================================
-- EXPENSES RLS POLICIES
-- ============================================

-- SELECT: Users can view own expenses
CREATE POLICY "expenses_select_policy"
  ON expenses
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create own expenses
CREATE POLICY "expenses_insert_policy"
  ON expenses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND amount >= 1
    AND length(description) <= 100
  );

-- UPDATE: Users can update own expenses
CREATE POLICY "expenses_update_policy"
  ON expenses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND amount >= 1
    AND length(description) <= 100
  );

-- DELETE: Users can delete own expenses
CREATE POLICY "expenses_delete_policy"
  ON expenses
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 2.3 Monthly Income Policies

```sql
-- ============================================
-- MONTHLY_INCOME RLS POLICIES
-- ============================================

-- SELECT: Users can view own income
CREATE POLICY "monthly_income_select_policy"
  ON monthly_income
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create own income entries
CREATE POLICY "monthly_income_insert_policy"
  ON monthly_income
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND amount_ars >= 0
    AND amount_usd >= 0
  );

-- UPDATE: Users can update own income
CREATE POLICY "monthly_income_update_policy"
  ON monthly_income
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND amount_ars >= 0
    AND amount_usd >= 0
  );

-- DELETE: Users can delete own income entries
CREATE POLICY "monthly_income_delete_policy"
  ON monthly_income
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 2.4 User Config Policies

```sql
-- ============================================
-- USER_CONFIG RLS POLICIES
-- ============================================

-- SELECT: Users can view own config
CREATE POLICY "user_config_select_policy"
  ON user_config
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create own config
CREATE POLICY "user_config_insert_policy"
  ON user_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update own config
CREATE POLICY "user_config_update_policy"
  ON user_config
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users cannot delete config (cascade on user delete)
CREATE POLICY "user_config_delete_policy"
  ON user_config
  FOR DELETE
  USING (false);
```

---

## 3. DATABASE FUNCTIONS

### 3.1 Dashboard Analytics

```sql
-- ============================================
-- DASHBOARD ANALYTICS FUNCTION
-- ============================================

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
        'ingresos', COALESCE(
          CASE
            WHEN p_currency = 'ARS' THEN amount_ars
            ELSE amount_usd
          END, 0
        ),
        'gastos_percibidos', COALESCE((
          SELECT SUM(amount)
          FROM expenses
          WHERE user_id = p_user_id
            AND currency = p_currency
            AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
            AND payment_method IN ('CASH', 'DEBIT', 'TRANSFER')
        ), 0),
        'pago_tarjetas', COALESCE((
          SELECT SUM(amount)
          FROM expenses
          WHERE user_id = p_user_id
            AND currency = p_currency
            AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
            AND category = 'Pago de Tarjetas'
        ), 0)
      )
      FROM monthly_income
      WHERE user_id = p_user_id
        AND month = DATE_TRUNC('month', p_month)
    ),

    'gastos_tarjeta', COALESCE((
      SELECT SUM(amount)
      FROM expenses
      WHERE user_id = p_user_id
        AND currency = p_currency
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        AND payment_method = 'CREDIT'
        AND category != 'Pago de Tarjetas'
    ), 0),

    'filtro_estoico', (
      SELECT json_build_object(
        'necesidad_count', COUNT(*) FILTER (WHERE is_want = false),
        'deseo_count', COUNT(*) FILTER (WHERE is_want = true),
        'total_count', COUNT(*)
      )
      FROM expenses
      WHERE user_id = p_user_id
        AND currency = p_currency
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
        AND category != 'Pago de Tarjetas'
        AND is_want IS NOT NULL
    ),

    'top_3', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          category,
          SUM(amount) AS total,
          COUNT(*) AS count
        FROM expenses
        WHERE user_id = p_user_id
          AND currency = p_currency
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
        SELECT
          id,
          amount,
          currency,
          category,
          description,
          is_want,
          payment_method,
          card_id,
          date,
          created_at
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

-- Usage:
-- SELECT get_dashboard_data(
--   'user-uuid',
--   '2026-02-01'::date,
--   'ARS'
-- );
```

### 3.2 Daily Expense Limit Check

```sql
-- ============================================
-- DAILY LIMIT CHECK
-- ============================================

CREATE OR REPLACE FUNCTION check_daily_expense_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM expenses
  WHERE user_id = p_user_id
    AND DATE(created_at) = CURRENT_DATE;

  RETURN v_count < 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage:
-- SELECT check_daily_expense_limit('user-uuid');
```

### 3.3 Duplicate Detection

```sql
-- ============================================
-- DUPLICATE DETECTION
-- ============================================

CREATE OR REPLACE FUNCTION detect_duplicate_expenses(
  p_user_id UUID,
  p_amount DECIMAL,
  p_category VARCHAR,
  p_date DATE
)
RETURNS TABLE (
  id UUID,
  description TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.description,
    e.created_at
  FROM expenses e
  WHERE e.user_id = p_user_id
    AND e.amount = p_amount
    AND e.category = p_category
    AND DATE(e.date) = p_date
  ORDER BY e.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage:
-- SELECT * FROM detect_duplicate_expenses(
--   'user-uuid',
--   2500.00,
--   'Restaurantes',
--   '2026-02-03'
-- );
```

---

## 4. API ENDPOINTS

### 4.1 API Routes Structure (implementadas en producción)

```
app/api/
├── expenses/
│   ├── route.ts              # POST (create), GET (list con filtros + paginación 20/pág)
│   ├── [id]/
│   │   └── route.ts          # PUT (inline edit), DELETE
│   └── duplicates/
│       └── route.ts          # GET — llama a detect_duplicate_expenses RPC
├── parse-expense/
│   └── route.ts              # POST (Gemini parsing)
├── monthly-income/
│   └── route.ts              # POST (upsert), GET (?month=YYYY-MM)
├── user-config/
│   └── route.ts              # GET, PUT (default_currency, cards)
├── export/
│   └── route.ts              # GET — CSV con BOM UTF-8 (Excel-compatible)
└── account/
    └── route.ts              # DELETE — elimina todos los datos + auth user (admin client)
```

**Nota:** No hay `/api/dashboard` en producción — el dashboard usa RPC directo de Supabase desde el Server Component (`get_dashboard_data(p_month DATE)`).

### 4.2 POST /api/expenses (Create)

**Request:**

```typescript
POST /api/expenses
Content-Type: application/json

{
  "amount": 2500,
  "currency": "ARS",
  "category": "Restaurantes",
  "description": "Café con amigos",
  "is_want": true,
  "payment_method": "CASH",
  "card_id": null,
  "date": "2026-02-03T10:30:00-03:00"
}
```

**Response (Success):**

```typescript
201 Created

{
  "id": "uuid",
  "user_id": "uuid",
  "amount": 2500,
  "currency": "ARS",
  "category": "Restaurantes",
  "description": "Café con amigos",
  "is_want": true,
  "payment_method": "CASH",
  "card_id": null,
  "date": "2026-02-03T10:30:00-03:00",
  "created_at": "2026-02-03T10:30:15-03:00",
  "updated_at": "2026-02-03T10:30:15-03:00"
}
```

**Response (Error):**

```typescript
400 Bad Request

{
  "error": "Validation failed",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be at least 1"
    }
  ]
}
```

**Implementation:**

```typescript
// app/api/expenses/route.ts
import { createClient } from '@/lib/supabase/server'
import { ExpenseSchema } from '@/lib/validation/schemas'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse & validate body
    const body = await request.json()
    const validated = ExpenseSchema.parse(body)

    // Check daily limit
    const { data: limitCheck } = await supabase.rpc(
      'check_daily_expense_limit',
      {
        p_user_id: user.id,
      }
    )

    if (!limitCheck) {
      return NextResponse.json(
        { error: 'Daily limit reached (50 expenses)' },
        { status: 429 }
      )
    }

    // Insert expense
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        ...validated,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create expense error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 4.3 GET /api/expenses (List)

**Request:**

```typescript
GET /api/expenses?month=2026-02&currency=ARS&limit=20&offset=0
```

**Query Parameters:**

- `month` (required): YYYY-MM
- `currency` (optional): ARS | USD | ALL
- `category` (optional): filter by category
- `payment_method` (optional): CASH | DEBIT | TRANSFER | CREDIT
- `limit` (optional): default 20
- `offset` (optional): default 0

**Response:**

```typescript
200 OK

{
  "expenses": [
    {
      "id": "uuid",
      "amount": 2500,
      "currency": "ARS",
      "category": "Restaurantes",
      "description": "Café con amigos",
      "is_want": true,
      "payment_method": "CASH",
      "card_id": null,
      "date": "2026-02-03T10:30:00-03:00",
      "created_at": "2026-02-03T10:30:15-03:00"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### 4.4 PUT /api/expenses/[id] (Update)

**Request:**

```typescript
PUT /api/expenses/uuid-here
Content-Type: application/json

{
  "amount": 3000,
  "category": "Supermercado",
  "is_want": false
}
```

**Response:**

```typescript
200 OK

{
  "id": "uuid",
  "amount": 3000,
  "category": "Supermercado",
  "is_want": false,
  ...
  "updated_at": "2026-02-03T11:00:00-03:00"
}
```

### 4.5 DELETE /api/expenses/[id]

**Request:**

```typescript
DELETE / api / expenses / uuid - here
```

**Response:**

```typescript
204 No Content
```

### 4.6 POST /api/parse-expense (Gemini)

**Request:**

```typescript
POST /api/parse-expense
Content-Type: application/json

{
  "input": "café 2500 con amigos"
}
```

**Response (Success):**

```typescript
200 OK

{
  "amount": 2500,
  "currency": "ARS",
  "category": "Restaurantes",
  "description": "Café con amigos",
  "is_want": true,
  "payment_method": "CASH",
  "card_id": null,
  "date": "2026-02-03T10:30:00-03:00",
  "is_valid": true
}
```

**Response (Invalid Input):**

```typescript
200 OK

{
  "is_valid": false,
  "reason": "El input no parece ser un gasto"
}
```

**Implementation:**

```typescript
// app/api/parse-expense/route.ts
// Modelo: gemini-2.5-flash-lite, apiVersion: v1 (no v1beta — sin free tier)
// Sin responseMimeType — no soportado en v1
import { model } from '@/lib/gemini/client'
import { ParsedExpenseSchema } from '@/lib/validation/schemas'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { input } = await request.json()

    if (!input || input.trim().length === 0) {
      return NextResponse.json({
        is_valid: false,
        reason: 'Input vacío',
      })
    }

    // Call Gemini
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: createPrompt(input) }],
        },
      ],
      generationConfig: { temperature: 0.1 },
      // NO responseMimeType — no soportado en v1
    })

    // Strip markdown code fences que Gemini agrega a veces
    const raw = result.response.text()
    const clean = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(clean)

    // Validate with Zod
    const validated = ParsedExpenseSchema.parse(parsed)

    return NextResponse.json(validated)
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({
      is_valid: false,
      reason: 'Error al procesar el input',
    })
  }
}

function createPrompt(input: string): string {
  return `
Sos un asistente que parsea gastos en español argentino.

Input: "${input}"

Extrae:
- amount (número, mínimo 1)
- currency ("ARS" o "USD", default ARS)
- category (de la lista de 21 categorías)
- description (max 100 chars)
- is_want (boolean, true si es deseo/impulso)
- payment_method ("CASH", "DEBIT", "TRANSFER", "CREDIT")
- card_id (string o null)
- date (ISO 8601 con timezone, default hoy)

Keywords de moneda:
- "dólares", "USD", "usd" → USD
- Default → ARS

Payment method keywords:
- "efectivo", "cash" → CASH
- "débito" → DEBIT
- "transferencia" → TRANSFER
- "tarjeta", "crédito", "credito" → CREDIT

Tarjetas reconocidas:
- "BBVA VISA" → "bbva_visa"
- "BBVA MÁSTER" → "bbva_master"
- "BNA" → "bna_master"

Fechas relativas (hoy = 2026-02-03):
- "ayer" → 2026-02-02
- "anteayer" → 2026-02-01
- Sin mención → hoy

Responde SOLO con JSON válido.
Si el input no parece ser un gasto, devuelve:
{"is_valid": false, "reason": "..."}
`
}
```

### 4.7 POST /api/monthly-income (Upsert)

**Request:**

```typescript
POST /api/monthly-income
Content-Type: application/json

{
  "month": "2026-02-01",
  "amount_ars": 1000000,
  "amount_usd": 500
}
```

**Response:**

```typescript
200 OK

{
  "id": "uuid",
  "user_id": "uuid",
  "month": "2026-02-01",
  "amount_ars": 1000000,
  "amount_usd": 500,
  "created_at": "2026-02-03T10:00:00-03:00",
  "updated_at": "2026-02-03T10:00:00-03:00"
}
```

### 4.8 GET /api/dashboard

**Request:**

```typescript
GET /api/dashboard?month=2026-02&currency=ARS
```

**Response:**

```typescript
200 OK

{
  "saldo_vivo": {
    "ingresos": 1000000,
    "gastos_percibidos": 14500,
    "pago_tarjetas": 320000,
    "disponible": 665500
  },
  "gastos_tarjeta": 0,
  "filtro_estoico": {
    "necesidad_count": 1,
    "deseo_count": 1,
    "total_count": 2
  },
  "top_3": [
    {
      "category": "Auto/Combustible",
      "total": 12000,
      "count": 1
    },
    {
      "category": "Restaurantes",
      "total": 2500,
      "count": 1
    }
  ],
  "ultimos_5": [
    { /* expense object */ }
  ]
}
```

---

## 5. SERVER ACTIONS

### 5.1 Create Expense Action

```typescript
// app/actions/expenses.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { ExpenseSchema } from '@/lib/validation/schemas'
import { revalidatePath } from 'next/cache'

export async function createExpense(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const validated = ExpenseSchema.parse({
      amount: Number(formData.get('amount')),
      currency: formData.get('currency'),
      category: formData.get('category'),
      description: formData.get('description'),
      is_want: formData.get('is_want') === 'true',
      payment_method: formData.get('payment_method'),
      card_id: formData.get('card_id') || null,
      date: formData.get('date'),
    })

    const { data, error } = await supabase
      .from('expenses')
      .insert({ user_id: user.id, ...validated })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/')
    return { data }
  } catch (error) {
    return { error: 'Failed to create expense' }
  }
}
```

### 5.2 Update Expense Action

```typescript
'use server'

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/')
    return { data }
  } catch (error) {
    return { error: 'Failed to update expense' }
  }
}
```

### 5.3 Delete Expense Action

```typescript
'use server'

export async function deleteExpense(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { error: 'Failed to delete expense' }
  }
}
```

---

## 6. AUTHENTICATION FLOW

### 6.1 Login Flow

```
1. User clicks "Continuar con Google"
   → Redirect to Supabase Auth

2. Supabase → Google OAuth

3. User authorizes

4. Callback to /auth/callback
   → Exchange code for session

5. Redirect to / (dashboard)
   → Middleware checks auth

6. If first time:
   → Show "Configurar Saldo Vivo" modal
   → Create user_config entry

7. Dashboard loads
```

### 6.2 Auth Routes

**app/(auth)/login/page.tsx**

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return <LoginUI />;
}
```

**app/(auth)/callback/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/', request.url))
}
```

### 6.3 Supabase Client (Server)

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component
          }
        },
      },
    }
  )
}
```

### 6.4 Supabase Client (Client)

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

## 7. PROXY (Auth Middleware)

**Nota Next.js 16:** `middleware.ts` se renombró a `proxy.ts` y la función exportada debe llamarse `proxy`, no `middleware`.

### 7.1 Auth Proxy

```typescript
// proxy.ts  ← nombre correcto en Next.js 16
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes — CRÍTICO: excluir /auth/ para que el OAuth callback funcione
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth/')
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-in users away from login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  // Excluir manifest.json y sw.js para que la PWA funcione sin auth
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## 8. VALIDATION SCHEMAS (ZOD)

### 8.1 Expense Schema

```typescript
// lib/validation/schemas.ts
import { z } from 'zod'

export const ExpenseSchema = z
  .object({
    amount: z.number().min(1, 'Amount must be at least 1'),
    currency: z.enum(['ARS', 'USD']),
    category: z.string().min(1, 'Category required'),
    description: z.string().max(100, 'Description max 100 chars'),
    is_want: z.boolean().nullable(),
    payment_method: z.enum(['CASH', 'DEBIT', 'TRANSFER', 'CREDIT']),
    card_id: z.string().nullable(),
    date: z.string().datetime(),
  })
  .refine(
    (data) => {
      // Tarjeta required cuando CREDIT
      if (data.payment_method === 'CREDIT' && !data.card_id) {
        return false
      }
      // Tarjeta required para Pago de Tarjetas
      if (data.category === 'Pago de Tarjetas' && !data.card_id) {
        return false
      }
      return true
    },
    {
      message:
        'card_id required when payment_method is CREDIT or category is Pago de Tarjetas',
    }
  )

export type Expense = z.infer<typeof ExpenseSchema>
```

### 8.2 Parsed Expense Schema (Gemini)

```typescript
export const ParsedExpenseSchema = z.union([
  z.object({
    is_valid: z.literal(true),
    amount: z.number().min(1),
    currency: z.enum(['ARS', 'USD']),
    category: z.string(),
    description: z.string().max(100),
    is_want: z.boolean().nullable(),
    payment_method: z.enum(['CASH', 'DEBIT', 'TRANSFER', 'CREDIT']),
    card_id: z.string().nullable(),
    date: z.string().datetime(),
  }),
  z.object({
    is_valid: z.literal(false),
    reason: z.string(),
  }),
])

export type ParsedExpense = z.infer<typeof ParsedExpenseSchema>
```

### 8.3 Monthly Income Schema

```typescript
export const MonthlyIncomeSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/), // YYYY-MM-01
  amount_ars: z.number().min(0),
  amount_usd: z.number().min(0),
})
```

### 8.4 User Config Schema

```typescript
export const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean().optional().default(false),
})

export const UserConfigSchema = z.object({
  default_currency: z.enum(['ARS', 'USD']),
  cards: z.array(CardSchema).min(1),
})
```

---

## 9. ERROR HANDLING

### 9.1 Standard Error Response

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
}
```

### 9.2 Error Handler Wrapper

```typescript
export function withErrorHandler(handler: Function) {
  return async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message, details: error.details },
          { status: error.statusCode }
        )
      }

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        )
      }

      console.error('Unhandled error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
```

---

## 10. RATE LIMITING

### 10.1 Redis-based Rate Limiter (Optional)

```typescript
// lib/rate-limit.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

export async function rateLimit(
  identifier: string,
  limit: number,
  window: number
): Promise<boolean> {
  const key = `rate_limit:${identifier}`
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, window)
  }

  return count <= limit
}

// Usage:
// const allowed = await rateLimit(user.id, 15, 60); // 15 req/min
```

### 10.2 In-Memory Rate Limiter (Simple)

```typescript
// lib/rate-limit-simple.ts
const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const record = store.get(identifier)

  if (!record || now > record.resetAt) {
    store.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    })
    return true
  }

  if (record.count < limit) {
    record.count++
    return true
  }

  return false
}

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key)
      }
    }
  },
  5 * 60 * 1000
)
```

---

## 11. QUERY PATTERNS

### 11.1 Dashboard Query (Optimized)

```typescript
// Single query approach
const { data: expenses } = await supabase
  .from('expenses')
  .select('*')
  .eq('user_id', userId)
  .gte('date', startOfMonth)
  .lte('date', endOfMonth)

// Calculate in React
const gastosPercibidos = expenses
  .filter((e) => ['CASH', 'DEBIT', 'TRANSFER'].includes(e.payment_method))
  .reduce((sum, e) => sum + e.amount, 0)

const pagoTarjetas = expenses
  .filter((e) => e.category === 'Pago de Tarjetas')
  .reduce((sum, e) => sum + e.amount, 0)

const top3 = Object.entries(
  expenses
    .filter((e) => e.category !== 'Pago de Tarjetas')
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount
      return acc
    }, {})
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
```

### 11.2 Expenses List with Pagination

```typescript
const { data, count } = await supabase
  .from('expenses')
  .select('*', { count: 'exact' })
  .eq('user_id', userId)
  .gte('date', startOfMonth)
  .lte('date', endOfMonth)
  .order('date', { ascending: false })
  .range(offset, offset + limit - 1)
```

### 11.3 Filtered Expenses

```typescript
let query = supabase.from('expenses').select('*').eq('user_id', userId)

if (category) {
  query = query.eq('category', category)
}

if (payment_method) {
  query = query.eq('payment_method', payment_method)
}

if (currency && currency !== 'ALL') {
  query = query.eq('currency', currency)
}

const { data } = await query
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date', { ascending: false })
```

---

## SUMMARY

### Database

- ✅ 3 tables (expenses, monthly_income, user_config)
- ✅ RLS enabled on all tables
- ✅ Triggers for updated_at
- ✅ Validation functions
- ✅ Helper functions (dashboard analytics, duplicate detection)

### API

- ✅ 8 main endpoints (expenses CRUD, parse, income, config, dashboard)
- ✅ Proper validation (Zod)
- ✅ Error handling
- ✅ Rate limiting

### Auth

- ✅ Google OAuth only
- ✅ Session-based (Supabase Auth)
- ✅ Middleware protection
- ✅ RLS at database level

### Best Practices

- ✅ TypeScript throughout
- ✅ Zod validation
- ✅ Server Components when possible
- ✅ Server Actions for mutations
- ✅ Proper error handling
- ✅ Security (RLS, auth checks)

---

**FIN DEL BACKEND STRUCTURE v1.0 — Gota**

Este documento refleja el estado real del backend deployado en producción.
