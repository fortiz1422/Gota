'use client'

import { ArrowDownLeft, ArrowRight, ArrowsLeftRight } from '@phosphor-icons/react'
import type { BudgetSnapshot, BudgetStatus } from '@/lib/budgets/types'
import { BLUE, CARD_STYLE, CatSquare, LABEL_STYLE } from './desktop-ui'
import type { NavId } from './desktop-chrome'
import type { RecentActivityItem } from './desktop-dashboard-model'

type Money = (n: number, currency?: 'ARS' | 'USD') => string

export type AccountRow = { id: string; name: string; type: string; isPrimary: boolean; saldo: number; color: string }

const BUDGET_STATUS: Record<BudgetStatus, { label: string; color: string; amountColor: string; bg: string; bar: string }> = {
  on_track: { label: 'En línea', color: '#4A6070', amountColor: '#0D1829', bg: 'rgba(74,96,112,0.10)', bar: BLUE },
  near_limit: { label: 'Al límite', color: '#B84A12', amountColor: '#B84A12', bg: 'rgba(184,74,18,0.10)', bar: '#B84A12' },
  over_budget: { label: 'Pasado', color: '#A61E1E', amountColor: '#A61E1E', bg: 'rgba(166,30,30,0.09)', bar: '#A61E1E' },
  ahead_of_pace: { label: 'Con aire', color: BLUE, amountColor: '#0D1829', bg: 'rgba(33,120,168,0.09)', bar: BLUE },
}

// ─── Module card wrapper ─────────────────────────────────────
type TagTone = 'primary' | 'warn' | 'danger' | 'muted'

