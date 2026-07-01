'use client'

import type { CSSProperties } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowsLeftRight,
  ArrowUpRight,
  CreditCard,
  LockSimple,
  MinusCircle,
  PencilSimple,
  PlusCircle,
  Receipt,
  Target,
  TrendDown,
  TrendUp,
  Warning,
} from '@phosphor-icons/react'
import type { BudgetSnapshot, BudgetStatus } from '@/lib/budgets/types'
import type { GoalWithMetrics, GoalPaceStatus } from '@/lib/goals/types'
import type { Instrument } from '@/types/database'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import { BLUE, CARD_STYLE, CatSquare, LABEL_STYLE } from './desktop-ui'
import type { NavId } from './desktop-chrome'
import type { AttentionSignal, HorizonEvent, RecentActivityItem } from './desktop-dashboard-model'

type Money = (n: number, currency?: 'ARS' | 'USD') => string
type TarjetaItem = CompromisosData['tarjetas'][number]

export type AccountRow = { id: string; name: string; type: string; isPrimary: boolean; saldo: number; color: string }

const SOFT_BG = '#F8FBFD'

const BUDGET_STATUS: Record<BudgetStatus, { label: string; color: string; amountColor: string; bg: string; bar: string }> = {
  on_track: { label: 'En línea', color: '#4A6070', amountColor: '#0D1829', bg: 'rgba(74,96,112,0.10)', bar: BLUE },
  near_limit: { label: 'Al límite', color: '#B84A12', amountColor: '#B84A12', bg: 'rgba(184,74,18,0.10)', bar: '#B84A12' },
  over_budget: { label: 'Pasado', color: '#A61E1E', amountColor: '#A61E1E', bg: 'rgba(166,30,30,0.09)', bar: '#A61E1E' },
  ahead_of_pace: { label: 'Con aire', color: BLUE, amountColor: '#0D1829', bg: 'rgba(33,120,168,0.09)', bar: BLUE },
}

const GOAL_PACE: Record<GoalPaceStatus, { label: string; color: string }> = {
  on_track: { label: 'En ritmo', color: '#1A7A42' },
  behind: { label: 'Atrasada', color: '#B84A12' },
  completed: { label: 'Cumplida', color: '#1A7A42' },
  no_date: { label: 'Sin fecha', color: '#4A6070' },
  paused: { label: 'Pausada', color: '#90A4B0' },
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

const bigNum: CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: '#0D1829' }

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
          Todavía no armaste un presupuesto. Definí un marco por categoría para seguir el mes con más claridad.
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

