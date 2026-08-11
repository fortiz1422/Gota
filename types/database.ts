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
      device_access_tokens: {
        Row: {
          id: string
          user_id: string
          label: string
          token_hash: string
          scopes: string[]
          created_at: string
          last_seen_at: string | null
          revoked_at: string | null
          revoked_reason: string | null
        }
        Insert: {
          id?: string
          user_id: string
          label: string
          token_hash: string
          scopes?: string[]
          created_at?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
        }
        Update: {
          label?: string
          scopes?: string[]
          last_seen_at?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
        }
        Relationships: []
      }
      product_events: {
        Row: {
          id: string
          user_id: string
          event_name: string
          properties: Json
          session_id: string | null
          path: string | null
          is_anonymous: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_name: string
          properties?: Json
          session_id?: string | null
          path?: string | null
          is_anonymous?: boolean
          created_at?: string
        }
        Update: {
          event_name?: string
          properties?: Json
          session_id?: string | null
          path?: string | null
          is_anonymous?: boolean
        }
        Relationships: []
      }
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
          source: 'rollover_auto'
          updated_at: string
        }
        Insert: {
          account_id: string
          period: string
          balance_ars?: number
          balance_usd?: number
          source?: 'rollover_auto'
          updated_at?: string
        }
        Update: {
          balance_ars?: number
          balance_usd?: number
          source?: 'rollover_auto'
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
          id?: string
          user_id?: string
          from_account_id?: string
          to_account_id?: string
          amount_from?: number
          amount_to?: number
          currency_from?: 'ARS' | 'USD'
          currency_to?: 'ARS' | 'USD'
          exchange_rate?: number | null
          date?: string
          note?: string | null
          created_at?: string
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
          is_recurring: boolean | null
          is_extraordinary: boolean | null
          is_legacy_card_payment: boolean | null
          payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
          card_id: string | null
          card_cycle_id: string | null
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
          is_recurring?: boolean | null
          is_extraordinary?: boolean | null
          is_legacy_card_payment?: boolean | null
          payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
          card_id?: string | null
          card_cycle_id?: string | null
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
          is_recurring?: boolean | null
          is_extraordinary?: boolean | null
          is_legacy_card_payment?: boolean | null
          payment_method?: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
          card_id?: string | null
          card_cycle_id?: string | null
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
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          emoji: string | null
          color_token: string | null
          target_amount: number
          currency: 'ARS' | 'USD'
          target_date: string | null
          starting_amount: number
          planned_monthly_contribution: number | null
          linked_account_id: string | null
          notes: string | null
          status: 'active' | 'paused' | 'completed' | 'archived'
          created_at: string
          updated_at: string
          completed_at: string | null
          paused_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          emoji?: string | null
          color_token?: string | null
          target_amount: number
          currency: 'ARS' | 'USD'
          target_date?: string | null
          starting_amount?: number
          planned_monthly_contribution?: number | null
          linked_account_id?: string | null
          notes?: string | null
          status?: 'active' | 'paused' | 'completed' | 'archived'
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          paused_at?: string | null
        }
        Update: {
          name?: string
          emoji?: string | null
          color_token?: string | null
          target_amount?: number
          target_date?: string | null
          planned_monthly_contribution?: number | null
          linked_account_id?: string | null
          notes?: string | null
          status?: 'active' | 'paused' | 'completed' | 'archived'
          updated_at?: string
          completed_at?: string | null
          paused_at?: string | null
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          amount: number
          currency: 'ARS' | 'USD'
          contributed_at: string
          source_type: 'manual' | 'transfer_linked' | 'income_linked' | 'adjustment'
          source_account_id: string | null
          availability_effect: 'none' | 'committed_only' | 'moved_out'
          destination_kind: 'same_account' | 'tracked_account' | 'external_pot' | 'virtual_pot' | null
          note: string | null
          related_transfer_id: string | null
          related_income_entry_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          goal_id: string
          user_id: string
          amount: number
          currency: 'ARS' | 'USD'
          contributed_at: string
          source_type?: 'manual' | 'transfer_linked' | 'income_linked' | 'adjustment'
          source_account_id?: string | null
          availability_effect?: 'none' | 'committed_only' | 'moved_out'
          destination_kind?: 'same_account' | 'tracked_account' | 'external_pot' | 'virtual_pot' | null
          note?: string | null
          related_transfer_id?: string | null
          related_income_entry_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contributed_at?: string
          source_type?: 'manual' | 'transfer_linked' | 'income_linked' | 'adjustment'
          source_account_id?: string | null
          availability_effect?: 'none' | 'committed_only' | 'moved_out'
          destination_kind?: 'same_account' | 'tracked_account' | 'external_pot' | 'virtual_pot' | null
          note?: string | null
          related_transfer_id?: string | null
          related_income_entry_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      budget_plans: {
        Row: {
          id: string
          user_id: string
          period_month: string
          base_currency: 'ARS' | 'USD'
          status: 'active'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period_month: string
          base_currency?: 'ARS' | 'USD'
          status?: 'active'
          created_at?: string
          updated_at?: string
        }
        Update: {
          period_month?: string
          base_currency?: 'ARS' | 'USD'
          status?: 'active'
          updated_at?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          category: string
          amount: number
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id: string
          category: string
          amount: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          plan_id?: string
          user_id?: string
          category?: string
          amount?: number
          sort_order?: number
          updated_at?: string
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
          dates_confirmed_at: string | null
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
          dates_confirmed_at?: string | null
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
          dates_confirmed_at?: string | null
        }
        Relationships: []
      }
      card_payment_allocations: {
        Row: {
          id: string
          user_id: string
          expense_id: string
          card_cycle_id: string
          amount_applied: number
          currency: string | null
          exchange_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          expense_id: string
          card_cycle_id: string
          amount_applied: number
          currency?: string | null
          exchange_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          expense_id?: string
          card_cycle_id?: string
          amount_applied?: number
          currency?: string | null
          exchange_rate?: number | null
        }
        Relationships: []
      }
      card_cycle_amounts: {
        Row: {
          id: string
          user_id: string
          card_cycle_id: string
          currency: 'ARS' | 'USD'
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
          card_cycle_id: string
          currency: 'ARS' | 'USD'
          status?: 'open' | 'closed' | 'paid'
          amount_draft?: number | null
          amount_paid?: number | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          card_cycle_id?: string
          currency?: 'ARS' | 'USD'
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
          daily_yield_provider: string | null
          daily_yield_cap_amount: number | null
          daily_yield_checkin_interval_days: number
          daily_yield_last_checkin_at: string | null
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
          daily_yield_provider?: string | null
          daily_yield_cap_amount?: number | null
          daily_yield_checkin_interval_days?: number
          daily_yield_last_checkin_at?: string | null
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
          daily_yield_provider?: string | null
          daily_yield_cap_amount?: number | null
          daily_yield_checkin_interval_days?: number
          daily_yield_last_checkin_at?: string | null
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
      yield_daily_entries: {
        Row: {
          id: string
          user_id: string
          account_id: string
          date: string
          currency: 'ARS' | 'USD'
          expected_amount: number | null
          expected_rate_tna: number | null
          expected_cap_amount: number | null
          expected_base_balance: number | null
          actual_amount: number | null
          actual_concept: string | null
          actual_statement_balance: number | null
          actual_source: 'statement_csv' | 'manual' | null
          status: 'estimated' | 'matched' | 'actual_only' | 'difference' | 'ignored' | 'manual_adjusted'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          date: string
          currency?: 'ARS' | 'USD'
          expected_amount?: number | null
          expected_rate_tna?: number | null
          expected_cap_amount?: number | null
          expected_base_balance?: number | null
          actual_amount?: number | null
          actual_concept?: string | null
          actual_statement_balance?: number | null
          actual_source?: 'statement_csv' | 'manual' | null
          status?: 'estimated' | 'matched' | 'actual_only' | 'difference' | 'ignored' | 'manual_adjusted'
          created_at?: string
          updated_at?: string
        }
        Update: {
          expected_amount?: number | null
          expected_rate_tna?: number | null
          expected_cap_amount?: number | null
          expected_base_balance?: number | null
          actual_amount?: number | null
          actual_concept?: string | null
          actual_statement_balance?: number | null
          actual_source?: 'statement_csv' | 'manual' | null
          status?: 'estimated' | 'matched' | 'actual_only' | 'difference' | 'ignored' | 'manual_adjusted'
          updated_at?: string
        }
        Relationships: []
      }
      statement_imports: {
        Row: {
          id: string
          user_id: string
          account_id: string
          provider: string
          file_name: string | null
          row_count: number
          matched_yield_count: number
          ignored_count: number
          imported_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          provider: string
          file_name?: string | null
          row_count?: number
          matched_yield_count?: number
          ignored_count?: number
          imported_at?: string
        }
        Update: {
          file_name?: string | null
          row_count?: number
          matched_yield_count?: number
          ignored_count?: number
        }
        Relationships: []
      }
      statement_import_rows: {
        Row: {
          id: string
          import_id: string
          user_id: string
          account_id: string
          date: string
          comprobante: string | null
          concept: string
          amount: number
          balance: number | null
          raw: Json
          matched_yield_entry_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          import_id: string
          user_id: string
          account_id: string
          date: string
          comprobante?: string | null
          concept: string
          amount: number
          balance?: number | null
          raw?: Json
          matched_yield_entry_id?: string | null
          created_at?: string
        }
        Update: {
          matched_yield_entry_id?: string | null
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
          hero_balance_mode: 'combined_ars' | 'combined_usd' | 'default_currency'
          cards: Json
          onboarding_completed: boolean
          tour_completed: boolean
          rollover_mode: 'auto' | 'off'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          default_currency?: 'ARS' | 'USD'
          hero_balance_mode?: 'combined_ars' | 'combined_usd' | 'default_currency'
          cards?: Json
          onboarding_completed?: boolean
          tour_completed?: boolean
          rollover_mode?: 'auto' | 'off'
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          default_currency?: 'ARS' | 'USD'
          hero_balance_mode?: 'combined_ars' | 'combined_usd' | 'default_currency'
          cards?: Json
          onboarding_completed?: boolean
          tour_completed?: boolean
          rollover_mode?: 'auto' | 'off'
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
export type ProductEvent = Database['public']['Tables']['product_events']['Row']

export type MonthlyIncome =
  Database['public']['Tables']['monthly_income']['Row']
export type MonthlyIncomeInsert =
  Database['public']['Tables']['monthly_income']['Insert']
export type MonthlyIncomeUpdate =
  Database['public']['Tables']['monthly_income']['Update']

export type UserConfig = Database['public']['Tables']['user_config']['Row']
export type RolloverMode = 'auto' | 'off'
export type HeroBalanceMode = 'combined_ars' | 'combined_usd' | 'default_currency'

export type Account = Database['public']['Tables']['accounts']['Row']
export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type AccountUpdate = Database['public']['Tables']['accounts']['Update']
export type AccountType = 'bank' | 'cash' | 'digital'

export type YieldAccumulator = Database['public']['Tables']['yield_accumulator']['Row']
export type YieldAccumulatorInsert = Database['public']['Tables']['yield_accumulator']['Insert']
export type YieldAccumulatorUpdate = Database['public']['Tables']['yield_accumulator']['Update']
export type YieldDailyEntry = Database['public']['Tables']['yield_daily_entries']['Row']
export type YieldDailyEntryInsert = Database['public']['Tables']['yield_daily_entries']['Insert']
export type YieldDailyEntryUpdate = Database['public']['Tables']['yield_daily_entries']['Update']
export type StatementImport = Database['public']['Tables']['statement_imports']['Row']
export type StatementImportInsert = Database['public']['Tables']['statement_imports']['Insert']
export type StatementImportRow = Database['public']['Tables']['statement_import_rows']['Row']
export type StatementImportRowInsert = Database['public']['Tables']['statement_import_rows']['Insert']

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
  source: 'rollover_auto'
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
export type CardCycleAmount = Database['public']['Tables']['card_cycle_amounts']['Row']
export type CardCycleAmountInsert = Database['public']['Tables']['card_cycle_amounts']['Insert']
export type CardCycleAmountUpdate = Database['public']['Tables']['card_cycle_amounts']['Update']

export type InstrumentType   = 'plazo_fijo' | 'fci'
export type InstrumentStatus = 'active' | 'closed'
export type Instrument       = Database['public']['Tables']['instruments']['Row']
export type InstrumentInsert = Database['public']['Tables']['instruments']['Insert']
export type InstrumentUpdate = Database['public']['Tables']['instruments']['Update']

export type Goal = Database['public']['Tables']['goals']['Row']
export type GoalInsert = Database['public']['Tables']['goals']['Insert']
export type GoalUpdate = Database['public']['Tables']['goals']['Update']

export type GoalContribution = Database['public']['Tables']['goal_contributions']['Row']
export type GoalContributionInsert = Database['public']['Tables']['goal_contributions']['Insert']
export type GoalContributionUpdate = Database['public']['Tables']['goal_contributions']['Update']

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
