'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { Icon } from '@phosphor-icons/react'
import {
  ArrowClockwise,
  ChartLineUp,
  ChatCircleDots,
  CreditCard,
  Gauge,
  Lightning,
  Sparkle,
  Wallet,
} from '@phosphor-icons/react'
import { requestAssistantOpen } from '@/lib/assistant/events'
import { FF_GOTA_ASSISTANT } from '@/lib/flags'
import type {
  IntelligenceHero as IntelligenceHeroData,
  IntelligenceHeroResponse,
} from '@/lib/intelligence/heroes'
import type { InsightSeverity } from '@/lib/intelligence/types'

/** Datos de héroes inteligentes compartidos entre superficies (cache 5 min). */
export function useIntelligenceHeroes(enabled = true) {
  return useQuery<IntelligenceHeroResponse>({
    queryKey: ['intelligence-heroes'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/heroes')
      if (!res.ok) throw new Error('intelligence heroes fetch failed')
      return res.json()
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

const SEVERITY_CONFIG: Record<
  InsightSeverity,
  { label: string; color: string; soft: string }
> = {
  risk: { label: 'Atención', color: 'var(--color-danger)', soft: 'var(--color-danger-soft)' },
  watch: { label: 'Para mirar', color: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
  positive: { label: 'Buen ritmo', color: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  info: { label: 'Dato', color: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
}

const KIND_ICONS: Record<string, Icon> = {
  upcoming_card_due: CreditCard,
  budget_acceleration: Gauge,
  same_day_spend_delta: ChartLineUp,
  liquidity_watch: Wallet,
  recent_unusual_movement: Lightning,
}

function HeroCta({ hero }: { hero: IntelligenceHeroData }) {
  const cta = hero.cta
  if (!cta) return null

  const className =
    'mt-3 inline-flex items-center gap-1.5 rounded-button border border-primary/20 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/5'

  if (cta.href) {
    return (
      <Link href={cta.href} className={className}>
        {cta.label}
      </Link>
    )
  }

  if (cta.question && FF_GOTA_ASSISTANT) {
    return (
      <button
        type="button"
        onClick={() => requestAssistantOpen({ question: cta.question })}
        className={className}
      >
        <ChatCircleDots size={14} weight="duotone" />
        {cta.label}
      </button>
    )
  }

  return null
}

function PrimaryHeroCard({ hero }: { hero: IntelligenceHeroData }) {
  const tone = SEVERITY_CONFIG[hero.severity]
  const KindIcon = KIND_ICONS[hero.kind] ?? Sparkle

  return (
    <article className="card-s5 p-4">
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ background: tone.soft, color: tone.color }}
        >
          <KindIcon size={17} weight="duotone" />
        </span>
        <span
          className="rounded-pill px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em]"
          style={{ background: tone.soft, color: tone.color }}
        >
          {tone.label}
        </span>
      </div>

      <h3 className="mt-3 text-[17px] font-extrabold leading-snug tracking-[-0.01em] text-text-primary">
        {hero.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{hero.message}</p>

      {hero.evidence.length > 0 && (
        <dl className="mt-3 space-y-1.5 border-t border-[rgba(13,24,41,0.06)] pt-3">
          {hero.evidence.map((item) => (
            <div key={`${item.label}-${item.value}`} className="flex items-baseline justify-between gap-3">
              <dt className="type-meta text-text-dim">{item.label}</dt>
              <dd className="text-[13px] font-bold tabular-nums text-text-primary">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <HeroCta hero={hero} />
    </article>
  )
}

export function IntelligenceSignalChip({ hero }: { hero: IntelligenceHeroData }) {
  const tone = SEVERITY_CONFIG[hero.severity]
  const cta = hero.cta

  const content = (
    <>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone.color }} />
      <span className="truncate">{hero.title}</span>
    </>
  )
  const className =
    'flex max-w-[260px] shrink-0 items-center gap-2 rounded-pill border border-[rgba(13,24,41,0.08)] bg-white px-3 py-2 text-[12px] font-semibold text-text-secondary shadow-sm'

  if (cta?.href) {
    return (
      <Link href={cta.href} className={className}>
        {content}
      </Link>
    )
  }

  if (cta?.question && FF_GOTA_ASSISTANT) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => requestAssistantOpen({ question: cta.question })}
      >
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

function EmptyCard() {
  return (
    <article className="card-s5 flex items-center gap-3 p-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]">
        <Sparkle size={17} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-text-primary">Nada urgente por ahora</p>
        <p className="type-meta text-text-secondary">
          No veo señales de riesgo en tu mes hasta hoy.
        </p>
      </div>
      {FF_GOTA_ASSISTANT && (
        <button
          type="button"
          aria-label="Preguntale a Gota"
          onClick={() => requestAssistantOpen()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--color-primary-soft)] text-primary"
        >
          <ChatCircleDots size={18} weight="duotone" />
        </button>
      )}
    </article>
  )
}

/** Fila de chips de señales: se degrada en silencio (loading/error/empty → nada). */
export function IntelligenceSignalChips({ heroes }: { heroes: IntelligenceHeroData[] }) {
  if (heroes.length === 0) return null
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-5 pt-4">
      {heroes.map((hero) => (
        <IntelligenceSignalChip key={hero.id} hero={hero} />
      ))}
    </div>
  )
}

/**
 * Card completa con hero primario + chips. No se usa en Análisis (ahí la señal
 * se integra al hero azul); queda como superficie standalone para Home mobile.
 */
export function IntelligenceHero() {
  const { data, isLoading, isError, refetch } = useIntelligenceHeroes()

  if (isLoading) {
    return (
      <section className="px-5 pt-4">
        <div className="skeleton h-36 rounded-card" />
      </section>
    )
  }

  if (isError || !data) {
    return (
      <section className="px-5 pt-4">
        <button
          type="button"
          onClick={() => void refetch()}
          className="flex w-full items-center justify-center gap-2 rounded-card border border-[rgba(13,24,41,0.06)] bg-bg-secondary px-4 py-3 type-meta text-text-dim"
        >
          <ArrowClockwise size={14} weight="bold" />
          No pude cargar la lectura del mes. Tocá para reintentar.
        </button>
      </section>
    )
  }

  const [primary, ...secondary] = data.heroes

  return (
    <section className="px-5 pt-4">
      {primary ? (
        <>
          <PrimaryHeroCard hero={primary} />
          {secondary.length > 0 && (
            <div className="scrollbar-none -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
              {secondary.map((hero) => (
                <IntelligenceSignalChip key={hero.id} hero={hero} />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyCard />
      )}
    </section>
  )
}
