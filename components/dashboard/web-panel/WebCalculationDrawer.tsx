'use client'

import { useId } from 'react'
import { X } from '@phosphor-icons/react'
import { FullScreenSheet } from '@/components/ui/FullScreenSheet'
import { fmtMoney } from '@/components/dashboard/desktop/desktop-ui'
import type { MoneyEquation } from '@/lib/web-panel/panel-model'

export function WebCalculationDrawer({
  open,
  onClose,
  equation,
  currency,
  hidden,
  accounts,
}: {
  open: boolean
  onClose: () => void
  equation: MoneyEquation
  currency: 'ARS' | 'USD'
  hidden: boolean
  accounts: Array<{ id: string; name: string; saldo: number }>
}) {
  const titleId = useId()
  return (
    <FullScreenSheet open={open} onClose={onClose} labelledBy={titleId} surface="drawer">
      <div className="min-h-full bg-white">
        <header className="flex h-[66px] items-center border-b border-[rgba(33,120,168,.10)] px-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.09em] text-text-tertiary">Trazabilidad</p>
            <h2 id={titleId} className="mt-0.5 text-[17px] font-bold text-text-primary">Cómo se calcula</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto grid h-9 w-9 place-items-center rounded-[9px] border border-[rgba(33,120,168,.12)]"><X size={16} /></button>
        </header>
        <div className="p-6">
          <div className="rounded-[10px] bg-[linear-gradient(120deg,#2178A8,#1B6A93)] p-5 text-white">
            <span className="text-[10px] text-white/60">Saldo Vivo</span>
            <strong className="mt-1 block text-[32px] tracking-[-.04em] tabular-nums">{fmtMoney(equation.saldoVivo, currency, hidden)}</strong>
          </div>
          <div className="mt-6">
            <EquationRow label="Caja reconocida hoy" detail={`${accounts.length} cuenta${accounts.length === 1 ? '' : 's'} incluida${accounts.length === 1 ? '' : 's'}`} amount={equation.saldoVivo} currency={currency} hidden={hidden} />
            <EquationRow label="Obligaciones causadas en tarjetas" detail="Resúmenes pendientes + consumos registrados" amount={-equation.causedCardCommitments} currency={currency} hidden={hidden} />
            <ResultRow label="Disponible Real" amount={equation.disponibleReal} currency={currency} hidden={hidden} />
            <EquationRow label="Apartado a metas" detail="Sigue en tu caja, pero decidiste no usarlo" amount={-equation.goalCommitments} currency={currency} hidden={hidden} />
            <ResultRow label="Disponible Libre" amount={equation.disponibleLibre} currency={currency} hidden={hidden} />
          </div>
          <p className="mt-5 rounded-[8px] bg-bg-secondary p-3 text-[10.5px] leading-relaxed text-text-tertiary">
            Los ingresos futuros no se suman hasta que ocurren. Los vencimientos de tarjeta ya causados no se descuentan nuevamente en el horizonte.
          </p>
          <section className="mt-7">
            <h3 className="text-[11px] font-bold uppercase tracking-[.07em] text-text-tertiary">Composición por cuenta</h3>
            <div className="mt-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between border-b border-[rgba(33,120,168,.09)] py-3 text-[12px]">
                  <span className="text-text-secondary">{account.name}</span>
                  <b className="tabular-nums text-text-primary">{fmtMoney(account.saldo, currency, hidden)}</b>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </FullScreenSheet>
  )
}

function EquationRow({ label, detail, amount, currency, hidden }: { label: string; detail: string; amount: number; currency: 'ARS' | 'USD'; hidden: boolean }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[rgba(33,120,168,.09)] py-3.5"><div><p className="text-[12px] text-text-secondary">{label}</p><p className="mt-0.5 text-[9.5px] text-text-tertiary">{detail}</p></div><b className="shrink-0 text-[12px] tabular-nums text-text-primary">{amount < 0 ? '−' : ''}{fmtMoney(Math.abs(amount), currency, hidden)}</b></div>
}

function ResultRow({ label, amount, currency, hidden }: { label: string; amount: number; currency: 'ARS' | 'USD'; hidden: boolean }) {
  return <div className="flex items-end justify-between gap-4 border-b-2 border-[rgba(13,24,41,.10)] py-4"><span className="text-[11px] font-bold text-text-secondary">{label}</span><b className="text-[24px] tracking-[-.04em] tabular-nums text-primary">{fmtMoney(amount, currency, hidden)}</b></div>
}
