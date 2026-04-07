export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      subscriptions: {
        Row: {
          id: string
          user_id: string
          description: string
          category: string
          amount: number
          currency: 'ARS' | 'USD'
          payment_method: 'DEBIT' | 'CREDIT'
          card_id: string | null
          account_id: string | null
          day_of_month: number
          is_active: boolean
          created_at: string
          last_reviewed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          category: string
          amount: number
          currency?: 'ARS' | 'USD'
          payment_method?: 'DEBIT' | 'CREDIT'
          card_id?: string | null
          account_id?: string | null
          day_of_month?: number
          is_active?: boolean
          created_at?: string
          last_reviewed_at?: string
        }
        Update: {
          description?: string
          category?: string
          amount?: number
          currency?: 'ARS' | 'USD'
          payment_method?: 'DEBIT' | 'CREDIT'
          card_id?: string | null
          account_id?: string | null
          day_of_month?: number
          is_active?: boolean
          last_reviewed_at?: string
        }
        Relationships: []
      }
      subscription_insertions: {
        Row: {
          id: string
          subscription_id: string
          month: string
          expense_id: string | null
          inserted_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          month: string
          expense_id?: string | null
          inserted_at?: string
        }
        Update: {
          expense_id?: string | null
        }
        Relationships: []
      }
      recurring_incomes: {
        Row: {
          id: string
          user_id: string
          amount: number
          currency: 'ARS' | 'USD'
          category: 'salary' | 'freelance' | 'other'
          description: string
          account_id: string | null
          day_of_month: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          currency?: 'ARS' | 'USD'
          category?: 'salary' | 'freelance' | 'other'
          description?: string
          account_id?: string | null
          day_of_month: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          currency?: 'ARS' | 'USD'
          category?: 'salary' | 'freelance' | 'other'
          description?: string
          account_id?: string | null
          day_of_month?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          id: string
          user_id: string
          account_id: string | null
          amount: number
          currency: 'ARS' | 'USD'
          description: string
          category: 'salary' | 'freelance' | 'other'
          date: string
          created_at: string
          recurring_income_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          amount: number
          currency?: 'ARS' | 'USD'
          description?: string
          category?: 'salary' | 'freelance' | 'other'
          date?: string
          created_at?: string
          recurring_income_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          currency?: 'ARS' | 'USD'
          description?: string
          category?: 'salary' | 'freelance' | 'other'
          date?: string
          recurring_income_id?: string | null
        }
        Relationships: []
      }
      account_period_balance: {
        Row: {
          account_id: string
          period: string
          balance_ars: number
          balance_usd: number
          source: 'opening' | 'rollover_auto' | 'manual'
          updated_at: string
        }
        Insert: {
          account_id: string
          period: string
          balance_ars?: number
          balance_usd?: number
          source?: 'opening' | 'rollover_auto' | 'manual'
          updated_at?: string
        }
        Update: {
          balance_ars?: number
          balance_usd?: number
          source?: 'opening' | 'rollover_auto' | 'manual'
          updated_at?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          id: string
          user_id: string
          from_account_id: string
          to_account_id: string
          amount_from: number
          amount_to: number
          currency_from: 'ARS' | 'USD'
          currency_to: 'ARS' | 'USD'
          exchange_rate: number | null
          date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          from_account_id: string
          to_account_id: string
          amount_from: number
          amount_to: number
          currency_from: 'ARS' | 'USD'
          currency_to: 'ARS' | 'USD'
          exchange_rate?: number | null
          date: string
          note?: string | null
          created_at?: string
        }
        Update: {
          note?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          amount: number
          currency: 'ARS' | 'USD'
          category: string
          description: string
          is_want: boolean | null
          is_legacy_card_payment: boolean | null
          payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
          card_id: string | null
          account_id: string | null
          date: string
          created_at: string
          updated_at: string
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          amount: number
          currency?: 'ARS' | 'USD'
          category: string
          description: string
          is_want?: boolean | null
          is_legacy_card_payment?: boolean | null
          payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
          card_id?: string | null
          account_id?: string | null
          date?: string
          created_at?: string
          updated_at?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string | null
          amount?: number
          currency?: 'ARS' | 'USD'
          category?: string
          description?: string
          is_want?: boolean | null
          is_legacy_card_payment?: boolean | null
          payment_method?: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
          card_id?: string | null
          account_id?: string | null
          date?: string
          created_at?: string
          updated_at?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
        }
        Relationships: []
      }
      cards: {
        Row: {
          id: string
          user_id: string
          name: string
          closing_day: number | null
          due_day: number
          account_id: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          closing_day?: number | null
          due_day?: number
          account_id?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          closing_day?: number | null
          due_day?: number
          account_id?: string | null
          archived?: boolean
        }
        Relationships: []
      }
      card_cycles: {
        Row: {
          id: string
          user_id: string
          card_id: string
          period_month: string
          closing_date: string
          due_date: string
          status: 'open' | 'closed' | 'paid'
          amount_draft: number | null
          amount_paid: number | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          period_month: string
          closing_date: string
          due_date: string
          status?: 'open' | 'closed' | 'paid'
          amount_draft?: number | null
          amount_paid?: number | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          period_month?: string
          closing_date?: string
          due_date?: string
          status?: 'open' | 'closed' | 'paid'
          amount_draft?: number | null
          amount_paid?: number | null
          paid_at?: string | null
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'bank' | 'cash' | 'digital'
          is_primary: boolean
          archived: boolean
          opening_balance_ars: number
          opening_balance_usd: number
          daily_yield_enabled: boolean
          daily_yield_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'bank' | 'cash' | 'digital'
          is_primary?: boolean
          archived?: boolean
          opening_balance_ars?: number
          opening_balance_usd?: number
          daily_yield_enabled?: boolean
          daily_yield_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'bank' | 'cash' | 'digital'
          is_primary?: boolean
          archived?: boolean
          opening_balance_ars?: number
          opening_balance_usd?: number
          daily_yield_enabled?: boolean
          daily_yield_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      yield_accumulator: {
        Row: {
          id: string
          user_id: string
          account_id: string
          month: string
          accumulated: number
          is_manual_override: boolean
          last_accrued_date: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          month: string
          accumulated?: number
          is_manual_override?: boolean
          last_accrued_date?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          accumulated?: number
          is_manual_override?: boolean
          last_accrued_date?: string | null
          confirmed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          id: string
          user_id: string
          type: 'plazo_fijo' | 'fci'
          label: string | null
          amount: number
          currency: 'ARS' | 'USD'
          rate: number | null
          account_id: string | null
          opened_at: string
          due_date: string | null
          status: 'active' | 'closed'
          closed_at: string | null
          closed_amount: number | null
          auto_egress_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'plazo_fijo' | 'fci'
          label?: string | null
          amount: number
          currency?: 'ARS' | 'USD'
          rate?: number | null
          account_id?: string | null
          opened_at: string
          due_date?: string | null
          status?: 'active' | 'closed'
          closed_at?: string | null
          closed_amount?: number | null
          auto_egress_id?: string | null
          created_at?: string
        }
        Update: {
          type?: 'plazo_fijo' | 'fci'
          label?: string | null
          amount?: number
          currency?: 'ARS' | 'USD'
          rate?: number | null
          account_id?: string | null
          opened_at?: string
          due_date?: string | null
          status?: 'active' | 'closed'
          closed_at?: string | null
          closed_amount?: number | null
          auto_egress_id?: string | null
        }
        Relationships: []
      }
      monthly_income: {
        Row: {
          id: string
          user_id: string
          month: string
          amount_ars: number
          amount_usd: number
          saldo_inicial_ars: number
          saldo_inicial_usd: number
          closed: boolean
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          amount_ars?: number
          amount_usd?: number
          saldo_inicial_ars?: number
          saldo_inicial_usd?: number
          closed?: boolean
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          amount_ars?: number
          amount_usd?: number
          saldo_inicial_ars?: number
          saldo_inicial_usd?: number
          closed?: boolean
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_config: {
        Row: {
          user_id: string
          default_currency: 'ARS' | 'USD'
          cards: Json
          onboarding_completed: boolean
          rollover_mode: 'auto' | 'manual' | 'off'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          default_currency?: 'ARS' | 'USD'
          cards?: Json
          onboarding_completed?: boolean
          rollover_mode?: 'auto' | 'manual' | 'off'
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          default_currency?: 'ARS' | 'USD'
          cards?: Json
          onboarding_completed?: boolean
          rollover_mode?: 'auto' | 'manual' | 'off'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_active_cards: {
        Row: {
          user_id: string | null
          cards: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_dashboard_data: {
        Args: {
          p_user_id: string
          p_month: string
          p_currency: 'ARS' | 'USD'
        }
        Returns: Json
      }
      check_daily_expense_limit: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      detect_duplicate_expenses: {
        Args: {
          p_user_id: string
          p_amount: number
          p_category: string
          p_date: string
        }
        Returns: {
          id: string
          description: string
          created_at: string
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ============================================
// CONVENIENCE TYPES
// ============================================

export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']

export type MonthlyIncome =
  Database['public']['Tables']['monthly_income']['Row']
export type MonthlyIncomeInsert =
  Database['public']['Tables']['monthly_income']['Insert']
export type MonthlyIncomeUpdate =
  Database['public']['Tables']['monthly_income']['Update']

export type UserConfig = Database['public']['Tables']['user_config']['Row']
export type RolloverMode = 'auto' | 'manual' | 'off'

export type Account = Database['public']['Tables']['accounts']['Row']
export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type AccountUpdate = Database['public']['Tables']['accounts']['Update']
export type AccountType = 'bank' | 'cash' | 'digital'

export type YieldAccumulator = Database['public']['Tables']['yield_accumulator']['Row']
export type YieldAccumulatorInsert = Database['public']['Tables']['yield_accumulator']['Insert']
export type YieldAccumulatorUpdate = Database['public']['Tables']['yield_accumulator']['Update']

export type IncomeCategory = 'salary' | 'freelance' | 'other'

export type IncomeEntry = {
  id: string
  user_id: string
  account_id: string | null
  amount: number
  currency: 'ARS' | 'USD'
  description: string
  category: IncomeCategory
  date: string
  created_at: string
  recurring_income_id: string | null
}

export type IncomeEntryInsert = {
  account_id?: string | null
  amount: number
  currency?: 'ARS' | 'USD'
  description?: string
  category?: IncomeCategory
  date?: string
  recurring_income_id?: string | null
}

export type RecurringIncome       = Database['public']['Tables']['recurring_incomes']['Row']
export type RecurringIncomeInsert = Database['public']['Tables']['recurring_incomes']['Insert']
export type RecurringIncomeUpdate = Database['public']['Tables']['recurring_incomes']['Update']

export type AccountPeriodBalance = {
  account_id: string
  period: string // YYYY-MM-01
  balance_ars: number
  balance_usd: number
  source: 'opening' | 'rollover_auto' | 'manual'
  updated_at: string
}

export type Subscription = {
  id: string
  user_id: string
  description: string
  category: string
  amount: number
  currency: 'ARS' | 'USD'
  payment_method: 'DEBIT' | 'CREDIT'
  card_id: string | null
  account_id: string | null
  day_of_month: number
  is_active: boolean
  created_at: string
  last_reviewed_at: string
}

export type SubscriptionInsertion = {
  id: string
  subscription_id: string
  month: string
  expense_id: string | null
  inserted_at: string
}

export type Card       = Database['public']['Tables']['cards']['Row']
export type CardInsert = Database['public']['Tables']['cards']['Insert']
export type CardUpdate = Database['public']['Tables']['cards']['Update']
export type CardCycle = Database['public']['Tables']['card_cycles']['Row']
export type CardCycleInsert = Database['public']['Tables']['card_cycles']['Insert']
export type CardCycleUpdate = Database['public']['Tables']['card_cycles']['Update']

export type InstrumentType   = 'plazo_fijo' | 'fci'
export type InstrumentStatus = 'active' | 'closed'
export type Instrument       = Database['public']['Tables']['instruments']['Row']
export type InstrumentInsert = Database['public']['Tables']['instruments']['Insert']
export type InstrumentUpdate = Database['public']['Tables']['instruments']['Update']

export type Currency = 'ARS' | 'USD'
export type PaymentMethod = 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'

export type Category =
  | 'Supermercado'
  | 'Alimentos'
  | 'Restaurantes'
  | 'Delivery'
  | 'Kiosco y Varios'
  | 'Casa/Mantenimiento'
  | 'Muebles y Hogar'
  | 'Servicios del Hogar'
  | 'Auto/Combustible'
  | 'Auto/Mantenimiento'
  | 'Transporte'
  | 'Salud'
  | 'Farmacia'
  | 'Educación'
  | 'Ropa e Indumentaria'
  | 'Cuidado Personal'
  | 'Suscripciones'
  | 'Regalos'
  | 'Transferencias Familiares'
  | 'Entretenimiento'
  | 'Mascotas'
  | 'Hijos'
  | 'Otros'
  | 'Pago de Tarjetas'

// ============================================
// DASHBOARD TYPES
// ============================================

export type DashboardData = {
  saldo_vivo: {
    saldo_inicial: number
    ingresos: number
    gastos_percibidos: number
    pago_tarjetas: number
    rendimientos: number  // yield acumulado del mes — GOT-30
  } | null
  gastos_tarjeta: number
  filtro_estoico: {
    necesidad_count: number
    deseo_count: number
    total_count: number
    necesidad_amount: number
    deseo_amount: number
  }
  top_3:
    | {
        category: string
        total: number
        count: number
      }[]
    | null
  ultimos_5: Expense[] | null
}

// ============================================
// TRANSFER TYPES
// ============================================

export type Transfer = {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string
  amount_from: number
  amount_to: number
  currency_from: 'ARS' | 'USD'
  currency_to: 'ARS' | 'USD'
  exchange_rate: number | null
  date: string
  note: string | null
  created_at: string
}

export type TransferInsert = Omit<Transfer, 'id' | 'user_id' | 'created_at'>
