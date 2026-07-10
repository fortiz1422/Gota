'use client'

// THROWAWAY — preview determinístico de Fase D (guía v1.1 §21).
// Renderiza el Home con el HomeIntelligenceModel real de cada fixture.

import { CaretRight, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { HomeActionSlotRow } from '@/components/intelligence/HomeActionSlotRow'
import { HomeAmbientLine } from '@/components/intelligence/HomeAmbientLine'
import { formatAmount } from '@/lib/format'
import type { ExplanationModel } from '@/lib/intelligence/home-model'
import type { HomePreviewResolved } from '@/lib/intelligence/home-preview-fixtures'
import type { Currency } from '@/lib/intelligence/types'

function amount(value: number, currency: Currency, visible: boolean): string {
  return visible ? formatAmount(Math.round(value), currency) : '•••'
}

/** Valor del hero según la base de display (combinado suma con la cotización). */
function heroValue(
  totals: { ARS: number; USD: number },
  context: { heroBalanceMode: string; viewCurrency: Currency; valuationRate: number | null },
): number {
  if (context.heroBalanceMode === 'combined_ars' && context.valuationRate) {
    return totals.ARS + totals.USD * context.valuationRate
  }
  if (context.heroBalanceMode === 'combined_usd' && context.valuationRate) {
    return totals.USD + totals.ARS / context.valuationRate
  }
  return totals[context.viewCurrency]
}

function ExplanationSheet({
  explanation,
  onClose,
}: {
  explanation: ExplanationModel
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="rounded-t-3xl bg-white p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[15px] font-bold text-text-primary">{explanation.title}</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
          {explanation.summary}
        </p>
        <div className="mt-3 space-y-1.5">
          {explanation.evidence.map((item) => (
            <div key={item.id} className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium text-text-tertiary">{item.label}</span>
              <span className="text-[13px] font-bold tabular-nums text-text-primary">
                {item.value}
              </span>
            </div>
          ))}
        </div>
        {explanation.caveats.map((caveat) => (
          <p key={caveat} className="mt-2.5 text-[11.5px] leading-snug text-text-tertiary">
            {caveat}
          </p>
        ))}
        <div className="mt-4 flex items-center gap-3">
          {explanation.action && (
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-white"
            >
              {explanation.action.label}
            </button>
          )}
          {explanation.askQuestion && (
            <button type="button" className="text-[13px] font-semibold text-primary">
              Preguntar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function HomeIntelligencePreview({ state }: { state: HomePreviewResolved }) {
  const [openExplanation, setOpenExplanation] = useState<string | null>(null)
  const { snapshot, context, model } = state
  const currency = context.viewCurrency
  const visible = context.amountsVisible
  const annotationByMovement = new Map(
    (model?.ambient.movementAnnotations ?? []).map((annotation) => [
      annotation.movementId,
      annotation,
    ]),
  )
  const movements = snapshot.movements
    .filter((movement) => movement.date.startsWith(snapshot.month))
    .slice(0, 3)
  const totalAPagar = snapshot.cards.reduce(
    (sum, card) => sum + card.pendingStatements.reduce((s, cycle) => s + cycle.amount, 0),
    0,
  )
  const enCurso = snapshot.cards.reduce((sum, card) => sum + card.currentCycleSpend, 0)
  const explanation = openExplanation ? model?.explanations[openExplanation] : undefined

  return (
    <div
      className="relative mx-auto flex w-[393px] flex-col overflow-hidden bg-white"
      style={{ height: 852, fontFamily: 'var(--font-sans)' }}
    >
      {/* Header + Saldo Vivo (hero intocado) */}
      <div className="blue-zone px-5 pb-6 pt-4 text-white">
        <div className="flex items-center justify-between pt-1">
          <span className="text-[15px] font-extrabold tracking-[0.16em]">GOTA</span>
          <div className="flex items-center gap-2">
            <span className="header-glass rounded-full px-3 py-1 text-[12.5px] font-semibold">
              Julio 2026
            </span>
            <span className="header-glass grid h-8 w-8 place-items-center rounded-full">
              <Plus size={16} weight="bold" />
            </span>
          </div>
        </div>
        <div className="mt-5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/70">
            Saldo Vivo
          </span>
          <p className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] tabular-nums">
            {amount(heroValue(snapshot.saldoVivo, context), currency, visible)}
          </p>
          <p className="text-[12.5px] font-medium text-white/70">
            {visible
              ? `ARS ${formatAmount(snapshot.saldoVivo.ARS, 'ARS').slice(2)} · USD ${snapshot.saldoVivo.USD.toFixed(2)}`
              : 'ARS ••• · USD •••'}
          </p>
          {model?.ambient.saldoVivo && (
            <div className="mt-2 [&_span]:!text-white/80 [&_svg]:!text-white/60">
              <HomeAmbientLine
                modifier={model.ambient.saldoVivo}
                onExplain={setOpenExplanation}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-5">
        {/* Disponible Real: subhéroe permanente */}
        <div className="border-b py-4" style={{ borderColor: 'var(--color-separator)' }}>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-text-secondary">Disponible Real</span>
            <span
              className={`text-[27px] font-extrabold tracking-[-0.02em] tabular-nums ${
                snapshot.disponibleReal[currency] < 0 ? 'text-danger' : 'text-text-primary'
              }`}
            >
              {amount(heroValue(snapshot.disponibleReal, context), currency, visible)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3">
            {model?.ambient.disponibleReal ? (
              <HomeAmbientLine
                modifier={model.ambient.disponibleReal}
                onExplain={setOpenExplanation}
              />
            ) : (
              <span className="text-[13px] font-medium text-text-tertiary">
                Ya descuenta deuda y consumos
              </span>
            )}
          </div>
        </div>

        {/* Action Slot transitorio: solo si el orquestador escaló algo */}
        {model?.actionSlot && (
          <div className="pt-3">
            <HomeActionSlotRow
              action={model.actionSlot}
              onAction={() =>
                model.actionSlot?.explanationId &&
                setOpenExplanation(model.actionSlot.explanationId)
              }
            />
          </div>
        )}

        {/* Compromisos: módulo estructural adaptativo */}
        <div className="border-b py-4" style={{ borderColor: 'var(--color-separator)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-text-primary">Compromisos</span>
            <span className="flex items-center gap-1 text-[15px] font-extrabold tabular-nums text-text-primary">
              {amount(totalAPagar + enCurso, currency, visible)}
              <CaretRight size={12} className="text-text-tertiary" />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            {model?.ambient.commitments ? (
              <HomeAmbientLine
                modifier={model.ambient.commitments}
                onExplain={setOpenExplanation}
              />
            ) : (
              <span className="text-[12.5px] font-medium text-text-tertiary">
                A pagar {amount(totalAPagar, currency, visible)} · En curso{' '}
                {amount(enCurso, currency, visible)}
              </span>
            )}
          </div>
        </div>

        {/* Últimos movimientos: altura estable, anotaciones ambientales */}
        <div className="pt-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
            Últimos movimientos
          </span>
          {movements.map((movement) => {
            const annotation = annotationByMovement.get(movement.id)
            return (
              <div
                key={movement.id}
                className="flex items-center gap-3 border-b py-2.5"
                style={{ borderColor: 'var(--color-separator)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-text-primary">
                    {movement.description}
                  </p>
                  <p className="truncate text-[12px] text-text-secondary">
                    {movement.category} · {movement.date.slice(8)} jul
                  </p>
                  {annotation && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-warning">
                      {annotation.label}
                      {annotation.action && <CaretRight size={10} />}
                    </p>
                  )}
                </div>
                <span className="text-[14px] font-bold tabular-nums text-text-primary">
                  −{amount(movement.amount, movement.currency, visible)}
                </span>
              </div>
            )
          })}
        </div>

        {state.cachedError && (
          <p className="pt-3 text-[11.5px] text-text-tertiary">
            Mostrando el último estado calculado · hace 4 min
          </p>
        )}
      </div>

      {/* Smart Input: entrada única, registra y pregunta */}
      <div className="px-4 pb-7 pt-2">
        <div
          className="flex items-center gap-2.5 rounded-full border bg-white/80 px-4 py-3 text-[14.5px] text-text-tertiary"
          style={{ borderColor: 'var(--color-border-strong)', boxShadow: 'var(--shadow-md)' }}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-white">
            <Plus size={14} weight="bold" />
          </span>
          Registrá o preguntá algo…
        </div>
      </div>

      {explanation && (
        <ExplanationSheet explanation={explanation} onClose={() => setOpenExplanation(null)} />
      )}
    </div>
  )
}
