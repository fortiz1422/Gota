'use client'

import { useRef, useState, useEffect } from 'react'
import { CaretRight, Trash } from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { InlineError } from '@/components/ui/InlineError'
import { Toggle } from '@/components/ui/Toggle'
import { formatArDecimal, parseArDecimalInput, parseArSignedDecimalInput } from '@/lib/ar-input'
import { FF_YIELD } from '@/lib/flags'
import type { Account, AccountType } from '@/types/database'

interface Props {
  account: Account | null  // null = crear nueva cuenta
  type: AccountType
  month: string            // YYYY-MM
  onSave: (account: Account) => void
  onDelete?: (id: string) => void
  onClose: () => void
  triggerElement?: HTMLElement | null
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

export function AccountBottomSheet({ account, type, month, onSave, onDelete, onClose, triggerElement }: Props) {
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
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiveTrigger, setArchiveTrigger] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

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
    setError(null)
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
      setError('No pudimos guardar la cuenta. Revisá los datos e intentá nuevamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!account) return
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDelete?.(account.id)
      setConfirmArchive(false)
      onClose()
    } catch {
      setConfirmArchive(false)
      setError('No pudimos archivar la cuenta. Intentá nuevamente.')
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

  const legacyInputClass =
    'w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none'
  const editInputClass =
    'w-full border-0 border-b border-border-strong bg-transparent px-0 pb-2 pt-1 text-base font-semibold text-text-primary outline-none placeholder:text-text-disabled focus:border-primary focus:ring-0 focus-visible:!outline-none focus-visible:ring-0'
  const inputClass = isNew ? legacyInputClass : editInputClass

  return (
    <TaskSurface
      open
      onClose={onClose}
      eyebrow={TYPE_LABELS[type].toUpperCase()}
      title={isNew ? 'Nueva cuenta' : account?.name ?? 'Editar cuenta'}
      description={isNew ? 'Definí la cuenta y su punto de partida.' : 'Revisá identidad, saldo inicial y preferencias de esta cuenta.'}
      appearance={isNew ? 'brand' : 'compact'}
      navigationTitle={isNew ? undefined : 'Editar cuenta'}
      initialFocusRef={nameRef}
      triggerElement={triggerElement}
      footer={
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!name.trim() || isSaving}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : isNew ? 'Crear cuenta' : 'Guardar cambios'}
        </button>
      }
    >
      <div className={isNew ? 'space-y-4' : 'space-y-5'}>
        <InlineError message={error} />
        <div className={isNew ? 'contents' : 'space-y-2'}>
          {!isNew && <h3 className="px-1 type-micro text-text-tertiary">INFORMACIÓN</h3>}
          <section
            data-account-edit-information={!isNew ? '' : undefined}
            className={isNew ? 'contents' : 'surface-module block overflow-hidden rounded-card border border-border-subtle bg-white'}
          >
          <label className={isNew ? 'block space-y-1' : 'block px-4 pb-4 pt-4'}>
            <span className={isNew ? 'text-[10px] text-text-tertiary' : 'mb-1.5 block text-[11px] font-semibold text-text-tertiary'}>
              Nombre
            </span>
            <input
              ref={nameRef}
              type="text"
              placeholder="Ej. Banco Nación"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            {!isNew && (
              <span className="mt-2 block text-[11px] leading-relaxed text-text-tertiary">
                Identifica la cuenta en movimientos y saldos.
              </span>
            )}
          </label>

          {/* Saldo base histórico */}
          <div className={isNew ? 'space-y-2 rounded-card border border-border-subtle bg-bg-tertiary px-3 py-3' : 'space-y-3 border-t border-border-subtle px-4 py-4'}>
            <div className="flex items-center justify-between gap-3">
              <span className={isNew ? 'text-[10px] font-medium uppercase tracking-wider text-text-tertiary' : 'text-[13px] font-semibold text-text-primary'}>
                {isNew ? 'SALDO INICIAL HISTÓRICO' : 'Saldo inicial histórico'}
              </span>
              {periodSource && !isNew && (
                <span className="rounded-pill bg-primary-soft px-2 py-1 text-[9px] font-semibold tracking-wider text-primary">
                  {SOURCE_LABELS[periodSource] ?? periodSource}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className={isNew ? 'text-[10px] text-text-disabled' : 'text-[10px] font-semibold uppercase tracking-wider text-text-tertiary'}>ARS</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatArDecimal(openingArs)}
                  onChange={(e) => setOpeningArs(parseArSignedDecimalInput(e.target.value))}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={isNew ? 'text-[10px] text-text-disabled' : 'text-[10px] font-semibold uppercase tracking-wider text-text-tertiary'}>USD</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatArDecimal(openingUsd)}
                  onChange={(e) => setOpeningUsd(parseArSignedDecimalInput(e.target.value))}
                  className={inputClass}
                />
              </label>
            </div>
            <p className={isNew ? 'text-[10px] text-text-disabled' : 'text-[11px] leading-relaxed text-text-tertiary'}>
              {isNew
                ? 'El dinero que ya tenés en esta cuenta antes de empezar a registrar.'
                : 'Corrige el punto de partida histórico. No modifica snapshots mensuales.'}
            </p>
          </div>
          </section>
        </div>

