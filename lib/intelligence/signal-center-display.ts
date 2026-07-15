import type {
  SignalCoverageState,
  SignalDomain,
  SignalOccurrence,
} from './signal-center'
import type { DataQuality, InsightSeverity } from './types'

export type SignalDisplayMeta = {
  label: string
  description: string
}

export type SignalCenterTab = 'now' | 'coverage'

const MONEY_PATTERN =
  /(?:US\$|U\$|ARS|USD|\$)\s*-?\d[\d.,]*(?:\s?(?:k|K|M))?|-?\d[\d.,]*\s*(?:ARS|USD)\b/gu

const COVERAGE_FAMILIES: Record<SignalDomain, SignalDisplayMeta> = {
  liquidity: {
    label: 'Liquidez',
    description: 'Revisa si tu plata disponible alcanza para los próximos compromisos.',
  },
  cards: {
    label: 'Tarjetas',
    description: 'Sigue cierres, vencimientos y saldos pendientes de tus tarjetas.',
  },
  budget: {
    label: 'Presupuestos',
    description: 'Compara el gasto registrado con los límites que definiste.',
  },
  pace: {
    label: 'Ritmo de gasto',
    description: 'Compara cómo venís gastando con períodos anteriores equivalentes.',
  },
  unusual: {
    label: 'Movimientos inusuales',
    description: 'Detecta gastos que se apartan de tu actividad habitual.',
  },
  installments: {
    label: 'Cuotas',
    description: 'Observa cuánto de tus tarjetas ya está comprometido en cuotas.',
  },
  wants: {
    label: 'Gastos de deseo',
    description: 'Sigue cambios relevantes en tus gastos no esenciales.',
  },
  goals: {
    label: 'Metas',
    description: 'Revisa el avance de las metas que decidiste seguir.',
  },
  income: {
    label: 'Ingresos esperados',
    description: 'Detecta ingresos habituales que todavía no fueron registrados.',
  },
  subscriptions: {
    label: 'Suscripciones',
    description: 'Observa débitos recurrentes y cambios en sus importes.',
  },
}

const COVERAGE_STATES: Record<SignalCoverageState, SignalDisplayMeta> = {
  active: {
    label: 'Activa',
    description: 'Gota tiene datos suficientes para revisar esta señal.',
  },
  learning: {
    label: 'Aprendiendo',
    description: 'Gota necesita más historial para detectar cambios con confianza.',
  },
  needs_setup: {
    label: 'Necesita configuración',
    description: 'Falta configurar o registrar información para activar esta señal.',
  },
  not_applicable: {
    label: 'No aplica',
    description: 'No hay una configuración de este tipo para revisar por ahora.',
  },
}

export const SEVERITY_DISPLAY: Record<InsightSeverity, { label: string; toneClass: string }> = {
  risk: { label: 'Riesgo', toneClass: 'text-danger bg-danger-soft' },
  watch: { label: 'Atención', toneClass: 'text-warning bg-warning-soft' },
  info: { label: 'Información', toneClass: 'text-data bg-data-soft' },
  positive: { label: 'En orden', toneClass: 'text-success bg-success-soft' },
}

export const DATA_QUALITY_COPY: Record<DataQuality, string> = {
  ok: 'Datos al día',
  partial: 'Lectura parcial: Gota todavía está completando el contexto.',
  insufficient: 'Todavía no hay datos suficientes para una conclusión.',
}

export function maskSignalText(text: string, amountsVisible: boolean): string {
  return amountsVisible ? text : text.replace(MONEY_PATTERN, '•••')
}

export function maskSignalOccurrence(
  signal: SignalOccurrence,
  amountsVisible: boolean,
): SignalOccurrence {
  if (amountsVisible) return signal

  return {
    ...signal,
    title: maskSignalText(signal.title, false),
    summary: maskSignalText(signal.summary, false),
    message: maskSignalText(signal.message, false),
    evidence: signal.evidence.map((item) => ({
      ...item,
      label: maskSignalText(item.label, false),
      value: maskSignalText(item.value, false),
    })),
    caveats: signal.caveats.map((caveat) => maskSignalText(caveat, false)),
    action: signal.action
      ? {
          ...signal.action,
          label: maskSignalText(signal.action.label, false),
          ...(signal.action.type === 'ask'
            ? { question: maskSignalText(signal.action.question, false) }
            : {}),
        }
      : null,
    askQuestion: signal.askQuestion
      ? maskSignalText(signal.askQuestion, false)
      : null,
  }
}

export function coverageFamilyDisplay(family: SignalDomain): SignalDisplayMeta {
  return COVERAGE_FAMILIES[family]
}

export function coverageStateDisplay(state: SignalCoverageState): SignalDisplayMeta {
  return COVERAGE_STATES[state]
}

export function nextSignalTab(
  active: SignalCenterTab,
  key: string,
): SignalCenterTab | null {
  if (key === 'Home') return 'now'
  if (key === 'End') return 'coverage'
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return active === 'now' ? 'coverage' : 'now'
  }
  return null
}

export function formatSignalDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00-03:00`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}