// ─── METAS (compact, real) ───────────────────────────────────
export function MetasModule({
  goals,
  activeCount,
  money,
  onNav,
}: {
  goals: GoalWithMetrics[]
  activeCount: number
  money: Money
  onNav: (id: NavId) => void
}) {
  if (goals.length === 0) {
    return (
      <ModuleCard title="Metas" action="Crear meta" onAction={() => onNav('metas')}>
        <p style={{ fontSize: 14, color: '#4A6070', lineHeight: 1.6, margin: 0 }}>
          Todavía no tenés metas. Creá objetivos y registrá aportes para seguir tu progreso.
        </p>
      </ModuleCard>
    )
  }
  const saved = goals.reduce((s, g) => s + g.currentAmount, 0)
  const target = goals.reduce((s, g) => s + g.targetAmount, 0)
  const pct = target > 0 ? saved / target : 0
  const ccy = goals[0].currency
  return (
    <ModuleCard
      title="Metas"
      tag={`${activeCount} activa${activeCount !== 1 ? 's' : ''}`}
      tagTone="primary"
      action="Ver metas"
      onAction={() => onNav('metas')}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={bigNum}>{money(saved, ccy)}</span>
        <span style={{ fontSize: 15, color: '#90A4B0', fontWeight: 500 }}>de {money(target, ccy)}</span>
      </div>
      <div style={{ fontSize: 13, color: '#4A6070', marginBottom: 14 }}>
        {Math.round(pct * 100)}% del total objetivo alcanzado
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(33,120,168,0.09)', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ width: `${Math.min(pct, 1) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#2178A8,#1B7E9E)', borderRadius: 4 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {goals.map((g) => {
          const gp = g.progressPct
          const pace = GOAL_PACE[g.paceStatus]
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'rgba(33,120,168,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, lineHeight: 1 }}>
                {g.emoji ? g.emoji : <Target size={16} color={BLUE} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pace.color, flexShrink: 0 }}>{Math.round(gp * 100)}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(33,120,168,0.09)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(gp, 1) * 100}%`, height: '100%', background: g.paceStatus === 'behind' ? '#B84A12' : BLUE, borderRadius: 3 }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ModuleCard>
  )
}

// ─── TARJETAS (próximos cierres / consumo) ───────────────────
export function TarjetasModule({
  tarjetas,
  money,
  onNav,
}: {
  tarjetas: TarjetaItem[]
  money: Money
  onNav: (id: NavId) => void
}) {
  if (tarjetas.length === 0) {
    return (
      <ModuleCard title="Tarjetas" action="Ver tarjetas" onAction={() => onNav('tarjetas')}>
        <p style={{ fontSize: 14, color: '#4A6070', margin: 0 }}>Sin tarjetas activas.</p>
      </ModuleCard>
    )
  }
  const sorted = [...tarjetas].sort((a, b) => (a.daysUntilClosing ?? 99) - (b.daysUntilClosing ?? 99))
  const next = sorted[0]
  return (
    <ModuleCard
      title="Tarjetas"
      tag={next.daysUntilClosing != null ? `cierra en ${next.daysUntilClosing} días` : undefined}
      tagTone={(next.daysUntilClosing ?? 99) <= 5 ? 'warn' : 'primary'}
      action="Ver tarjetas"
      onAction={() => onNav('tarjetas')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sorted.map((c) => {
          const progress = Math.max(0.05, Math.min(0.97, (30 - (c.daysUntilClosing ?? 15)) / 30))
          return (
            <div key={c.id} style={{ padding: '14px 16px', borderRadius: 14, background: SOFT_BG, border: '1px solid rgba(33,120,168,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 700, color: '#0D1829' }}>
                  <CreditCard weight="light" size={17} color={BLUE} />
                  {c.name}
                </span>
                {c.dueDate && (
                  <span style={{ fontSize: 11, color: '#90A4B0' }}>
                    vence {new Date(`${c.dueDate}T12:00:00-03:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#4A6070' }}>Consumo del ciclo</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#0D1829' }}>{money(c.currentSpend, 'ARS')}</span>
              </div>
              <div style={{ position: 'relative', height: 5, borderRadius: 3, background: 'rgba(33,120,168,0.10)' }}>
                <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: '#0D1829', borderRadius: 3 }} />
                <div style={{ position: 'absolute', left: `${Math.round(progress * 100)}%`, top: -3, width: 2, height: 11, background: BLUE, transform: 'translateX(-50%)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </ModuleCard>
  )
}

// ─── CUENTAS (resumen por cuenta) ────────────────────────────
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
    <ModuleCard title="Cuentas" tag={`${accounts.length}`} tagTone="muted" action="Ver cuentas" onAction={() => onNav('cuentas')}>
      <div style={{ marginBottom: 6, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#0D1829' }}>{money(total)}</div>
      <div style={{ fontSize: 12, color: '#90A4B0', marginBottom: 16 }}>Saldo total sincronizado</div>
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
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', flexShrink: 0 }}>{money(a.saldo)}</span>
          </div>
        ))}
      </div>
    </ModuleCard>
  )
}

