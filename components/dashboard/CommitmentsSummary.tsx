'use client'

import Link from 'next/link'
import { CaretRight, CreditCard } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'

interface Props {
  compromisos: CompromisosData
  totalCommitments: number
  pendingStatements: number
  currentSpend: number
  currency: 'ARS' | 'USD'
  selectedMonth: string
  amountsVisible: boolean
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

  const params = new URLSearchParams()
  if (selectedMonth) params.set('month', selectedMonth)
  params.set('drill', 'compromisos')
  const href = `/analytics?${params.toString()}`

  return (
    <Link
      href={href}
      aria-label="Ver compromisos pendientes"
      className="block px-1 py-1 transition-opacity hover:opacity-90"
    >
      <div className="border-t border-[color:var(--color-separator)] pt-4">
        {total <= 0 ? (
          <div className="space-y-1.5">
            <p className="text-[15px] font-semibold text-text-primary">
              Sin compromisos en tarjeta
            </p>
            <p className="type-meta text-text-secondary">
              Tu Disponible Real coincide con tu Saldo Vivo.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <CreditCard size={24} weight="regular" className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="type-body text-text-secondary">Comprometido en tarjetas</p>
                  <p className="mt-1 type-meta text-text-dim">{footerText}</p>
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
                <span>Resúmenes</span>
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
        )}
      </div>
    </Link>
  )
}