        {!isNew && periodSource && (
          <p className="text-[10px] text-text-disabled">
            El snapshot de {getMonthLabel(month)} se calcula o se cierra por separado.
          </p>
        )}

        <div className={isNew ? 'contents' : 'space-y-2'}>
          {!isNew && <h3 className="px-1 type-micro text-text-tertiary">COMPORTAMIENTO</h3>}
          <section
            data-account-edit-behavior={!isNew ? '' : undefined}
            className={isNew ? 'contents' : 'surface-module block overflow-hidden rounded-card border border-border-subtle bg-white'}
          >
          {type !== 'cash' && (
          <div className={isNew ? 'flex items-center justify-between rounded-card border border-border-subtle bg-bg-tertiary px-3 py-2.5' : 'flex min-h-[68px] items-center justify-between gap-4 px-4 py-3.5'}>
            <span>
              <span className="block text-sm font-medium text-text-primary">Cuenta principal</span>
              {!isNew && <span className="mt-0.5 block text-[11px] text-text-tertiary">La opción predeterminada para nuevas cargas.</span>}
            </span>
            <Toggle
              value={isPrimary}
              onChange={setIsPrimary}
              ariaLabel={isPrimary ? 'Quitar principal' : 'Marcar como principal'}
            />
          </div>
        )}

        {/* Rendimiento diario */}
        {FF_YIELD && <div className={isNew ? 'space-y-0 rounded-card border border-border-subtle bg-bg-tertiary px-3 py-2.5' : `${type !== 'cash' ? 'border-t border-border-subtle' : ''} space-y-0 px-4 py-3.5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Rendimiento diario</p>
              {!yieldEnabled && (
                <p className={isNew ? 'text-[10px] text-text-disabled' : 'mt-0.5 text-[11px] text-text-tertiary'}>
                  {isNew ? 'Desactivado' : 'Estima el rendimiento que genera esta cuenta.'}
                </p>
              )}
            </div>
            <Toggle
              value={yieldEnabled}
              onChange={setYieldEnabled}
              ariaLabel={yieldEnabled ? 'Desactivar rendimiento' : 'Activar rendimiento'}
            />
          </div>

          {yieldEnabled && (
            <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold text-text-tertiary">TNA %</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej. 78"
                  value={formatArDecimal(yieldRate)}
                  onChange={(e) => setYieldRate(parseArDecimalInput(e.target.value))}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold text-text-tertiary">Proveedor</span>
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
                <span className="text-[10px] font-semibold text-text-tertiary">Tope remunerado ARS</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej. 2.000.000"
                  value={formatArDecimal(yieldCapAmount)}
                  onChange={(e) => setYieldCapAmount(parseArDecimalInput(e.target.value))}
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
              <p className="text-[11px] leading-relaxed text-text-tertiary">
                Gota estima rendimientos diarios y puede reemplazarlos por el monto real cuando importás el extracto del banco.
              </p>

              {!isNew && (
                <div data-account-yield-summary className="space-y-2 border-t border-border-subtle pt-3">
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
          </section>
        </div>


        {!isNew && (
          <button
            data-account-edit-archive
            type="button"
            onClick={(event) => { setArchiveTrigger(event.currentTarget); setConfirmArchive(true) }}
            disabled={isDeleting}
            className="surface-module flex min-h-[66px] w-full items-center gap-3 rounded-card border border-danger/10 bg-white px-3.5 py-3 text-left transition-colors hover:border-danger/20 disabled:opacity-50"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-danger-soft text-danger">
              <Trash size={17} weight="regular" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-danger">Archivar cuenta</span>
              <span className="mt-0.5 block text-[11px] text-text-tertiary">Conserva sus movimientos y su historial.</span>
            </span>
            <CaretRight size={17} className="shrink-0 text-danger/45" />
          </button>
        )}
      </div>
      <ConfirmationSurface
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => void handleDelete()}
        triggerElement={archiveTrigger}
        eyebrow="ARCHIVAR CUENTA"
        title={`¿Archivar ${account?.name ?? 'esta cuenta'}?`}
        description="Deja de aparecer para nuevas cargas, sin modificar movimientos históricos."
        confirmLabel="Archivar cuenta"
        busy={isDeleting}
        destructive
      >
        Los movimientos vinculados se conservan. Si la cuenta nunca tuvo movimientos, Gota puede quitarla definitivamente.
      </ConfirmationSurface>
    </TaskSurface>
  )
}
