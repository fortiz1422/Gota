import type {
  SignalCenterModel,
  SignalOccurrence,
} from '@/lib/intelligence/signal-center'
import type { HorizonEvent } from '@/components/dashboard/desktop/desktop-dashboard-model'

export type MoneyEquation = {
  saldoVivo: number
  disponibleReal: number
  causedCardCommitments: number
  goalCommitments: number
  disponibleLibre: number
  reconciles: boolean
}

export function buildMoneyEquation(params: {
  saldoVivo: number
  disponibleReal: number
  disponibleLibre: number
}): MoneyEquation {
  const { saldoVivo, disponibleReal, disponibleLibre } = params
  const causedCardCommitments = saldoVivo - disponibleReal
  const goalCommitments = disponibleReal - disponibleLibre
  const tolerance = 0.01
  const reconciles =
    causedCardCommitments >= -tolerance &&
    goalCommitments >= -tolerance &&
    Math.abs(
      saldoVivo - (disponibleLibre + goalCommitments + causedCardCommitments),
    ) <= tolerance

  return {
    saldoVivo,
    disponibleReal,
    causedCardCommitments,
    goalCommitments,
    disponibleLibre,
    reconciles,
  }
}

export type WebBriefStatus =
  | 'learning'
  | 'calm'
  | 'watch'
  | 'risk'
  | 'historical'

export type WebBrief = {
  status: WebBriefStatus
  title: string
  summary: string
  primarySignal: SignalOccurrence | null
  secondaryCount: number
}

function actionableSignals(model: SignalCenterModel | null): SignalOccurrence[] {
  if (!model) return []
  return model.signals.filter(
    ({ severity }) => severity === 'risk' || severity === 'watch',
  )
}

export function buildWebBrief(params: {
  model: SignalCenterModel | null
  historical: boolean
}): WebBrief {
  const { model, historical } = params
  if (historical) {
    return {
      status: 'historical',
      title: 'Estás viendo un cierre histórico.',
      summary: 'La caja y las señales de hoy no se mezclan con este período.',
      primarySignal: null,
      secondaryCount: 0,
    }
  }

  const actionable = actionableSignals(model)
  const primary = actionable[0] ?? null
  if (primary) {
    return {
      status: primary.severity === 'risk' ? 'risk' : 'watch',
      title: primary.title,
      summary: primary.summary,
      primarySignal: primary,
      secondaryCount: Math.max(0, actionable.length - 1),
    }
  }

  if (!model || model.dataQuality !== 'ok') {
    return {
      status: 'learning',
      title: 'Gota está completando esta lectura.',
      summary:
        'La caja visible es real, pero todavía falta cobertura para afirmar un patrón o una calma completa.',
      primarySignal: null,
      secondaryCount: 0,
    }
  }

  return {
    status: 'calm',
    title: 'No detectamos una decisión inmediata.',
    summary:
      'Tu Panel queda en silencio y va a escalar solo si aparece algo accionable.',
    primarySignal: null,
    secondaryCount: 0,
  }
}

export type HorizonScope = 'included' | 'future' | 'estimated'

function dateAtNoon(value: string): number {
  return new Date(`${value}T12:00:00-03:00`).getTime()
}

export function isWithinRollingHorizon(
  date: string,
  referenceDate: string,
  days = 30,
): boolean {
  const difference = Math.round(
    (dateAtNoon(date) - dateAtNoon(referenceDate)) / 86_400_000,
  )
  return difference >= 0 && difference <= days
}

export type HorizonDescription = {
  scope: HorizonScope
  label: string
}

export function describeHorizonEvent(
  event: Pick<HorizonEvent, 'kind' | 'estimated'>,
): HorizonDescription {
  if (event.kind === 'due') {
    return {
      scope: 'included',
      label: 'Ya descontado de Disponible Real',
    }
  }
  if (event.kind === 'income') {
    return {
      scope: 'estimated',
      label: 'Estimado · todavía no mejora la caja de hoy',
    }
  }
  if (event.kind === 'instrument') {
    return {
      scope: 'future',
      label: 'El capital vuelve a estar líquido al vencer',
    }
  }
  return {
    scope: event.estimated ? 'estimated' : 'future',
    label: event.estimated
      ? 'Estimado · todavía no impacta la caja'
      : 'Evento futuro · sin salida de caja inmediata',
  }
}