// ─── INSTRUMENTOS / rendimientos ─────────────────────────────
export function InstrumentosModule({
  instruments,
  money,
  onNav,
}: {
  instruments: Instrument[]
  money: Money
  onNav: (id: NavId) => void
}) {
  if (instruments.length === 0) {
    return (
      <ModuleCard title="Instrumentos" action="Ver instrumentos" onAction={() => onNav('instrumentos')}>
        <p style={{ fontSize: 14, color: '#4A6070', margin: 0 }}>No hay instrumentos activos.</p>
      </ModuleCard>
    )
  }
  const total = instruments.reduce((s, i) => s + i.amount, 0)
  return (
    <ModuleCard title="Instrumentos" tag={`${instruments.length} activos`} tagTone="primary" action="Ver instrumentos" onAction={() => onNav('instrumentos')}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#0D1829' }}>{money(total)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: '#1A7A42' }}>
          <TrendUp weight="bold" size={12} />rinde
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#90A4B0', marginBottom: 16 }}>Capital invertido</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {instruments.map((inst) => (
          <div key={inst.id} style={{ padding: '14px 15px', borderRadius: 12, background: SOFT_BG, border: '1px solid rgba(33,120,168,0.07)' }}>
            <div style={{ ...LABEL_STYLE, fontSize: 9.5, marginBottom: 8 }}>{inst.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'} · {inst.currency}</div>
            <div style={{ fontSize: 12, color: '#4A6070', marginBottom: 8, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {inst.label?.trim() ? inst.label.trim() : inst.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: '#0D1829', marginBottom: 6 }}>{money(inst.amount, inst.currency)}</div>
            <div style={{ fontSize: 11, color: '#90A4B0' }}>
              {inst.type === 'plazo_fijo' && inst.due_date
                ? `vence ${new Date(`${inst.due_date}T12:00:00-03:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
                : 'disponible'}
            </div>
          </div>
        ))}
      </div>
    </ModuleCard>
  )
}

// ─── ÚLTIMOS MOVIMIENTOS (preview) ───────────────────────────
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

// ════════════════ RIGHT RAIL ════════════════
const QUICK: Array<{ id: string; label: string; icon: typeof MinusCircle; color: string; nav: NavId }> = [
  { id: 'gasto', label: 'Registrar gasto', icon: MinusCircle, color: '#B84A12', nav: 'movimientos' },
  { id: 'ingreso', label: 'Registrar ingreso', icon: PlusCircle, color: '#1A7A42', nav: 'movimientos' },
  { id: 'meta', label: 'Aportar a meta', icon: Target, color: BLUE, nav: 'metas' },
  { id: 'transfer', label: 'Transferencia', icon: ArrowsLeftRight, color: '#1B7E9E', nav: 'movimientos' },
]

