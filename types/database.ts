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
        }
        Update: {
          account_id?: string | null
          amount?: number
          currency?: 'ARS' | 'USD'
          description?: string
          category?: 'salary' | 'freelance' | 'other'
          date?: string
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
          amount: number
          currency: 'ARS' | 'USD'
          category: string
          description: string
          is_want: boolean | null
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
          amount: number
          currency?: 'ARS' | 'USD'
          category: string
          description: string
          is_want?: boolean | null
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
          amount?: number
          currency?: 'ARS' | 'USD'
          category?: string
          description?: string
          is_want?: boolean | null
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
          created_at?: string
          updated_at?: string
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
}

export type IncomeEntryInsert = {
  account_id?: string | null
  amount: number
  currency?: 'ARS' | 'USD'
  description?: string
  category?: IncomeCategory
  date?: string
}

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

export type Card = {
  id: string
  name: string
  archived?: boolean
  closing_day?: number // día del mes de cierre (1–31)
}

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
