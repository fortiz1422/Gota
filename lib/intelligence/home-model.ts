import type { HomeMoneyBasis } from './home-display-context'
import type { DataQuality, EvidenceItem } from './types'

/**
 * Contratos del Home inteligente (guía base v1.1, §9).
 *
 * La inteligencia ambiental edita módulos existentes (Saldo Vivo, Disponible
 * Real, Compromisos, filas de movimiento) y escala a lo sumo UNA acción
 * transitoria. No existe hero editorial persistente.
 */

export type InsightDomain =
  | 'liquidity'
  | 'commitments'
  | 'movement'
  | 'subscription'
  | 'income'
  | 'closing'
  | 'category'
  | 'payment_mix'
  | 'currency'
  | 'quality'

/** Acciones nativas tipadas (§9.6). Ninguna escribe sin confirmación. */
export type IntelligenceAction =
  | { type: 'navigate'; href: string; label: string }
  | { type: 'ask'; question: string; label: string }
  | { type: 'prefill_income'; recurringIncomeId: string; label: string }
  | { type: 'review_pending_receipt'; receiptId: string; label: string }
  | { type: 'review_subscription'; subscriptionId: string; label: string }
  | { type: 'review_card'; cardId: string; cycleId?: string; label: string }
  | { type: 'review_movement'; movementId: string; label: string }
  | { type: 'simulate_purchase'; amount?: number; installments?: number; label: string }
  | { type: 'snooze'; dedupeKey: string; until: string; label: string }

export type AmbientStatus = 'neutral' | 'positive' | 'watch' | 'risk'

/**
 * Modificador ambiental: reemplaza el copy secundario del módulo propietario.
 * Una sola línea (label); el resto vive en la explicación bajo demanda.
 */
export type AmbientModifier = {
  status: AmbientStatus
  label: string
  detail: string | null
  explanationId: string | null
  sourceInsightIds: string[]
}

export type MovementAnnotationKind =
  | 'unusual_amount'
  | 'possible_duplicate'
  | 'subscription'
  | 'pending_confirmation'

/** Anotación ambiental de una fila de movimiento. Máximo una por fila. */
export type MovementAnnotation = {
  movementId: string
  kind: MovementAnnotationKind
  label: string
  explanationId: string | null
  action: IntelligenceAction | null
}

export type HomeActionKind =
  | 'card_shortfall'
  | 'income_missing'
  | 'subscription_increase'
  | 'pace_unsustainable'
  | 'movement_review'
  | 'pending_receipt'

/**
 * Acción transitoria del Home: una fila (52–64px), cero o una por vez.
 * No se renderiza en calma y no repite la historia del módulo propietario.
 */
export type HomeAction = {
  id: string
  kind: HomeActionKind
  status: 'watch' | 'risk'
  title: string
  subtitle: string
  action: IntelligenceAction
  explanationId: string | null
  dedupeKey: string
  validUntil: string
}

/** Explicación bajo demanda (nivel 4): evidencia, caveats y acciones. */
export type ExplanationModel = {
  id: string
  title: string
  summary: string
  evidence: EvidenceItem[]
  caveats: string[]
  askQuestion: string | null
  action: IntelligenceAction | null
}

export type HomeIntelligenceModel = {
  generatedAt: string
  validUntil: string
  dataQuality: DataQuality
  moneyBasis: HomeMoneyBasis
  ambient: {
    saldoVivo: AmbientModifier | null
    disponibleReal: AmbientModifier | null
    commitments: AmbientModifier | null
    movementAnnotations: MovementAnnotation[]
  }
  actionSlot: HomeAction | null
  explanations: Record<string, ExplanationModel>
}