export function RailAcciones({ onNav }: { onNav: (id: NavId) => void }) {
  return (
    <div style={{ ...CARD_STYLE, padding: '20px 22px' }}>
      <div style={{ ...LABEL_STYLE, marginBottom: 16 }}>Acciones rápidas</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {QUICK.map((q) => {
          const IconCmp = q.icon
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onNav(q.nav)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 9, padding: '14px', borderRadius: 13, background: SOFT_BG, border: '1px solid rgba(33,120,168,0.08)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 9, background: `${q.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCmp weight="light" size={18} color={q.color} />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0D1829', lineHeight: 1.25 }}>{q.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RailAlertas({ signals }: { signals: AttentionSignal[] }) {
  if (signals.length === 0) {
    return (
      <div style={{ ...CARD_STYLE, padding: '20px 22px' }}>
        <div style={{ ...LABEL_STYLE, marginBottom: 12 }}>Para revisar</div>
        <p style={{ fontSize: 13, color: '#4A6070', lineHeight: 1.5, margin: 0 }}>Sin señales urgentes. La lectura del mes está estable.</p>
      </div>
    )
  }
  return (
    <div style={{ ...CARD_STYLE, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ ...LABEL_STYLE, color: '#B84A12' }}>Para revisar</span>
        <Warning weight="fill" size={13} color="#B84A12" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {signals.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 9999, marginTop: 6, flexShrink: 0, background: a.tone === 'high' ? '#A61E1E' : a.tone === 'medium' ? '#B84A12' : BLUE }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1829', lineHeight: 1.4 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: '#4A6070', marginTop: 3, lineHeight: 1.45 }}>{a.detail}</div>
              <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 4 }}>{a.dateLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ATENCIÓN AHORA (señales accionables, main module) ───────
const ATTENTION_TONE: Record<AttentionSignal['tone'], { color: string; bg: string }> = {
  high: { color: '#A61E1E', bg: 'rgba(166,30,30,0.09)' },
  medium: { color: '#B84A12', bg: 'rgba(184,74,18,0.10)' },
  low: { color: BLUE, bg: 'rgba(33,120,168,0.09)' },
}

function attentionIcon(id: string): typeof CreditCard {
  if (id.startsWith('closing-') || id.startsWith('due-')) return CreditCard
  if (id.startsWith('extra-')) return Receipt
  return PencilSimple
}

export function AtencionAhoraModule({ signals }: { signals: AttentionSignal[] }) {
  if (signals.length === 0) {
    return (
      <div style={{ ...CARD_STYLE, padding: '22px 24px', height: '100%' }}>
        <div style={{ ...LABEL_STYLE, marginBottom: 14 }}>Atención ahora</div>
        <p style={{ fontSize: 14, color: '#4A6070', lineHeight: 1.5, margin: 0 }}>
          Sin señales urgentes. La lectura del mes está estable.
        </p>
      </div>
    )
  }
  return (
    <div style={{ ...CARD_STYLE, padding: '22px 24px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={LABEL_STYLE}>Atención ahora</span>
        <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 9999, background: 'rgba(33,120,168,0.09)', color: BLUE, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {signals.length}
        </span>
      </div>
      <div>
        {signals.map((a, i) => {
          const tone = ATTENTION_TONE[a.tone]
          const IconCmp = attentionIcon(a.id)
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '15px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 1, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCmp weight="light" size={18} color={tone.color} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', lineHeight: 1.35 }}>{a.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tone.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{a.dateLabel}</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#4A6070', marginTop: 3, lineHeight: 1.45 }}>{a.detail}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── PRÓXIMOS 30 DÍAS (agenda agrupada por mes) ──────────────
const HORIZON_BADGE: Record<HorizonEvent['kind'], { label: string; color: string; bg: string; sign: '' | '+' | '−'; showAmount: boolean; amountColor: string }> = {
  card: { label: 'Cierre', color: BLUE, bg: 'rgba(33,120,168,0.09)', sign: '', showAmount: false, amountColor: '#0D1829' },
  due: { label: 'Vence', color: '#B84A12', bg: 'rgba(184,74,18,0.10)', sign: '', showAmount: true, amountColor: '#0D1829' },
  instrument: { label: 'Libera', color: '#1A7A42', bg: 'rgba(26,122,66,0.10)', sign: '+', showAmount: true, amountColor: '#1A7A42' },
  income: { label: 'Ingreso', color: '#1A7A42', bg: 'rgba(26,122,66,0.10)', sign: '+', showAmount: true, amountColor: '#1A7A42' },
}

function monthGroupLabel(dateStr: string): string {
  const raw = new Date(`${dateStr}T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' })
  return raw.toUpperCase()
}

export function Proximos30Module({
  events,
  money,
  onNav,
  limit = 6,
}: {
  events: HorizonEvent[]
  money: Money
  onNav: (id: NavId) => void
  limit?: number
}) {
  const shown = events.slice(0, limit)
  const groups: Array<{ label: string; items: HorizonEvent[] }> = []
  for (const ev of shown) {
    const label = monthGroupLabel(ev.date)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(ev)
    else groups.push({ label, items: [ev] })
  }
  return (
    <div style={{ ...CARD_STYLE, padding: '22px 24px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={LABEL_STYLE}>Próximos 30 días</span>
        <button
          type="button"
          onClick={() => onNav('analisis')}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: 'inherit' }}
        >
          Ver agenda <ArrowRight size={11} />
        </button>
      </div>
      {shown.length === 0 ? (
        <p style={{ fontSize: 14, color: '#4A6070', margin: '10px 0 0' }}>Sin eventos próximos por delante.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <div style={{ ...LABEL_STYLE, fontSize: 9.5, color: '#B8C9D4', margin: '16px 0 2px' }}>{group.label}</div>
            {group.items.map((ev) => {
              const badge = HORIZON_BADGE[ev.kind]
              const d = new Date(`${ev.date}T12:00:00-03:00`)
              return (
                <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 14, alignItems: 'center', padding: '13px 0', borderTop: '1px solid rgba(33,120,168,0.07)' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1829', lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#90A4B0', marginTop: 2 }}>
                      {d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#90A4B0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.subtitle}</div>
                  </div>
                  {badge.showAmount && ev.amount !== undefined && ev.amount > 0 ? (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: badge.amountColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {badge.sign}{money(ev.amount, ev.currency ?? 'ARS')}
                      </div>
                      {ev.estimated && <div style={{ fontSize: 10, color: '#90A4B0', marginTop: 1 }}>estimado</div>}
                    </div>
                  ) : (
                    <span />
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

// ─── COMPROMISOS DEL MES (resumen de deuda por tarjeta) ──────
export function CompromisosTotalesModule({
  compromisos,
  money,
  onNav,
}: {
  compromisos: CompromisosData | null
  money: Money
  onNav: (id: NavId) => void
}) {
  const total = compromisos?.totalComprometido ?? 0
  const porPagar = compromisos?.totalAPagar ?? 0
  const enCurso = compromisos?.totalEnCurso ?? 0
  const barTotal = Math.max(porPagar + enCurso, 1)

  const rows = [
    { key: 'pagar', label: 'Resúmenes por pagar', badge: 'por pagar', badgeColor: BLUE, badgeBg: 'rgba(33,120,168,0.09)', dot: BLUE, amount: porPagar },
    { key: 'curso', label: 'Consumo del ciclo', badge: 'en curso', badgeColor: '#4A6070', badgeBg: 'rgba(74,96,112,0.10)', dot: '#1B7E9E', amount: enCurso },
  ].filter((r) => r.amount > 0)

  return (
    <ModuleCard title="Compromisos del mes" action="Ver en Tarjetas" onAction={() => onNav('tarjetas')}>
      {total <= 0 ? (
        <p style={{ fontSize: 14, color: '#4A6070', margin: 0 }}>Sin compromisos de tarjeta este mes.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.035em', color: '#0D1829' }}>{money(total)}</span>
            <span style={{ fontSize: 13, color: '#90A4B0' }}>comprometido este mes</span>
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 20, background: 'rgba(33,120,168,0.06)' }}>
            {porPagar > 0 && <div style={{ flex: porPagar / barTotal, background: BLUE }} />}
            {enCurso > 0 && <div style={{ flex: enCurso / barTotal, background: '#1B7E9E' }} />}
          </div>
          <div>
            {rows.map((r, i) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, flexShrink: 0, background: r.dot }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1829' }}>{r.label}</span>
                <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: r.badgeBg, color: r.badgeColor }}>{r.badge}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(r.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ModuleCard>
  )
}

// ─── LO QUE VIENE (horizonte, main column) ───────────────────
const HORIZON_META: Record<HorizonEvent['kind'], { section: NavId; color: string; bg: string; icon: typeof CreditCard; sign: string }> = {
  card: { section: 'tarjetas', color: '#A61E1E', bg: 'rgba(166,30,30,0.09)', icon: CreditCard, sign: '−' },
  due: { section: 'tarjetas', color: '#A61E1E', bg: 'rgba(166,30,30,0.09)', icon: CreditCard, sign: '−' },
  income: { section: 'movimientos', color: '#1A7A42', bg: 'rgba(26,122,66,0.10)', icon: ArrowDownLeft, sign: '+' },
  instrument: { section: 'instrumentos', color: '#1A7A42', bg: 'rgba(26,122,66,0.10)', icon: LockSimple, sign: '+' },
}

function relLabel(dateStr: string, today: Date): string {
  const d = new Date(`${dateStr}T12:00:00-03:00`)
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days <= 30) return `en ${days} días`
  return `en ${Math.round(days / 7)} sem`
}

export function LoQueVieneModule({
  events,
  money,
  onNav,
}: {
  events: HorizonEvent[]
  money: Money
  onNav: (id: NavId) => void
}) {
  const today = new Date()
  const top = events.slice(0, 6)
  if (top.length === 0) {
    return (
      <div style={{ ...CARD_STYLE, padding: '22px 24px' }}>
        <div style={{ ...LABEL_STYLE, marginBottom: 12 }}>Próximos eventos</div>
        <p style={{ fontSize: 14, color: '#4A6070', margin: 0 }}>Sin eventos próximos en los próximos 90 días.</p>
      </div>
    )
  }
  return (
    <div style={{ ...CARD_STYLE, padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={LABEL_STYLE}>Próximos eventos</span>
          <span style={{ padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: 'rgba(33,120,168,0.09)', color: BLUE }}>{events.length} en 90 días</span>
        </div>
        <span style={{ fontSize: 12, color: '#90A4B0' }}>Tocá cada uno para ver el detalle</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {top.map((ev) => {
          const meta = HORIZON_META[ev.kind]
          const IconCmp = meta.icon
          const d = new Date(`${ev.date}T12:00:00-03:00`)
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => onNav(meta.section)}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: SOFT_BG, border: '1px solid rgba(33,120,168,0.08)', borderRadius: 14, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCmp weight="light" size={17} color={meta.color} />
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#90A4B0' }}>{relLabel(ev.date, today)}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                <div style={{ fontSize: 11.5, color: '#90A4B0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.subtitle}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#90A4B0' }}>
                  {d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}{ev.estimated ? ' · est.' : ''}
                </span>
                {ev.amount !== undefined && ev.amount > 0 && (
                  <span style={{ fontSize: 14, fontWeight: 800, color: meta.color, fontVariantNumeric: 'tabular-nums' }}>
                    {meta.sign}{money(ev.amount, ev.currency ?? 'ARS')}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── INSIGHTS BREVES (→ Análisis) ────────────────────────────
export function InsightsModule({
  gastoTrendPct,
  resultadoMes,
  tasaAhorroPct,
  money,
  onNav,
}: {
  gastoTrendPct: number | null
  resultadoMes: number
  tasaAhorroPct: number | null
  money: Money
  onNav: (id: NavId) => void
}) {
  const insights: Array<{ key: string; icon: typeof TrendDown; color: string; bg: string; label: string; value: string; note: string }> = []

  if (gastoTrendPct !== null) {
    const down = gastoTrendPct <= 0
    insights.push({
      key: 'gasto',
      icon: down ? TrendDown : TrendUp,
      color: down ? '#1A7A42' : '#B84A12',
      bg: down ? 'rgba(26,122,66,0.10)' : 'rgba(184,74,18,0.10)',
      label: 'Gasto del mes',
      value: `${down ? '↓' : '↑'} ${Math.abs(Math.round(gastoTrendPct))}%`,
      note: down ? 'vs mes anterior, vas mejor' : 'vs mes anterior',
    })
  }

  insights.push({
    key: 'resultado',
    icon: resultadoMes >= 0 ? TrendUp : TrendDown,
    color: resultadoMes >= 0 ? '#1A7A42' : '#A61E1E',
    bg: resultadoMes >= 0 ? 'rgba(26,122,66,0.10)' : 'rgba(166,30,30,0.09)',
    label: 'Resultado del mes',
    value: money(resultadoMes),
    note: resultadoMes >= 0 ? 'ingresos menos gastos' : 'gastás más de lo que entra',
  })

  if (tasaAhorroPct !== null) {
    insights.push({
      key: 'ahorro',
      icon: ArrowUpRight,
      color: BLUE,
      bg: 'rgba(33,120,168,0.09)',
      label: 'Tasa de ahorro',
      value: `${Math.round(tasaAhorroPct)}%`,
      note: 'sobre tus ingresos',
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      {insights.map((s) => {
        const IconCmp = s.icon
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onNav('analisis')}
            style={{ ...CARD_STYLE, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
          >
            <span style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCmp weight="light" size={21} color={s.color} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#0D1829' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#90A4B0', marginTop: 1 }}>{s.note}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
