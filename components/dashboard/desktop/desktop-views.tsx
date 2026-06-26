'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CaretUp,
  CreditCard,
  Drop,
  Gear,
  Info,
  ListBullets,
  Plus,
  TrendDown,
} from '@phosphor-icons/react'
import { formatAmount, todayAR } from '@/lib/format'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { Expense } from '@/types/database'
import { Badge, BLUE, CARD_STYLE, CatSquare, fmtMoney, LABEL_STYLE, monthName } from './desktop-ui'
import { ApiMovement, fetchAllMovimientosForMonth } from './movimientos-data'

export type DesktopViewProps = {
  data: DashboardApiData
  analyticsData?: AnalyticsApiData
  compromisos: CompromisosData | null
  viewCurrency: 'ARS' | 'USD'
  hidden: boolean
  selectedMonth: string
  ingresosMes: number
  gastosMes: number
}

const ACCOUNT_PALETTE = ['#2178A8', '#1B7E9E', '#1A7A42', '#7D4EC0', '#B84A12', '#A0367A']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const isKnownDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
const localDate = (d: string) => (isKnownDate(d) ? new Date(`${d}T12:00:00-03:00`) : null)
const fmtDue = (iso: string) => localDate(iso)?.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) ?? 'Sin fecha'

function isPerceived(e: Expense, currency: 'ARS' | 'USD') {
  return e.currency === currency && e.payment_method !== 'CREDIT' && e.category !== 'Pago de Tarjetas'
}

function ViewHeader({
  title,
  meta,
  action,
}: {
  title: string
  meta?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 24, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1829' }}>{title}</h1>
        {meta && <div style={{ fontSize: 13, color: '#90A4B0', marginTop: 6 }}>{meta}</div>}
      </div>
      {action}
    </div>
  )
}

// ════════════════════════ MOVIMIENTOS ════════════════════════
type Mov = {
  id: string
  type: 'expense' | 'income' | 'transfer'
  category: string
  title: string
  subtitle: string
  amount: number
  currency: 'ARS' | 'USD'
  date: string
}

