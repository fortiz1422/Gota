'use client'

import Link from 'next/link'
import { CaretRight, CreditCard } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { AmbientModifier } from '@/lib/intelligence/home-model'
import { buildAnalyticsHref } from '@/lib/analytics/analytics-route-state'

interface Props {
  compromisos: CompromisosData
  totalCommitments: number
  pendingStatements: number
  currentSpend: number
  currency: 'ARS' | 'USD'
  selectedMonth: string
  amountsVisible: boolean
  /** Línea ambiental: reemplaza el footer estático, no se apila (guía §11.6). */
  ambient?: AmbientModifier | null
}

const AMBIENT_FOOTER_COLOR: Record<AmbientModifier['status'], string> = {
  neutral: 'text-text-dim',
  positive: 'text-success',
  watch: 'text-warning',
  risk: 'text-danger',
}

function maskAmount(currency: 'ARS' | 'USD') {
  return currency === 'USD' ? 'USD ****' : '$ ******'
}

export function CommitmentsSummary({
  compromisos,
  totalCommitments,
  pendingStatements,
  currentSpend,
  currency,
  selectedMonth,
  amountsVisible,
  ambient,
}: Props) {
  const total = Math.max(totalCommitments, 0)
  const statements = Math.max(pendingStatements, 0)
  const inCourse = Math.max(currentSpend, 0)
  const statementsRatio = total > 0 ? Math.min(statements / total, 1) : 0
  const inCourseRatio = total > 0 ? Math.min(inCourse / total, 1) : 0

  const dueCards = compromisos.tarjetas.filter(
    (tarjeta) => tarjeta.cycleStatus === 'cerrado' || tarjeta.cycleStatus === 'vencido',
  )
  const nextDue = dueCards
    .map((tarjeta) => tarjeta.dueDate)
    .filter((dueDate): dueDate is string => Boolean(dueDate))
    .sort()[0]
  const dueCountLabel = `${dueCards.length} ${dueCards.length === 1 ? 'vencimiento' : 'vencimientos'}`
  const footerText = nextDue
    ? `${dueCountLabel} · próximo ${formatDate(nextDue)}`
    : inCourse > 0
      ? 'Sin resúmenes pendientes'
      : 'Ver detalle de tarjetas, vencimientos y deuda pendiente'

  const href = buildAnalyticsHref({
    month: selectedMonth,
    view: 'insights',
    drill: 'compromisos',
  })

  if (total <= 0) return null

  return (
    <Link
      href={href}
      className="card-s5 block transition-opacity hover:opacity-90 active:opacity-70"
    >
      <div className="p-4">
        <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-warning/20 bg-warning/10">
                  <CreditCard size={22} weight="regular" className="text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="type-body text-text-secondary">Compromisos en tarjetas</p>
                  <p
                    className={`mt-1 break-words leading-tight type-meta ${
                      ambient ? AMBIENT_FOOTER_COLOR[ambient.status] : 'text-text-dim'
                    }`}
                  >
                    {ambient?.label ?? footerText}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="whitespace-nowrap type-body-lg tabular-nums text-text-primary">
                  {amountsVisible ? formatAmount(total, currency) : maskAmount(currency)}
                </span>
                <CaretRight size={13} weight="bold" className="mt-0.5 text-text-dim" />
              </div>
            </div>

            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[color:var(--color-separator)]">
              {statements > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${statementsRatio * 100}%`,
                    background: 'var(--color-warning)',
                  }}
                />
              )}
              {inCourse > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${inCourseRatio * 100}%`,
                    background: 'var(--color-primary)',
                  }}
                />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: 'var(--color-warning)' }}
                />
                <span>A pagar</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {amountsVisible ? formatAmount(statements, currency) : maskAmount(currency)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-text-secondary">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                />
                <span>En curso</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {amountsVisible ? formatAmount(inCourse, currency) : maskAmount(currency)}
                </span>
              </div>
            </div>

        </>
      </div>
    </Link>
  )
}