function ModuleCard({
  title,
  tag,
  tagTone = 'primary',
  action,
  onAction,
  children,
  pad = '22px 24px',
}: {
  title: string
  tag?: string
  tagTone?: TagTone
  action?: string
  onAction?: () => void
  children: React.ReactNode
  pad?: string
}) {
  const tone = {
    warn: { c: '#B84A12', bg: 'rgba(184,74,18,0.10)' },
    danger: { c: '#A61E1E', bg: 'rgba(166,30,30,0.09)' },
    muted: { c: '#90A4B0', bg: 'rgba(144,164,176,0.12)' },
    primary: { c: BLUE, bg: 'rgba(33,120,168,0.09)' },
  }[tagTone]
  return (
    <div style={{ ...CARD_STYLE, padding: pad, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={LABEL_STYLE}>{title}</span>
          {tag && (
            <span style={{ padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: tone.bg, color: tone.c }}>{tag}</span>
          )}
        </div>
        {action && onAction && (
          <button
            type="button"
            onClick={onAction}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: 'inherit' }}
          >
            {action} <ArrowRight size={11} />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

const bigNum: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: '#0D1829' }

// ─── PRESUPUESTO (compact) ───────────────────────────────────
export function PresupuestoModule({
  budget,
  money,
  onNav,
}: {
  budget: BudgetSnapshot | null
  money: Money
  onNav: (id: NavId) => void
}) {
  if (!budget?.plan || budget.items.length === 0) {
    return (
      <ModuleCard title="Presupuesto mensual" action="Armar plan" onAction={() => onNav('presupuestos')}>
        <p style={{ fontSize: 14, color: '#4A6070', lineHeight: 1.6, margin: 0 }}>
          Falta presupuesto para comparar tu ritmo por categoría. Definí un marco simple para seguir el mes con más claridad.
        </p>
      </ModuleCard>
    )
  }
  const { summary, items } = budget
  const ccy = budget.plan.baseCurrency
  const spentPct = summary.totalBudgeted > 0 ? summary.totalSpent / summary.totalBudgeted : 0
  const tone = summary.overBudgetCount > 0 ? '#A61E1E' : summary.nearLimitCount > 0 ? '#B84A12' : BLUE
  const top = [...items].sort((a, b) => b.usedPct - a.usedPct).slice(0, 3)
  return (
    <ModuleCard
      title="Presupuesto mensual"
      tag={`${Math.round(spentPct * 100)}% usado`}
      tagTone={summary.overBudgetCount ? 'danger' : summary.nearLimitCount ? 'warn' : 'primary'}
      action="Ver presupuesto"
      onAction={() => onNav('presupuestos')}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={bigNum}>{money(summary.totalSpent, ccy)}</span>
        <span style={{ fontSize: 15, color: '#90A4B0', fontWeight: 500 }}>de {money(summary.totalBudgeted, ccy)}</span>
      </div>
      <div style={{ fontSize: 13, color: '#4A6070', marginBottom: 14 }}>
        Te quedan <strong style={{ color: tone }}>{money(summary.totalRemaining, ccy)}</strong> para repartir
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(33,120,168,0.09)', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ width: `${Math.min(spentPct, 1) * 100}%`, height: '100%', background: tone, borderRadius: 4 }} />
      </div>

      <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 12 }}>Principales categorías</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {top.map((c) => {
          const m = BUDGET_STATUS[c.status] ?? BUDGET_STATUS.on_track
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CatSquare category={c.category} size={32} iconSize={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.amountColor, flexShrink: 0 }}>{money(c.spentAmount, ccy)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(33,120,168,0.09)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(c.usedPct, 1) * 100}%`, height: '100%', background: m.bar, borderRadius: 3 }} />
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: m.bg, color: m.color, flexShrink: 0 }}>{m.label}</span>
            </div>
          )
        })}
      </div>
    </ModuleCard>
  )
}

// ─── CUENTAS (dónde está la plata) ───────────────────────────
export function CuentasModule({
  accounts,
  money,
  onNav,
}: {
  accounts: AccountRow[]
  money: Money
  onNav: (id: NavId) => void
}) {
  const total = accounts.reduce((s, a) => s + a.saldo, 0)
  return (
    <ModuleCard title="Liquidez" tag={`${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}`} tagTone="muted" action="Ver cuentas" onAction={() => onNav('cuentas')}>
      <div style={{ marginBottom: 6, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{money(total)}</div>
      <div style={{ fontSize: 12, color: '#90A4B0', marginBottom: 16 }}>Dónde está tu plata hoy</div>
      <div>
        {accounts.map((a, i) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${a.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: a.color }}>
              {a.name.charAt(0).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.name}
                {a.isPrimary && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 700, color: BLUE }}>· Principal</span>}
              </div>
              <div style={{ fontSize: 11, color: '#90A4B0' }}>{a.type}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{money(a.saldo)}</span>
          </div>
        ))}
      </div>
    </ModuleCard>
  )
}

// ─── ACTIVIDAD RECIENTE (preview) ────────────────────────────
export function MovimientosModule({
  items,
  hidden,
  onNav,
  limit = 6,
  title = 'Últimos movimientos',
}: {
  items: RecentActivityItem[]
  hidden: boolean
  onNav: (id: NavId) => void
  limit?: number
  title?: string
}) {
  return (
    <ModuleCard title={title} action="Ver todos" onAction={() => onNav('movimientos')}>
      {items.length === 0 ? (
        <p style={{ fontSize: 14, color: '#4A6070', margin: 0 }}>Sin movimientos registrados este mes.</p>
      ) : (
        <div>
          {items.slice(0, limit).map((item, i) => {
            const isIncome = item.tone === 'positive'
            const isTransfer = item.subtitle.includes('→')
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                {isIncome ? (
                  <span style={{ width: 32, height: 32, borderRadius: 9999, flexShrink: 0, background: 'rgba(26,122,66,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowDownLeft weight="bold" size={15} color="#1A7A42" />
                  </span>
                ) : isTransfer ? (
                  <span style={{ width: 32, height: 32, borderRadius: 9999, flexShrink: 0, background: 'rgba(27,126,158,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowsLeftRight weight="bold" size={15} color="#1B7E9E" />
                  </span>
                ) : (
                  <CatSquare category={item.subtitle} size={32} iconSize={16} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 1 }}>{item.subtitle}</div>
                </div>
                <span style={{ fontSize: 11, color: '#90A4B0', flexShrink: 0, whiteSpace: 'nowrap' }}>{item.dateLabel}</span>
                <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0, color: isIncome ? '#1A7A42' : item.tone === 'neutral' && isTransfer ? '#90A4B0' : '#0D1829', minWidth: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {hidden ? '••••' : item.amountLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </ModuleCard>
  )
}
