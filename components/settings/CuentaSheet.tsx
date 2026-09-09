'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { FullScreenSheet } from '@/components/ui/FullScreenSheet'
import { SettingsPreferences } from '@/components/settings/SettingsPreferences'
import { AccountSection } from '@/components/settings/AccountSection'
import { createClient } from '@/lib/supabase/client'
import { getCurrentMonth } from '@/lib/dates'
import styles from './MobileSettings.module.css'
import type { Account, Card, HeroBalanceMode } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  userEmail: string
  heroBalanceMode: HeroBalanceMode
  onHeroBalanceModeChange: (next: HeroBalanceMode) => void
}

type UserConfigResponse = {
  default_currency?: 'ARS' | 'USD'
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Request failed: ${url}`)
  return response.json() as Promise<T>
}

export function CuentaSheet({
  open,
  onClose,
  userEmail,
  heroBalanceMode,
  onHeroBalanceModeChange,
}: Props) {
  const titleId = useId()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [authProviders, setAuthProviders] = useState<string[]>([])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const [nextAccounts, nextCards, config, { data: { user } }] = await Promise.all([
        fetchJson<Account[]>('/api/accounts'),
        fetchJson<Card[]>('/api/cards'),
        fetchJson<UserConfigResponse>('/api/user-config'),
        supabase.auth.getUser(),
      ])
      const rawProviders = (user?.app_metadata as { providers?: unknown } | undefined)?.providers
      setAccounts(Array.isArray(nextAccounts) ? nextAccounts : [])
      setCards(Array.isArray(nextCards) ? nextCards : [])
      setCurrency(config.default_currency === 'USD' ? 'USD' : 'ARS')
      setAuthProviders(Array.isArray(rawProviders) ? rawProviders as string[] : [])
      setIsAnonymous(user?.is_anonymous === true)
    } catch {
      setError('No pudimos cargar tu configuración.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadSettings()
  }, [open, loadSettings])

  return (
    <FullScreenSheet open={open} onClose={onClose} labelledBy={titleId} extendIntoTopSafeArea>
      <h1 id={titleId} className="sr-only">Configuración</h1>
      <div className="h-full overflow-y-auto overscroll-contain bg-bg-primary" aria-busy={loading}>
        {loading ? (
          <div className="mx-auto max-w-[448px] px-5 pb-24 pt-[max(28px,env(safe-area-inset-top))]">
            <div className="h-36 animate-pulse rounded-card bg-primary/10" />
            <div className="mt-6 space-y-3">{[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-card bg-bg-tertiary" />)}</div>
          </div>
        ) : error ? (
          <div className="flex min-h-full items-center justify-center px-6 text-center">
            <div>
              <p role="alert" className="text-sm font-semibold text-text-primary">{error}</p>
              <p className="mt-1 text-xs text-text-tertiary">Tus datos no se modificaron.</p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-button border border-border-strong px-4 text-sm text-text-secondary">Cerrar</button>
                <button type="button" onClick={() => void loadSettings()} className="min-h-11 flex-1 rounded-button bg-primary px-4 text-sm font-semibold text-white">Reintentar</button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.content}>
            <SettingsPreferences
              currentMonth={getCurrentMonth()}
              currency={currency}
              cards={cards}
              accounts={accounts}
              heroBalanceMode={heroBalanceMode}
              signalsCenterEnabled={false}
              includeHeroBalanceMode
              includeSubscriptions
              onClose={onClose}
              onHeroBalanceModeChange={onHeroBalanceModeChange}
            />
            <div className={styles.account}>
              <AccountSection email={userEmail} isAnonymous={isAnonymous} authProviders={authProviders} />
            </div>
          </div>
        )}
      </div>
    </FullScreenSheet>
  )
}
