'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FF_YIELD } from '@/lib/flags'
import type { Account, AccountType } from '@/types/database'

interface Props {
  account: Account | null  // null = crear nueva cuenta
  type: AccountType
  month: string            // YYYY-MM
  onSave: (account: Account) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

const TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Banco',
  cash: 'Efectivo',
  digital: 'Billetera digital',
}

const SOURCE_LABELS: Record<string, string> = {
  opening: 'APERTURA',
  rollover_auto: 'ROLLOVER',
}

type YieldDailySummary = {
  estimated_total: number
  actual_total: number
  balance_total: number
  count: number
  matched_count: number
  difference_count: number
}

type YieldDailyEntryPreview = {
  id: string
  date: string
  expected_amount: number | null
  actual_amount: number | null
  status: string
}

function getMonthLabel(ym: string): string {
  const label = new Date(ym + '-15').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function AccountBottomSheet({ account, type, month, onSave, onDelete, onClose }: Props) {
  const isNew = account === null
  const [name, setName] = useState(account?.name ?? '')
  const [isPrimary, setIsPrimary] = useState(account?.is_primary ?? false)
  const [yieldEnabled, setYieldEnabled] = useState(account?.daily_yield_enabled ?? false)
  const [yieldRate, setYieldRate] = useState(
    account?.daily_yield_rate != null ? String(account.daily_yield_rate) : '',
  )
  const [yieldProvider, setYieldProvider] = useState(account?.daily_yield_provider ?? 'manual')
  const [yieldCapAmount, setYieldCapAmount] = useState(
    account?.daily_yield_cap_amount != null ? String(account.daily_yield_cap_amount) : '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [openingArs, setOpeningArs] = useState(
    account?.opening_balance_ars ? String(account.opening_balance_ars) : '',
  )
  const [openingUsd, setOpeningUsd] = useState(
    account?.opening_balance_usd ? String(account.opening_balance_usd) : '',
  )
  const [periodSource, setPeriodSource] = useState<string | null>(null)
  const [currentSaldoArs, setCurrentSaldoArs] = useState(0)
  const [yieldSummary, setYieldSummary] = useState<YieldDailySummary | null>(null)
  const [yieldEntries, setYieldEntries] = useState<YieldDailyEntryPreview[]>([])
  const [isImportingYield, setIsImportingYield] = useState(false)
  const [yieldImportMessage, setYieldImportMessage] = useState<string | null>(null)

  const refreshYieldEntries = async () => {
    if (isNew || !account || !month) return
    const res = await fetch(`/api/yield-daily?account_id=${account.id}&month=${month}`)
    if (!res.ok) return
    const data: { summary: YieldDailySummary; entries: YieldDailyEntryPreview[] } = await res.json()
    setYieldSummary(data.summary)
    setYieldEntries(data.entries.slice(0, 5))
  }

  const handleImportYieldCsv = async (file: File | null) => {
    if (!file || !account) return
    setIsImportingYield(true)
    setYieldImportMessage(null)
    try {
      const csv = await file.text()
      const res = await fetch('/api/yield-import/bna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: account.id, file_name: file.name, csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setYieldImportMessage(`${data.imported_yield_rows} rendimientos importados`)
      await refreshYieldEntries()
    } catch {
      setYieldImportMessage('No pude importar el CSV.')
    } finally {
      setIsImportingYield(false)
    }
  }

  useEffect(() => {
    if (isNew || !account || !month) return
    Promise.all([
      fetch(`/api/account-balances?month=${month}`).then((r) => r.json()),
      fetch(`/api/dashboard/account-breakdown?month=${month}&currency=ARS`).then((r) => r.json()),
    ])
      .then(([balances, breakdownData]: [{ account_id: string; source: string }[], { breakdown: { id: string; saldo: number }[] }]) => {
        const bal = balances.find((b) => b.account_id === account.id)
        if (bal) setPeriodSource(bal.source)
        const accBreakdown = breakdownData.breakdown?.find((b) => b.id === account.id)
        if (accBreakdown) setCurrentSaldoArs(Math.max(0, accBreakdown.saldo))
      })
      .catch(() => {})
  }, [account?.id, month, isNew])

  useEffect(() => {
    if (!yieldEnabled) return
    void refreshYieldEntries()
  }, [account?.id, month, yieldEnabled])

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const payload = {
        name: name.trim(),
        type,
        is_primary: isPrimary,
        opening_balance_ars: Number(openingArs) || 0,
        opening_balance_usd: Number(openingUsd) || 0,
        daily_yield_enabled: yieldEnabled,
        daily_yield_rate: yieldEnabled && yieldRate !== '' ? Number(yieldRate) : null,
        daily_yield_provider: yieldEnabled ? yieldProvider : null,
        daily_yield_cap_amount: yieldEnabled && yieldCapAmount !== '' ? Number(yieldCapAmount) : null,
      }

      let res: Response
      if (isNew) {
        res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/accounts/${account!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) throw new Error()
      const saved: Account = await res.json()

      onSave(saved)
      onClose()
    } catch {
      alert('Error al guardar cuenta.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!account) return
    if (!confirm('¿Archivar esta cuenta?')) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDelete?.(account.id)
      onClose()
    } catch {
      alert('Error al archivar cuenta.')
    } finally {
      setIsDeleting(false)
    }
  }

  const rateNum = Number(yieldRate) || 0
  const dailyEstimate =
    yieldEnabled && currentSaldoArs > 0 && rateNum > 0
      ? Math.min(
          currentSaldoArs,
          yieldCapAmount !== '' ? Number(yieldCapAmount) || currentSaldoArs : currentSaldoArs,
        ) * (rateNum / 100 / 365)
      : null

  const inputClass =
    'w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none'

  return (
    <Modal open onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="mb-0.5 text-xs text-text-tertiary">{TYPE_LABELS[type]}</p>
          <h2 className="text-lg font-bold text-text-primary">
            {isNew ? 'Nueva cuenta' : 'Editar cuenta'}
          </h2>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] text-text-tertiary">Nombre</span>
          <input
            type="text"
            placeholder="Ej. Banco Nación"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </label>

        {/* Saldo base histórico */}
        <div className="rounded-card border border-border-subtle bg-bg-tertiary px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              {isNew ? 'SALDO INICIAL HISTÓRICO' : 'Saldo inicial histórico'}
            </span>
            {periodSource && !isNew && (
              <span className="text-[9px] font-semibold tracking-wider text-text-disabled">
                {SOURCE_LABELS[periodSource] ?? periodSource}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-text-disabled">ARS</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={openingArs}
                onChange={(e) => setOpeningArs(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-text-disabled">USD</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={openingUsd}
                onChange={(e) => setOpeningUsd(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-[10px] text-text-disabled">
            {isNew
              ? 'El dinero que ya tenés en esta cuenta antes de empezar a registrar.'
              : 'Corrige el punto de partida histórico de la cuenta. No edita snapshots mensuales.'}
          </p>
        </div>

        {!isNew && periodSource && (
          <p className="text-[10px] text-text-disabled">
            El snapshot de {getMonthLabel(month)} se calcula o se cierra por separado.
          </p>
        )}

        {type !== 'cash' && (
          <div className="flex items-center justify-between rounded-card border border-border-subtle bg-bg-tertiary px-3 py-2.5">
            <span className="text-sm text-text-primary">Cuenta principal</span>
            <button
              onClick={() => setIsPrimary((v) => !v)}
              aria-label={isPrimary ? 'Quitar principal' : 'Marcar como principal'}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                isPrimary ? 'bg-primary' : 'bg-bg-elevated'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  isPrimary ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}

        {/* Rendimiento diario */}
        {FF_YIELD && <div className="rounded-card border border-border-subtle bg-bg-tertiary px-3 py-2.5 space-y-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Rendimiento diario</p>
              {!yieldEnabled && (
                <p className="text-[10px] text-text-disabled">Desactivado</p>
              )}
            </div>
            <button
              onClick={() => setYieldEnabled((v) => !v)}
              aria-label={yieldEnabled ? 'Desactivar rendimiento' : 'Activar rendimiento'}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                yieldEnabled ? 'bg-primary' : 'bg-bg-elevated'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  yieldEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {yieldEnabled && (
            <div className="space-y-3 pt-3 mt-2.5 border-t border-border-subtle">
              <label className="block space-y-1">
                <span className="text-[10px] text-text-disabled">TNA %</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Ej. 78"
                  value={yieldRate}
                  onChange={(e) => setYieldRate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-text-disabled">Proveedor</span>
                <select
                  value={yieldProvider}
                  onChange={(e) => {
                    const provider = e.target.value
                    setYieldProvider(provider)
                    if (provider === 'bna' && yieldCapAmount === '') setYieldCapAmount('2000000')
                  }}
                  className={inputClass}
                >
                  <option value="manual">Manual / genérico</option>
                  <option value="bna">Banco Nación</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-text-disabled">Tope remunerado ARS</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Ej. 2000000"
                  value={yieldCapAmount}
                  onChange={(e) => setYieldCapAmount(e.target.value)}
                  className={inputClass}
                />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-tertiary">Estimado diario</span>
                <span className="text-[13px] font-semibold text-text-primary">
                  {dailyEstimate != null
                    ? `+$${dailyEstimate.toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : '—'}
                </span>
              </div>
              <p className="text-[10px] text-text-disabled">
                Gota estima rendimientos diarios y puede reemplazarlos por el monto real cuando importás el extracto del banco.
              </p>

              {!isNew && (
                <div className="space-y-2 rounded-card border border-border-subtle bg-bg-secondary p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-tertiary">Impacto en Saldo Vivo</span>
                    <span className="text-[13px] font-semibold text-success">
                      +{(yieldSummary?.balance_total ?? 0).toLocaleString('es-AR', {
                        style: 'currency',
                        currency: 'ARS',
                      })}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-disabled">
                    {yieldSummary?.count ?? 0} día{(yieldSummary?.count ?? 0) === 1 ? '' : 's'} generado{(yieldSummary?.count ?? 0) === 1 ? '' : 's'} este mes.
                  </p>
                  {yieldEntries.length > 0 && (
                    <div className="space-y-1 border-t border-border-subtle pt-2">
                      {yieldEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-text-tertiary">{entry.date.slice(5).split('-').reverse().join('/')}</span>
                          <span className="font-medium text-text-primary">
                            +{Number(entry.actual_amount ?? entry.expected_amount ?? 0).toLocaleString('es-AR', {
                              style: 'currency',
                              currency: 'ARS',
                            })}{' '}
                            <span className="text-text-disabled">{entry.status}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="block">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      disabled={isImportingYield}
                      onChange={(e) => void handleImportYieldCsv(e.target.files?.[0] ?? null)}
                    />
                    <span className="block w-full rounded-button border border-border-subtle bg-bg-primary py-2 text-center text-xs font-semibold text-text-primary">
                      {isImportingYield ? 'Importando...' : 'Cargar CSV Banco Nación'}
                    </span>
                  </label>
                  {yieldImportMessage && (
                    <p className="text-[10px] text-text-disabled">{yieldImportMessage}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>}

        <button
          onClick={handleSave}
          disabled={!name.trim() || isSaving}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : isNew ? 'Crear cuenta' : 'Guardar cambios'}
        </button>

        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full rounded-button border border-border-strong py-2.5 text-sm text-text-tertiary transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            {isDeleting ? 'Archivando...' : account?.archived ? 'Restaurar cuenta' : 'Archivar cuenta'}
          </button>
        )}
      </div>
    </Modal>
  )
}
