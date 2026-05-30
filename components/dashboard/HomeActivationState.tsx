'use client'

import Link from 'next/link'
import { ClockCounterClockwise, TrendUp } from '@phosphor-icons/react'
import type { HomeEmptyState } from '@/lib/home-empty-state'

type HomeActivationStateProps = {
  state: HomeEmptyState
  onPrimaryAction: () => void
  historyHref?: string
  isAnonymous?: boolean
}

const ACTIVATION_COPY = {
  firstUse: {
    label: 'Activá tu Home',
    intro: 'Con un solo movimiento empezás a ver señales útiles sin tener que configurar nada más.',
    checklist: ['Actividad reciente', 'Disponible real', 'Seguimiento del mes'],
  },
  monthlyEmpty: {
    label: 'Reactivá este mes',
    intro: 'Tu historial anterior sigue intacto. Solo falta un movimiento nuevo para volver a prender este mes.',
    checklist: ['Gasto, ingreso o transferencia', 'Historial anterior disponible', 'Home actualizado al instante'],
  },
} as const

export function HomeActivationState({
  state,
  onPrimaryAction,
  historyHref = '/movimientos',
  isAnonymous = false,
}: HomeActivationStateProps) {
  const { variant, showPrimaryActivation, primaryTitle, primaryBody, primaryActionLabel } = state

  if (!showPrimaryActivation || !primaryTitle || !primaryBody || !primaryActionLabel) return null

  const eyebrow = variant === 'monthly-empty' ? 'Este mes' : 'Primer movimiento'
  const showHistoryLink = variant === 'monthly-empty'
  const copy = variant === 'monthly-empty' ? ACTIVATION_COPY.monthlyEmpty : ACTIVATION_COPY.firstUse

  return (
    <section className="rounded-card border border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,251,253,0.98)_100%)] px-4 py-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-label text-text-secondary">{eyebrow}</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/6 px-3 py-1 text-[12px] font-semibold text-primary">
            {variant === 'monthly-empty' ? (
              <ClockCounterClockwise size={14} weight="duotone" />
            ) : (
              <TrendUp size={14} weight="duotone" />
            )}
            {copy.label}
          </div>
        </div>
        {isAnonymous && variant === 'first-use' ? (
          <span className="rounded-full border border-border-subtle bg-white px-2.5 py-1 text-[11px] font-medium text-text-secondary">
            Modo exploración
          </span>
        ) : null}
      </div>

      <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-text-primary">{primaryTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{primaryBody}</p>
      <p className="mt-3 text-[13px] leading-5 text-text-dim">{copy.intro}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {copy.checklist.map((item) => (
          <span
            key={item}
            className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-[12px] font-medium text-text-secondary"
          >
            {item}
          </span>
        ))}
      </div>

      {variant === 'first-use' && (
        <p className="mt-4 text-[12px] leading-5 text-text-dim">
          Podés arrancar con un gasto, un ingreso o una transferencia: el Smart Input ya te lleva por ese camino.
        </p>
      )}

      {showHistoryLink && (
        <p className="mt-3 text-[12px] leading-5 text-text-dim">
          Si querés revisar meses anteriores, tu historial sigue disponible en Movimientos.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="rounded-button border border-primary/30 bg-white px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/8"
        >
          {primaryActionLabel}
        </button>
        {showHistoryLink && (
          <Link
            href={historyHref}
            className="rounded-button border border-border-subtle bg-transparent px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary"
          >
            Ver historial
          </Link>
        )}
      </div>
    </section>
  )
}