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
          date: string
          created_at: string
          updated_at: string
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
          date?: string
          created_at?: string
          updated_at?: string
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
          date?: string
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
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          default_currency?: 'ARS' | 'USD'
          cards?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          default_currency?: 'ARS' | 'USD'
          cards?: Json
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

export type Card = {
  id: string
  name: string
  archived?: boolean
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