export function MovimientosView({ data, viewCurrency, hidden, selectedMonth }: DesktopViewProps) {
  const [filter, setFilter] = useState<'Todos' | 'Gastos' | 'Ingresos' | 'Transfers'>('Todos')
  const [monthMovements, setMonthMovements] = useState<{
    month: string
    movements: ApiMovement[]
  } | null>(null)
  const accountName = useMemo(() => new Map(data.accounts.map((a) => [a.id, a.name])), [data.accounts])

  useEffect(() => {
    let cancelled = false

    void fetchAllMovimientosForMonth(selectedMonth)
      .then((movements) => {
        if (!cancelled) setMonthMovements({ month: selectedMonth, movements })
      })
      .catch(() => {
        if (!cancelled) setMonthMovements(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedMonth])

  const fallbackMovements = useMemo<Mov[]>(() => {
    const list: Mov[] = []
    for (const e of data.allUltimos) {
      if (e.currency !== viewCurrency) continue
      const acc = e.payment_method === 'CREDIT' ? 'Tarjeta' : e.account_id ? accountName.get(e.account_id) ?? 'Cuenta' : 'Efectivo'
      list.push({
        id: `e-${e.id}`,
        type: 'expense',
        category: e.category,
        title: e.description,
        subtitle: [e.category, acc].filter(Boolean).join(' · '),
        amount: e.amount,
        currency: e.currency,
        date: e.date,
      })
    }
    for (const i of data.incomeEntries) {
      if (i.currency !== viewCurrency) continue
      list.push({
        id: `i-${i.id}`,
        type: 'income',
        category: '',
        title: i.description || 'Ingreso',
        subtitle: ['Ingresos', i.account_id ? accountName.get(i.account_id) ?? '' : ''].filter(Boolean).join(' · '),
        amount: i.amount,
        currency: i.currency,
        date: i.date,
      })
    }
    for (const t of data.transfers) {
      if (t.currency_from !== viewCurrency) continue
      list.push({
        id: `t-${t.id}`,
        type: 'transfer',
        category: '',
        title: `${accountName.get(t.from_account_id) ?? 'Cuenta'} → ${accountName.get(t.to_account_id) ?? 'Cuenta'}`,
        subtitle: 'Transferencia propia',
        amount: t.amount_from,
        currency: t.currency_from,
        date: t.date,
      })
    }
    return list.sort((a, b) => b.date.localeCompare(a.date))
  }, [data.allUltimos, data.incomeEntries, data.transfers, accountName, viewCurrency])

  const movements = useMemo<Mov[]>(() => {
    const loadedMovements = monthMovements?.month === selectedMonth ? monthMovements.movements : null
    if (!loadedMovements) return fallbackMovements

    const list: Mov[] = []
    for (const movement of loadedMovements) {
      if (movement.kind === 'expense') {
        const expense = movement.data
        if (expense.currency !== viewCurrency) continue
        const accountLabel =
          expense.payment_method === 'CREDIT'
            ? 'Tarjeta'
            : expense.account_id
              ? accountName.get(expense.account_id) ?? 'Cuenta'
              : 'Efectivo'

        list.push({
          id: `e-${expense.id}`,
          type: 'expense',
          category: expense.category,
          title: expense.description,
          subtitle: [expense.category, accountLabel].filter(Boolean).join(' · '),
          amount: expense.amount,
          currency: expense.currency,
          date: expense.date,
        })
        continue
      }

      if (movement.kind === 'income') {
        const income = movement.data
        if (income.currency !== viewCurrency) continue
        list.push({
          id: `i-${income.id}`,
          type: 'income',
          category: '',
          title: income.description || 'Ingreso',
          subtitle: ['Ingresos', income.account_id ? accountName.get(income.account_id) ?? '' : '']
            .filter(Boolean)
            .join(' · '),
          amount: income.amount,
          currency: income.currency,
          date: income.date,
        })
        continue
      }

      if (movement.kind === 'transfer') {
        const transfer = movement.data
        if (transfer.currency_from !== viewCurrency) continue
        list.push({
          id: `t-${transfer.id}`,
          type: 'transfer',
          category: '',
          title: `${accountName.get(transfer.from_account_id) ?? 'Cuenta'} → ${accountName.get(transfer.to_account_id) ?? 'Cuenta'}`,
          subtitle: 'Transferencia propia',
          amount: transfer.amount_from,
          currency: transfer.currency_from,
          date: transfer.date,
        })
      }
    }

    return list
  }, [monthMovements, fallbackMovements, viewCurrency, accountName, selectedMonth])

  const filtered = movements.filter((m) => {
    if (filter === 'Gastos') return m.type === 'expense'
    if (filter === 'Ingresos') return m.type === 'income'
    if (filter === 'Transfers') return m.type === 'transfer'
    return true
  })

  const groups = useMemo(() => {
    const today = todayAR()
    const byDay = new Map<string, Mov[]>()
    for (const m of filtered) {
      if (!byDay.has(m.date)) byDay.set(m.date, [])
      byDay.get(m.date)!.push(m)
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => {
        const aKnown = isKnownDate(a)
        const bKnown = isKnownDate(b)
        if (aKnown !== bKnown) return aKnown ? -1 : 1
        return b.localeCompare(a)
      })
      .map(([date, items]) => {
        const d = localDate(date)
        if (!d) return { date, label: 'Sin fecha', items }

        const diff = Math.round((localDate(today)!.getTime() - d.getTime()) / 86_400_000)
        const base = `${d.getDate()} ${cap(d.toLocaleDateString('es-AR', { month: 'long' }))}`
        const label =
          diff === 0
            ? `Hoy · ${base}`
            : diff === 1
              ? `Ayer · ${base}`
              : `${cap(d.toLocaleDateString('es-AR', { weekday: 'long' }))} · ${base}`
        return { date, label, items }
      })
  }, [filtered])

  const totalGastos = movements.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0)
  const totalIngresos = movements.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0)

  return (
    <>
      <ViewHeader
        title="Movimientos"
        meta={`${movements.length} este mes`}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['Todos', 'Gastos', 'Ingresos', 'Transfers'] as const).map((f) => {
              const active = f === filter
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 9999,
                    background: active ? BLUE : '#FFFFFF',
                    color: active ? '#fff' : '#4A6070',
                    border: active ? '0' : '1px solid rgba(33,120,168,0.12)',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    boxShadow: active ? '0 2px 8px rgba(33,120,168,0.20)' : '0 1px 3px rgba(13,24,41,0.05)',
                  }}
                >
                  {f}
                </button>
              )
            })}
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Gastos del mes', value: fmtMoney(totalGastos, viewCurrency, hidden), tone: '#0D1829' },
          { label: 'Ingresos', value: fmtMoney(totalIngresos, viewCurrency, hidden), tone: '#1A7A42' },
          { label: 'Margen', value: fmtMoney(totalIngresos - totalGastos, viewCurrency, hidden), tone: totalIngresos - totalGastos >= 0 ? '#1A7A42' : '#A61E1E' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid rgba(33,120,168,0.07)', boxShadow: '0 1px 3px rgba(13,24,41,0.04)', padding: '14px 20px', minWidth: 160 }}>
            <div style={{ fontSize: 11, color: '#90A4B0', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: s.tone, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {groups.length === 0 ? (
          <div style={{ ...CARD_STYLE, padding: '40px 28px', textAlign: 'center', color: '#90A4B0', fontSize: 14 }}>
            No hay movimientos para el filtro seleccionado.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#90A4B0', padding: '0 4px 10px' }}>{group.label}</div>
              <div style={{ ...CARD_STYLE, padding: '2px 22px' }}>
                {group.items.map((m, ti) => {
                  const isIncome = m.type === 'income'
                  const isTransfer = m.type === 'transfer'
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: ti < group.items.length - 1 ? '1px solid rgba(33,120,168,0.07)' : '0' }}>
                      {isIncome || isTransfer ? (
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: isIncome ? 'rgba(26,122,66,0.10)' : 'rgba(27,126,158,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: isIncome ? '#1A7A42' : '#1B7E9E', fontWeight: 700 }}>
                          {isIncome ? '+' : '⇄'}
                        </div>
                      ) : (
                        <CatSquare category={m.category} size={36} iconSize={18} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                        <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 1 }}>{m.subtitle}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, flexShrink: 0, color: isIncome ? '#1A7A42' : '#0D1829', fontVariantNumeric: 'tabular-nums' }}>
                        {hidden ? '••••' : `${isIncome ? '+' : m.type === 'expense' ? '−' : ''}${formatAmount(m.amount, m.currency)}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// ════════════════════════ CUENTAS ════════════════════════
export function CuentasView({ data, viewCurrency, hidden }: DesktopViewProps) {
  const perAccount = useMemo(() => {
    const map = new Map<string, { ingresos: number; gastos: number; movs: number }>()
    for (const a of data.accounts) map.set(a.id, { ingresos: 0, gastos: 0, movs: 0 })
    for (const e of data.allUltimos) {
      if (e.account_id && map.has(e.account_id)) {
        const m = map.get(e.account_id)!
        m.gastos += e.amount
        m.movs += 1
      }
    }
    for (const i of data.incomeEntries) {
      if (i.account_id && map.has(i.account_id)) {
        const m = map.get(i.account_id)!
        m.ingresos += i.amount
        m.movs += 1
      }
    }
    return map
  }, [data.accounts, data.allUltimos, data.incomeEntries])

  const balances = data.accounts.map((a, i) => ({
    account: a,
    color: ACCOUNT_PALETTE[i % ACCOUNT_PALETTE.length],
    saldo: data.accountBalances.find((b) => b.id === a.id)?.saldo ?? 0,
  }))
  const total = balances.reduce((s, b) => s + b.saldo, 0)

  return (
    <>
      <ViewHeader
        title="Cuentas"
        meta={
          <>
            Patrimonio líquido ·{' '}
            <strong style={{ color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(total, viewCurrency, hidden)}</strong> en {data.accounts.length} cuenta
            {data.accounts.length !== 1 ? 's' : ''}
          </>
        }
        action={
          <Link href="/web/settings" style={{ padding: '11px 18px', borderRadius: 9999, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(33,120,168,0.22)' }}>
            <Plus weight="bold" size={13} /> Agregar cuenta
          </Link>
        }
      />

      {total > 0 && (
        <div style={{ ...CARD_STYLE, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ ...LABEL_STYLE, marginBottom: 14 }}>Distribución del saldo</div>
          <div style={{ display: 'flex', height: 10, borderRadius: 9999, overflow: 'hidden', gap: 2 }}>
            {balances.map((b) => (
              <div key={b.account.id} style={{ flex: Math.max(b.saldo, 0.0001), background: b.color }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
            {balances.map((b) => (
              <div key={b.account.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#90A4B0' }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: b.color }} />
                {b.account.name} <strong style={{ color: '#0D1829' }}>{total > 0 ? Math.round((b.saldo / total) * 100) : 0}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {balances.map((b) => {
          const stats = perAccount.get(b.account.id) ?? { ingresos: 0, gastos: 0, movs: 0 }
          const typeLabel = b.account.type === 'bank' ? 'Banco' : b.account.type === 'digital' ? 'Digital' : 'Efectivo'
          return (
            <div key={b.account.id} style={{ ...CARD_STYLE, borderTop: b.account.is_primary ? `3px solid ${BLUE}` : '2px solid rgba(33,120,168,0.18)', padding: '24px 26px 22px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 9999, background: b.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1829', letterSpacing: '-0.01em' }}>{b.account.name}</div>
                    <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 2 }}>
                      {typeLabel}
                      {b.account.is_primary ? ' · principal' : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1829', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtMoney(b.saldo, viewCurrency, hidden)}</div>

              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(33,120,168,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {[
                  { label: 'Ingresos · mes', value: fmtMoney(stats.ingresos, viewCurrency, hidden), color: '#1A7A42' },
                  { label: 'Gastos · mes', value: fmtMoney(stats.gastos, viewCurrency, hidden), color: '#0D1829' },
                  { label: 'Movimientos', value: `${stats.movs}`, color: '#0D1829' },
                ].map((s, i) => (
                  <div key={s.label} style={{ paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.08)' : 'none' }}>
                    <div style={{ ...LABEL_STYLE, fontSize: 9, marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <Link href="/movimientos" style={{ flex: 1, padding: '9px 0', borderRadius: 9999, background: 'rgba(33,120,168,0.07)', border: '1px solid rgba(33,120,168,0.14)', color: BLUE, fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ListBullets size={13} /> Movimientos
                </Link>
                <Link href="/web/settings" style={{ padding: '9px 14px', borderRadius: 9999, background: 'transparent', border: '1px solid rgba(33,120,168,0.14)', color: '#90A4B0', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Gear size={13} /> Ajustes
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ════════════════════════ TARJETAS ════════════════════════
export function TarjetasView({ data, analyticsData, compromisos, viewCurrency, hidden }: DesktopViewProps) {
  const cuotas = useMemo(() => {
    const expenses = analyticsData?.rawExpenses ?? data.allUltimos
    const cardName = new Map(data.cards.map((c) => [c.id, c.name]))
    const groups = new Map<string, { description: string; card: string; monthly: number; paid: number; count: number; nextDate: string }>()
    for (const e of expenses) {
      if (!e.installment_group_id || !e.installment_total || e.installment_total <= 1) continue
      const prev = groups.get(e.installment_group_id)
      const entry = {
        description: e.description,
        card: e.card_id ? cardName.get(e.card_id) ?? 'Tarjeta' : 'Tarjeta',
        monthly: e.amount,
        paid: e.installment_number ?? 1,
        count: e.installment_total,
        nextDate: e.date,
      }
      if (!prev || (e.installment_number ?? 0) > prev.paid) groups.set(e.installment_group_id, entry)
    }
    return Array.from(groups.values())
  }, [analyticsData?.rawExpenses, data.allUltimos, data.cards])

  const tarjetaById = useMemo(() => new Map((compromisos?.tarjetas ?? []).map((t) => [t.id, t])), [compromisos])
  const totalComprometido = compromisos?.totalComprometido ?? 0
  const nextClose = [...(compromisos?.tarjetas ?? [])]
    .filter((t) => t.daysUntilClosing != null)
    .sort((a, b) => (a.daysUntilClosing ?? 99) - (b.daysUntilClosing ?? 99))[0]

  const totalMensual = cuotas.reduce((s, c) => s + c.monthly, 0)
  const totalRestante = cuotas.reduce((s, c) => s + c.monthly * (c.count - c.paid), 0)

  return (
    <>
      <ViewHeader
        title="Tarjetas"
        meta={
          <>
            {data.cards.length} {data.cards.length === 1 ? 'activa' : 'activas'} · comprometido{' '}
            <strong style={{ color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(totalComprometido, viewCurrency, hidden)}</strong>
            {nextClose?.dueDate ? ` · próximo cierre ${fmtDue(nextClose.dueDate)}` : ''}
          </>
        }
        action={
          <Link href="/web/settings" style={{ padding: '11px 18px', borderRadius: 9999, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(33,120,168,0.22)' }}>
            <Plus weight="bold" size={13} /> Agregar tarjeta
          </Link>
        }
      />

      {data.cards.length === 0 ? (
        <div style={{ ...CARD_STYLE, padding: '40px 28px', textAlign: 'center', color: '#90A4B0', fontSize: 14 }}>No hay tarjetas activas.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {data.cards.map((card) => {
            const t = tarjetaById.get(card.id)
            const days = t?.daysUntilClosing ?? 15
            const progress = Math.max(0.05, Math.min(0.97, (30 - days) / 30))
            const urgent = days <= 7
            return (
              <div key={card.id} style={{ ...CARD_STYLE, padding: '26px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'rgba(166,30,30,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard weight="light" size={20} color="#A61E1E" />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1829', letterSpacing: '-0.01em' }}>{card.name}</div>
                      <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 2 }}>Tarjeta de crédito</div>
                    </div>
                  </div>
                  {t?.daysUntilClosing != null && (
                    <span style={{ padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: urgent ? 'rgba(184,74,18,0.09)' : 'rgba(33,120,168,0.09)', color: urgent ? '#B84A12' : BLUE }}>
                      cierra en {t.daysUntilClosing} días
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1 }}>
                  <span style={{ fontSize: 15, color: '#90A4B0', fontWeight: 500, alignSelf: 'flex-start', marginTop: 6 }}>$</span>
                  <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.05em', color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>
                    {hidden ? '••••••' : (t?.currentSpend ?? 0).toLocaleString('es-AR')}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#4A6070', marginBottom: 22 }}>consumido del período en curso</div>

                <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(33,120,168,0.09)', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: '#0D1829', borderRadius: 3 }} />
                  <div style={{ position: 'absolute', left: `${Math.round(progress * 100)}%`, top: -4, width: 1, height: 14, background: BLUE }}>
                    <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 15, fontSize: 10, fontWeight: 600, color: BLUE, whiteSpace: 'nowrap' }}>hoy</span>
                  </div>
                </div>

                <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {[
                    { label: 'A pagar · ciclo anterior', value: fmtMoney(t?.debtTotal ?? 0, viewCurrency, hidden), tone: '#A61E1E' },
                    { label: 'Vence', value: t?.dueDate ? fmtDue(t.dueDate) : '—', tone: '#0D1829' },
                  ].map((s, i) => (
                    <div key={s.label} style={{ paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.08)' : 'none' }}>
                      <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: s.tone, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cuotas.length > 0 && (
        <div style={{ ...CARD_STYLE, padding: '26px 28px', marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={LABEL_STYLE}>Cuotas en curso</div>
            <span style={{ fontSize: 12, color: '#90A4B0' }}>{cuotas.length} planes activos</span>
          </div>
          <div style={{ display: 'flex', gap: 28, marginBottom: 24, marginTop: 14 }}>
            <div>
              <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 6 }}>Carga mensual</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#B84A12', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(totalMensual, viewCurrency, hidden)}</div>
            </div>
            <div style={{ paddingLeft: 28, borderLeft: '1px solid rgba(33,120,168,0.08)' }}>
              <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 6 }}>Saldo restante</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0D1829', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(totalRestante, viewCurrency, hidden)}</div>
            </div>
          </div>
          <div>
            {cuotas.map((c, i) => {
              const pct = (c.paid / c.count) * 100
              return (
                <div key={`${c.description}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', alignItems: 'center', padding: '16px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0D1829' }}>{c.description}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {fmtMoney(c.monthly, viewCurrency, hidden)}
                    <span style={{ fontSize: 12, color: '#90A4B0', fontWeight: 500 }}> /mes</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#90A4B0' }}>{c.card}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 3, background: 'rgba(33,120,168,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: BLUE, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#4A6070', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {c.paid}/{c.count} cuotas
                    </span>
                    <span style={{ fontSize: 11, color: '#90A4B0', whiteSpace: 'nowrap' }}>próx. {fmtDue(c.nextDate)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

// ════════════════════════ INSTRUMENTOS ════════════════════════
export function InstrumentosView({ data, viewCurrency, hidden }: DesktopViewProps) {
  const instruments = [...data.activeInstruments].sort((a, b) => b.amount - a.amount)
  const totalArs = instruments.filter((i) => i.currency === 'ARS').reduce((s, i) => s + i.amount, 0)

  return (
    <>
      <ViewHeader
        title="Instrumentos"
        meta={
          <>
            {instruments.length} {instruments.length === 1 ? 'activo' : 'activos'} ·{' '}
            <strong style={{ color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(totalArs, viewCurrency, hidden)}</strong> invertidos
          </>
        }
        action={
          <Link href="/instrumentos" style={{ padding: '11px 18px', borderRadius: 9999, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(33,120,168,0.22)' }}>
            <Plus weight="bold" size={13} /> Agregar instrumento
          </Link>
        }
      />

      {instruments.length === 0 ? (
        <div style={{ ...CARD_STYLE, padding: '40px 28px', textAlign: 'center', color: '#90A4B0', fontSize: 14 }}>No hay instrumentos activos.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {instruments.map((inst) => {
            const label = inst.label?.trim() ? inst.label.trim() : inst.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'
            return (
              <div key={inst.id} style={{ ...CARD_STYLE, padding: '24px 26px' }}>
                <div style={{ ...LABEL_STYLE, marginBottom: 12 }}>
                  {inst.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'} · {inst.currency}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0D1829', marginBottom: 12, lineHeight: 1.3 }}>{label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1829', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 12 }}>
                  {fmtMoney(inst.amount, inst.currency, hidden)}
                </div>
                <div style={{ fontSize: 12, color: '#90A4B0' }}>
                  {inst.type === 'plazo_fijo' && inst.due_date
                    ? `Vence ${fmtDue(inst.due_date)}`
                    : 'Disponible'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ════════════════════════ ANÁLISIS ════════════════════════
function NDBar({ necesidad, deseo }: { necesidad: number; deseo: number }) {
  const total = Math.max(necesidad + deseo, 1)
  const nPct = (necesidad / total) * 100
  return (
    <>
      <div style={{ display: 'flex', height: 8, borderRadius: 9999, overflow: 'hidden', gap: 2, background: 'rgba(33,120,168,0.06)' }}>
        <div style={{ width: `${nPct}%`, background: '#1A7A42' }} />
        <div style={{ width: `${100 - nPct}%`, background: '#B84A12' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
        <span style={{ color: '#1A7A42', fontWeight: 600 }}>Necesidad {Math.round(nPct)}%</span>
        <span style={{ color: '#B84A12', fontWeight: 600 }}>Deseo {Math.round(100 - nPct)}%</span>
      </div>
    </>
  )
}

export function AnalisisView({ analyticsData, compromisos, viewCurrency, hidden, ingresosMes, gastosMes, selectedMonth, onDrill }: DesktopViewProps & { onDrill: (id: 'fuga' | 'compromisos') => void }) {
  const perceived = useMemo(
    () => (analyticsData?.rawExpenses ?? []).filter((e) => isPerceived(e, viewCurrency)),
    [analyticsData?.rawExpenses, viewCurrency],
  )

  const necesidad = perceived.filter((e) => !e.is_want).reduce((s, e) => s + e.amount, 0)
  const deseo = perceived.filter((e) => e.is_want).reduce((s, e) => s + e.amount, 0)

  const categories = useMemo(() => {
    const map = new Map<string, { amount: number; want: number }>()
    for (const e of perceived) {
      const prev = map.get(e.category) ?? { amount: 0, want: 0 }
      prev.amount += e.amount
      if (e.is_want) prev.want += e.amount
      map.set(e.category, prev)
    }
    const total = Math.max(gastosMes, 1)
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, amount: v.amount, pct: Math.round((v.amount / total) * 100), nd: v.want > v.amount / 2 ? 'D' : 'N' }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 7)
  }, [perceived, gastosMes])

  const series = analyticsData?.monthlySeries ?? []
  const current = series.find((m) => m.isCurrent) ?? series[series.length - 1]
  const previous = series.length >= 2 ? series[series.indexOf(current!) - 1] : undefined
  const deltaPct = previous && previous.percibidoTotal > 0 ? Math.round(((gastosMes - previous.percibidoTotal) / previous.percibidoTotal) * 100) : null

  const threshold = viewCurrency === 'USD' ? 5 : 5000
  const fugaItems = perceived.filter((e) => e.amount < threshold)
  const fugaTotal = fugaItems.reduce((s, e) => s + e.amount, 0)

  const compromisoTotal = compromisos?.totalComprometido ?? 0
  const compromisosPct = compromisos?.pctComprometido != null ? Math.round(compromisos.pctComprometido) : ingresosMes > 0 ? Math.round((compromisoTotal / ingresosMes) * 100) : 0
  const margen = ingresosMes - gastosMes

  return (
    <>
      <ViewHeader title="Análisis" meta={cap(monthName(selectedMonth)) + ' ' + selectedMonth.slice(0, 4)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 20, alignItems: 'start' }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...CARD_STYLE, padding: '24px 28px 22px' }}>
            <div style={{ ...LABEL_STYLE, marginBottom: 10 }}>Gastaste en {cap(monthName(selectedMonth))}</div>
            <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: '#0D1829', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmtMoney(gastosMes, viewCurrency, hidden)}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {deltaPct != null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 9999, background: deltaPct <= 0 ? 'rgba(26,122,66,0.09)' : 'rgba(184,74,18,0.09)', color: deltaPct <= 0 ? '#1A7A42' : '#B84A12', fontSize: 12, fontWeight: 700 }}>
                  <TrendDown weight="bold" size={11} />
                  {deltaPct > 0 ? '+' : ''}
                  {deltaPct}% vs. mes anterior
                </span>
              )}
              <span style={{ fontSize: 13, color: '#90A4B0' }}>
                de <strong style={{ color: '#0D1829' }}>{fmtMoney(ingresosMes, viewCurrency, hidden)}</strong> ingresos
              </span>
              <span style={{ fontSize: 13, color: '#90A4B0' }}>
                Margen: <strong style={{ color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(margen, viewCurrency, hidden)}</strong>
              </span>
            </div>
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(33,120,168,0.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4A6070', marginBottom: 10 }}>Necesidad / Deseo del mes</div>
              <NDBar necesidad={necesidad} deseo={deseo} />
            </div>
          </div>

          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0D1829' }}>Por categoría</h3>
              <span style={{ fontSize: 11, color: '#90A4B0' }}>top {categories.length}</span>
            </div>
            <div style={{ padding: '4px 22px' }}>
              {categories.length === 0 ? (
                <p style={{ fontSize: 14, color: '#90A4B0', padding: '16px 0' }}>Sin gastos percibidos este mes.</p>
              ) : (
                categories.map((cat, i) => (
                  <div key={cat.name} style={{ padding: '13px 0', borderBottom: i < categories.length - 1 ? '1px solid rgba(33,120,168,0.07)' : '0', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <CatSquare category={cat.name} size={36} iconSize={18} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829' }}>{cat.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ padding: '2px 7px', borderRadius: 9999, background: cat.nd === 'N' ? 'rgba(26,122,66,0.09)' : 'rgba(184,74,18,0.09)', color: cat.nd === 'N' ? '#1A7A42' : '#B84A12', fontSize: 10, fontWeight: 700 }}>
                            {cat.nd === 'N' ? 'Necesidad' : 'Deseo'}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>{fmtMoney(cat.amount, viewCurrency, hidden)}</span>
                          <span style={{ fontSize: 12, color: '#90A4B0', minWidth: 30, textAlign: 'right' }}>{cat.pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 3, background: 'rgba(33,120,168,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(cat.pct * 3, 100)}%`, height: '100%', background: cat.nd === 'N' ? '#1A7A42' : '#B84A12', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button type="button" onClick={() => onDrill('compromisos')} style={{ ...CARD_STYLE, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4A6070' }}>Compromisos del mes</span>
              <Badge tone={compromisosPct < 30 ? 'success' : 'warning'}>{compromisosPct < 30 ? 'Saludable' : 'Atención'}</Badge>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0D1829', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(compromisoTotal, viewCurrency, hidden)}</div>
            <div style={{ fontSize: 12, color: '#90A4B0', marginTop: 4 }}>{compromisosPct}% de ingresos comprometido</div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(33,120,168,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: BLUE }}>
              Ver detalle por tarjeta
              <ArrowRight weight="bold" size={12} />
            </div>
          </button>

          <button type="button" onClick={() => onDrill('fuga')} style={{ ...CARD_STYLE, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(184,74,18,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Drop weight="duotone" size={19} color="#B84A12" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4A6070' }}>Fuga silenciosa</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#B84A12', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(fugaTotal, viewCurrency, hidden)}</div>
            <div style={{ fontSize: 12, color: '#90A4B0', marginTop: 4 }}>
              {fugaItems.length} gastos chicos · menores a {formatAmount(threshold, viewCurrency)}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(33,120,168,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: BLUE }}>
              Ver desglose
              <ArrowRight weight="bold" size={12} />
            </div>
          </button>
        </div>
      </div>
    </>
  )
}

// ════════════════════════ DRILL: FUGA ════════════════════════
function DrillHeader({ onBack, eyebrow, title, sub }: { onBack: () => void; eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 18, background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: BLUE, padding: 0 }}>
        <ArrowLeft weight="bold" size={14} /> Volver a Análisis
      </button>
      <div style={{ ...LABEL_STYLE, color: BLUE, marginBottom: 8 }}>{eyebrow}</div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1829' }}>{title}</h1>
      {sub && <div style={{ fontSize: 13, color: '#90A4B0', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export function FugaView({ analyticsData, viewCurrency, gastosMes, selectedMonth, onBack }: DesktopViewProps & { onBack: () => void }) {
  const threshold = viewCurrency === 'USD' ? 5 : 5000
  const small = useMemo(() => (analyticsData?.rawExpenses ?? []).filter((e) => isPerceived(e, viewCurrency) && e.amount < threshold), [analyticsData?.rawExpenses, viewCurrency, threshold])

  const items = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>()
    for (const e of small) {
      const prev = map.get(e.category) ?? { amount: 0, count: 0 }
      prev.amount += e.amount
      prev.count += 1
      map.set(e.category, prev)
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, amount: v.amount, count: v.count, avg: v.amount / v.count }))
      .sort((a, b) => b.amount - a.amount)
  }, [small])

  const total = items.reduce((s, i) => s + i.amount, 0)
  const max = Math.max(...items.map((i) => i.amount), 1)
  const pctOfMonth = gastosMes > 0 ? Math.round((total / gastosMes) * 100) : 0

  return (
    <div style={{ maxWidth: 860 }}>
      <DrillHeader onBack={onBack} eyebrow="Fuga silenciosa" title="Los gastos chicos suman." sub={`${cap(monthName(selectedMonth))} · gastos menores a ${formatAmount(threshold, viewCurrency)}`} />

      <div style={{ ...CARD_STYLE, padding: '30px 32px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0, background: 'rgba(184,74,18,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Drop weight="duotone" size={32} color="#B84A12" />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ ...LABEL_STYLE, marginBottom: 10 }}>Se te fueron en gastos chicos</div>
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.04em', color: '#B84A12', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatAmount(total, viewCurrency)}</div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Badge tone="warning">{small.length} movimientos menores</Badge>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ ...CARD_STYLE, padding: '8px 28px 12px' }}>
          <div style={{ ...LABEL_STYLE, padding: '18px 0 6px' }}>Dónde se escapa</div>
          {items.map((item, i) => (
            <div key={item.category} style={{ padding: '15px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(33,120,168,0.07)' : '0', display: 'flex', alignItems: 'center', gap: 14 }}>
              <CatSquare category={item.category} size={38} iconSize={19} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829' }}>{item.category}</div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(item.amount, viewCurrency)}</span>
                </div>
                <div style={{ height: 4, borderRadius: 3, background: 'rgba(33,120,168,0.08)', overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${(item.amount / max) * 100}%`, height: '100%', background: '#B84A12', borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 11, color: '#90A4B0' }}>
                  {item.count} compras · promedio <strong style={{ color: '#4A6070' }}>{formatAmount(item.avg, viewCurrency)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 13, color: '#90A4B0', lineHeight: 1.6, marginTop: 18, maxWidth: 560 }}>
        La fuga silenciosa son compras individualmente bajas que, juntas, equivalen a <strong style={{ color: '#0D1829' }}>{pctOfMonth}%</strong> de tu gasto del mes.
      </p>
    </div>
  )
}

// ════════════════════════ DRILL: COMPROMISOS ════════════════════════
function Donut({ percent, size = 108, stroke = 10, color = BLUE }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (Math.min(Math.max(percent, 0), 100) / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(33,120,168,0.12)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.2} fontWeight="800" fill="#0D1829">
        {percent}%
      </text>
    </svg>
  )
}

function CompromisoRow({ item, last, currency }: { item: { name: string; amount: number; due: string | null; daysUntil: number | null; pctIngreso: number; pctTotal: number }; last: boolean; currency: 'ARS' | 'USD' }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: last ? '0' : '1px solid rgba(33,120,168,0.07)' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <CatSquare category="Pago de Tarjetas" size={38} iconSize={19} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0D1829' }}>{item.name}</div>
          <div style={{ fontSize: 12, color: '#90A4B0', marginTop: 2 }}>
            {item.due ? `Vence ${fmtDue(item.due)}` : 'Sin vencimiento'}
            {item.daysUntil != null ? ` · en ${item.daysUntil} días` : ''}
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatAmount(item.amount, currency)}</div>
        {open ? <CaretUp weight="bold" size={12} color="#90A4B0" /> : <CaretDown weight="bold" size={12} color="#90A4B0" />}
      </button>
      {open && (
        <div style={{ background: '#F4F7FA', borderRadius: 12, padding: '16px 18px', marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 6 }}>% del ingreso</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{item.pctIngreso}%</div>
          </div>
          <div>
            <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 6 }}>% del compromiso total</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{item.pctTotal}%</div>
            <div style={{ height: 4, borderRadius: 3, background: 'rgba(33,120,168,0.10)', overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: `${item.pctTotal}%`, height: '100%', background: BLUE, borderRadius: 3 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function CompromisosView({ compromisos, viewCurrency, ingresosMes, onBack }: DesktopViewProps & { onBack: () => void }) {
  const total = compromisos?.totalComprometido ?? 0
  const ingreso = compromisos?.ingresoMes ?? ingresosMes
  const pct = compromisos?.pctComprometido != null ? Math.round(compromisos.pctComprometido) : ingreso > 0 ? Math.round((total / ingreso) * 100) : 0

  const items = useMemo(() => {
    const tarjetas = (compromisos?.tarjetas ?? []).filter((t) => t.debtTotal + t.currentSpend > 0)
    return tarjetas.map((t) => {
      const committed = t.debtTotal + t.currentSpend
      return {
        name: t.name,
        amount: committed,
        due: t.dueDate,
        daysUntil: t.daysUntilDue,
        pctIngreso: ingreso > 0 ? Math.round((committed / ingreso) * 1000) / 10 : 0,
        pctTotal: total > 0 ? Math.round((committed / total) * 100) : 0,
      }
    })
  }, [compromisos, ingreso, total])

  return (
    <div style={{ maxWidth: 860 }}>
      <DrillHeader onBack={onBack} eyebrow="Compromisos del mes" title="Lo que ya está comprometido." sub="Tarjetas y pagos del ciclo anterior" />

      <div style={{ ...CARD_STYLE, padding: '30px 32px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <Donut percent={pct} size={108} stroke={10} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={LABEL_STYLE}>Total comprometido</span>
            <Badge tone={pct < 30 ? 'success' : 'warning'}>{pct < 30 ? 'Saludable' : 'Atención'}</Badge>
          </div>
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1829', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatAmount(total, viewCurrency)}</div>
          <div style={{ fontSize: 13, color: '#90A4B0', marginTop: 12 }}>
            {pct}% de tus <strong style={{ color: '#0D1829' }}>{formatAmount(ingreso, viewCurrency)}</strong> de ingresos · {items.length} {items.length === 1 ? 'tarjeta' : 'tarjetas'}
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(33,120,168,0.05)', border: '1px solid rgba(33,120,168,0.12)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 12, color: '#4A6070', lineHeight: 1.5, display: 'flex', gap: 10 }}>
        <Info weight="duotone" size={16} color={BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
        Por debajo del 30% de los ingresos se considera saludable. Tocá cada tarjeta para ver su peso individual.
      </div>

      {items.length > 0 && (
        <div style={{ ...CARD_STYLE, padding: '8px 28px' }}>
          <div style={{ ...LABEL_STYLE, padding: '18px 0 4px' }}>Por tarjeta</div>
          {items.map((item, i) => (
            <CompromisoRow key={item.name} item={item} last={i === items.length - 1} currency={viewCurrency} />
          ))}
        </div>
      )}
    </div>
  )
}
