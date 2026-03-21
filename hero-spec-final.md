# Hero Text Engine · Spec de Implementación
*Gota Analytics — reemplazo de `evaluateInsights`*

---

## Contexto

El sistema actual (`evaluateInsights` + `getMatchingRules`) evalúa 21 condiciones en cascada y produce un titular + hasta 3 chips. El problema: un solo hilo domina días seguidos, no hay conciencia de fase del mes, no hay anti-repetición, y las chips son residuo del ranking — no información curada.

Este spec reemplaza `evaluateInsights` con un engine de selección contextual. El output es compatible con los componentes existentes `TitularHero` e `InsightChips` — no se tocan.

---

## Principios de voz

- Segunda persona, presente
- Sin signos de exclamación
- Sin moralizar ni aconsejar
- Observa, no juzga
- Nombra números reales cuando puede
- Tono: un amigo que habla sin vueltas

---

## Cadencia de actualización

**Base:** se computa una vez por día, al primer open del día. Se persiste en `localStorage` como `heroCache`.

**Re-evalúa únicamente ante:**
1. Día nuevo (fecha distinta a `heroCache.computedAt`)
2. Gasto registrado que supera el 20% del ingreso mensual
3. Cambio de fase del mes (inicio → núcleo → cierre)
4. Día exacto de cierre de una tarjeta

Cualquier otra operación — carga de gasto común, edición, navegación — no dispara recomputo. El usuario ve el mismo hero todo el día salvo evento significativo.

---

## Arquitectura

```
computeSignals(metrics, expenses, cards, subscriptions)
  → HeroEngineInput

evaluateThread(signals)
  → HeroThread (hilo ganador)

resolveAntiRepetition(thread, signals)
  → HeroThread (ajustado si repite)

buildHeroText(thread, signals, variantIndex)
  → string (texto interpolado)

buildPill1(thread, signals)
  → Pill (atada al hilo)

buildPills23(signals, thread)
  → Pill[] (pool independiente, 2 ganadoras)

→ InsightResult { titular, sentiment, chips[] }
```

---

## Fases del mes

```ts
function getMonthPhase(dayOfMonth: number): 'inicio' | 'nucleo' | 'cierre' {
  if (dayOfMonth <= 7)  return 'inicio'
  if (dayOfMonth <= 22) return 'nucleo'
  return 'cierre'
}
```

---

## Tipos

```ts
type HeroThread =
  | 'fresh_start'
  | 'big_expense_echo'
  | 'subscription_incoming'
  | 'category_spike'
  | 'debit_vs_credit_shift'
  | 'deseo_overload'
  | 'closing_alert'
  | 'card_closing_heavy'
  | 'card_concentration'
  | 'saldo_vivo_gap'
  | 'recurring_creep'
  | 'pace_alarm'
  | 'good_rhythm'
  | 'commitment_timeline'
  | 'next_month_burden'
  | 'pace_tense_ending'
  | 'pace_good_ending'
  | 'neutral_mid'

type MonthPhase = 'inicio' | 'nucleo' | 'cierre'

interface HeroEngineInput {
  // Tiempo
  today: Date
  dayOfMonth: number
  daysLeft: number
  monthPhase: MonthPhase
  monthName: string

  // Gasto
  totalSpent: number
  monthlyIncome: number
  spendingPace: number              // totalSpent / (dayOfMonth / daysInMonth)
  projectedBalance: number          // monthlyIncome - (dailyRate * daysInMonth)
  dailyRate: number
  weeklyAvg: number                 // promedio diario últimos 7 días
  bigExpenseToday: boolean
  bigExpenseAmount: number
  bigExpenseCategory: string

  // Categorías
  topCategory: {
    name: string
    amount: number
    share: number
    tag: 'need' | 'want' | 'mixed'
  }
  categorySpike: {
    name: string
    share: number
    txCount: number
  } | null

  // Deseo / Necesidad
  deseoRatio: number
  necesidadRatio: number

  // Medio de pago
  creditRatio: number               // % del total en crédito
  creditRatioThisWeek: number       // % en crédito últimos 7 días

  // Tarjetas
  closingCards: {
    name: string
    daysToClosing: number
    committed: number
    topCategory: string
    isHeavy: boolean                // committed > promedio histórico × 1.30
  }[]

  // Compromisos
  nextMonthBurden: number           // comprometido_próximo / monthlyIncome
  saldoVivoGap: number              // devengado - percibido (lado egresos)
  commitmentTimeline: {
    description: string
    amount: number
    dueDate: Date
  }[]

  // Suscripciones y recurrentes
  pendingSubscriptions: {
    count: number
    estimatedAmount: number
    nextDebitDays: number
    names: string[]
  } | null
  recurringTotal: number            // total suscripciones + recurrentes del mes
  recurringRatio: number            // recurringTotal / monthlyIncome

  // Goteo
  goteoCount: number
  goteoTotal: number
  goteoRatio: number                // goteoTotal / totalSpent

  // Anti-repetición
  lastHeroThread: HeroThread | null
  lastHeroDate: string | null       // YYYY-MM-DD
}

interface Pill {
  label: string
  emphasis?: 'warning' | 'positive' | 'neutral'
}

interface HeroCache {
  thread: HeroThread
  variantIndex: number
  titular: string
  sentiment: 'alert' | 'positive' | 'neutral'
  chips: string[]
  computedAt: string                // YYYY-MM-DD
  monthPhase: MonthPhase
}
```

---

## Rule Engine — evaluación en cascada

Los hilos se evalúan en orden de prioridad. El primero que cumple su condición gana.

```ts
function evaluateThread(s: HeroEngineInput): HeroThread {
  const phase = s.monthPhase

  // ── INICIO ──────────────────────────────────────────────
  if (phase === 'inicio') {
    if (s.bigExpenseToday &&
        s.bigExpenseAmount > s.monthlyIncome * 0.10)
      return 'big_expense_echo'

    if (s.pendingSubscriptions &&
        s.pendingSubscriptions.count >= 2)
      return 'subscription_incoming'

    return 'fresh_start'
  }

  // ── NÚCLEO Y CIERRE ──────────────────────────────────────
  const bigExpenseThreshold = phase === 'nucleo' ? 0.15 : 0.20
  if (s.bigExpenseToday &&
      s.bigExpenseAmount > s.monthlyIncome * bigExpenseThreshold)
    return 'big_expense_echo'

  if (s.closingCards.some(c => c.daysToClosing <= 5 && c.isHeavy))
    return 'card_closing_heavy'

  if (s.closingCards.some(c => c.daysToClosing <= 7))
    return 'closing_alert'

  if (s.saldoVivoGap > s.monthlyIncome * 0.15)
    return 'saldo_vivo_gap'

  const deseoThreshold = phase === 'nucleo' ? 0.55 : 0.45
  const deseoHasMass = s.totalSpent > s.monthlyIncome * 0.30
  if (s.deseoRatio > deseoThreshold && (phase === 'cierre' || deseoHasMass))
    return 'deseo_overload'

  if (phase === 'nucleo' &&
      s.categorySpike &&
      s.categorySpike.share > 0.25 &&
      s.categorySpike.txCount >= 3)
    return 'category_spike'

  if (s.creditRatioThisWeek > s.creditRatio * 1.40 &&
      s.totalSpent > s.monthlyIncome * 0.20)
    return 'debit_vs_credit_shift'

  const creditConcentration = s.closingCards.length > 1 &&
    s.closingCards[0].committed /
    s.closingCards.reduce((acc, c) => acc + c.committed, 0) > 0.65
  if (creditConcentration && s.creditRatio > 0.30)
    return 'card_concentration'

  if (s.pendingSubscriptions && s.pendingSubscriptions.count >= 2)
    return 'subscription_incoming'

  if (s.recurringRatio > 0.20)
    return 'recurring_creep'

  // ── SOLO CIERRE ──────────────────────────────────────────
  if (phase === 'cierre') {
    if (s.commitmentTimeline.length >= 3)
      return 'commitment_timeline'

    if (s.nextMonthBurden > 0.35)
      return 'next_month_burden'

    if (s.projectedBalance < 0)
      return 'pace_tense_ending'

    if (s.projectedBalance >= 0)
      return 'pace_good_ending'
  }

  // ── NÚCLEO ───────────────────────────────────────────────
  const paceThreshold = phase === 'nucleo' ? 1.20 : 1.05
  if (s.spendingPace > paceThreshold)
    return 'pace_alarm'

  if (s.spendingPace < 0.85 && s.deseoRatio < 0.45)
    return 'good_rhythm'

  return 'neutral_mid'
}
```

---

## Anti-repetición

```ts
const FORCED_THREADS: HeroThread[] = ['big_expense_echo', 'card_closing_heavy', 'closing_alert']

function resolveAntiRepetition(
  winner: HeroThread,
  s: HeroEngineInput,
  allCandidates: HeroThread[]
): HeroThread {
  if (winner === s.lastHeroThread && !FORCED_THREADS.includes(winner)) {
    const next = allCandidates.find(t => t !== winner)
    return next ?? 'neutral_mid'
  }
  return winner
}
```

---

## Selección de variante

```ts
// Determinístico por día — mismo resultado en cualquier render del mismo día
function selectVariant(date: Date): 0 | 1 | 2 {
  const seed = parseInt(format(date, 'yyyyMMdd'))
  return (seed % 3) as 0 | 1 | 2
}
```

---

## Templates — 20 hilos × 3 variantes

Cada entrada: `[texto, sentiment]`

```ts
const TEMPLATES: Record<HeroThread, [string, Sentiment][]> = {

  fresh_start: [
    ["Arranca [mes]. Pizarra limpia, todo por delante.", "neutral"],
    ["[Mes] empieza hoy. Lo que pasó el mes pasado ya cerró.", "neutral"],
    ["Primera semana. Todavía no hay nada que analizar — hay todo que construir.", "neutral"],
  ],

  big_expense_echo: [
    ["Ayer entró un gasto grande en [bigExpenseCategory]. El mes sigue, pero el mapa cambió.", "neutral"],
    ["[bigExpenseCategory] se llevó $[bigExpenseAmount] ayer. Un solo movimiento puede reconfigurar la lectura del mes.", "neutral"],
    ["Hubo un movimiento importante ayer — [bigExpenseCategory], $[bigExpenseAmount]. Todo sigue igual, salvo el margen.", "neutral"],
  ],

  subscription_incoming: [
    ["Todavía no debitaron [pendingCount] suscripciones este mes. Ese dinero ya tiene dueño.", "neutral"],
    ["Hay [pendingCount] servicios pendientes de débito — $[pendingAmount] que todavía no impactaron en tu cuenta.", "neutral"],
    ["Antes de que cierre el mes, [pendingCount] suscripciones todavía van a pasar. $[pendingAmount] comprometido.", "neutral"],
  ],

  category_spike: [
    ["[spikeCategory] se llevó el [spikeShare]% del gasto total este mes. Más de lo habitual.", "neutral"],
    ["Mirando el mes, [spikeCategory] se despegó — [spikeTxCount] veces, $[spikeCategoryAmount] en total.", "neutral"],
    ["El mes tiene cara de [spikeCategory]. Esa categoría concentró más peso del que suele tener.", "neutral"],
  ],

  debit_vs_credit_shift: [
    ["Esta semana el [creditRatioWeek]% de los gastos fue con tarjeta — más que el [creditRatioMonth]% del mes. Algo cambió.", "neutral"],
    ["El mix de medios cambió esta semana. El crédito subió más de lo habitual.", "neutral"],
    ["Más tarjeta de lo normal esta semana. [creditRatioWeek]% en crédito, contra [creditRatioMonth]% del promedio del mes.", "neutral"],
  ],

  deseo_overload: [
    ["El [deseoPercent]% de lo que gastaste este mes fue en deseos. No es un juicio — es el dato.", "neutral"],
    ["Más de la mitad del gasto del mes estuvo en la columna Deseo.", "neutral"],
    ["Este mes tuvo más deseos que necesidades. [deseoPercent]% en lo que querías, [necesidadPercent]% en lo que necesitabas.", "neutral"],
  ],

  closing_alert: [
    ["En [daysToClosing] días cierra [cardName]. Lo que acumulaste hasta hoy es lo que vas a pagar.", "neutral"],
    ["[cardName] cierra el [closingDate]. Llevás $[cardCommitted] cargado este mes.", "neutral"],
    ["Faltan [daysToClosing] días para el cierre de [cardName]. $[cardCommitted] acumulados hasta ahora.", "neutral"],
  ],

  card_closing_heavy: [
    ["[cardName] cierra en [daysToClosing] días con $[cardCommitted] — más de lo habitual para esta tarjeta.", "alert"],
    ["Este mes le cargaste más de lo normal a [cardName]. $[cardCommitted] acumulados, cierra en [daysToClosing] días.", "alert"],
    ["De lo que comprometiste en [cardName] este mes, el [cardTopCategoryShare]% fue en [cardTopCategory]. Cierra pronto.", "alert"],
  ],

  card_concentration: [
    ["[cardName] concentra el [cardConcentrationPct]% de todo lo que pusiste en crédito este mes.", "neutral"],
    ["Todo el crédito del mes fue a [cardName]. $[cardCommitted], [cardConcentrationPct]% del gasto en tarjetas.", "neutral"],
    ["Este mes tuvo cara de [cardName]. El [cardConcentrationPct]% del crédito pasó por ahí — y cierra en [daysToClosing] días.", "neutral"],
  ],

  saldo_vivo_gap: [
    ["Lo que gastaste y lo que realmente salió de tu cuenta no es lo mismo. Hay $[saldoVivoGap] comprometidos que todavía no debitaron.", "neutral"],
    ["Tu saldo bancario todavía no refleja todo. $[saldoVivoGap] en compromisos pendientes de débito.", "neutral"],
    ["El saldo que ves no es el saldo real. Quedan $[saldoVivoGap] por debitar de lo que ya comprometiste.", "neutral"],
  ],

  recurring_creep: [
    ["Tus recurrentes suman $[recurringTotal] este mes. El [recurringPercent]% del ingreso se va antes de que decidas nada.", "neutral"],
    ["Hay $[recurringTotal] que debitan solos cada mes — [recurringCount] servicios, todo automático.", "neutral"],
    ["El [recurringPercent]% del ingreso ya tiene destino fijo. Suscripciones, recurrentes — todo sin que lo notes.", "neutral"],
  ],

  pace_alarm: [
    ["El ritmo actual está por encima de lo que entra. Quedan [daysLeft] días para ajustar.", "alert"],
    ["Vas un poco más rápido de lo que el mes permite. El margen se achica.", "alert"],
    ["Al ritmo actual, el mes cierra con $[projectedDeficit] negativo. Todavía hay margen para corregir.", "alert"],
  ],

  good_rhythm: [
    ["El mes viene bien. Ritmo controlado, nada fuera de lugar.", "positive"],
    ["Sin estridencias. Gastos ordenados, margen saludable.", "positive"],
    ["Este mes no tiene drama — y eso, a veces, es todo.", "positive"],
  ],

  commitment_timeline: [
    ["Los próximos días tienen [commitmentCount] vencimientos. El más pesado: [nextCommitmentDesc], $[nextCommitmentAmount] el [nextCommitmentDate].", "neutral"],
    ["Este mes no termina cuando termina el mes. Hay compromisos escalonados hasta el [lastCommitmentDate].", "neutral"],
    ["Lo que viene: [commitment1Desc] el [commitment1Date], [commitment2Desc] el [commitment2Date], y [remainingCommitmentsCount] más.", "neutral"],
  ],

  next_month_burden: [
    ["[nextMonth] arranca con el [nextMonthBurdenPct]% del ingreso ya ocupado. Cuotas, fijos, compromisos.", "neutral"],
    ["Lo que comprometiste este mes lo pagás en [nextMonth]. El [nextMonthBurdenPct]% ya tiene destino antes de que empiece.", "neutral"],
    ["El mes que viene empieza cargado. Queda el [nextMonthFreePct]% del ingreso libre antes de decidir nada.", "neutral"],
  ],

  pace_tense_ending: [
    ["El mes cierra en rojo — $[projectedDeficit] negativo. Ya casi no hay margen para cambiar el resultado.", "alert"],
    ["Quedan [daysLeft] días y el mes no cierra bien. Fue así.", "alert"],
    ["La proyección es $[projectedDeficit] negativo al cierre. No es el mes que arrancaste, pero es información para el próximo.", "alert"],
  ],

  pace_good_ending: [
    ["El mes cierra bien. Quedan [daysLeft] días y la proyección es $[projectedBalance] positivo.", "positive"],
    ["Con [daysLeft] días por delante, el mes va a cerrar en verde.", "positive"],
    ["Este mes estuvo bien manejado. La proyección final: $[projectedBalance] disponible.", "positive"],
  ],

  neutral_mid: [
    ["El mes transcurre. [topCategoryName] concentra el mayor gasto hasta ahora — $[topCategoryAmount].", "neutral"],
    ["[dayOfMonth] días adentro, ritmo estable. Nada que alarme por el momento.", "neutral"],
    ["[monthName] en marcha. Lo más relevante hasta ahora: [topCategoryName], $[topCategoryAmount], [topCategoryTxCount] transacciones.", "neutral"],
  ],
}
```

---

## Sistema de Pills

### Pill 1 — atada al hilo

Cada hilo define su Pill 1. Justifica el hero con el dato principal que lo disparó.

```ts
const PILL1: Record<HeroThread, (s: HeroEngineInput) => Pill> = {
  fresh_start:           s => ({ label: `Ingreso del mes · ${s.monthlyIncome}`, emphasis: 'neutral' }),
  big_expense_echo:      s => ({ label: `${s.bigExpenseCategory} · ${s.bigExpenseAmount} ayer`, emphasis: 'neutral' }),
  subscription_incoming: s => ({ label: `${s.pendingSubscriptions!.count} suscripciones · ${s.pendingSubscriptions!.estimatedAmount}`, emphasis: 'neutral' }),
  category_spike:        s => ({ label: `${s.categorySpike!.name} · ${s.categorySpike!.share}% del total`, emphasis: 'neutral' }),
  debit_vs_credit_shift: s => ({ label: `Crédito esta semana · subió al ${pct(s.creditRatioThisWeek)}%`, emphasis: 'neutral' }),
  deseo_overload:        s => ({ label: `${topDeseoCategory(s)} · ${topDeseoCategoryAmount(s)} en deseos`, emphasis: 'warning' }),
  closing_alert:         s => ({ label: `${closingCard(s).name} · ${closingCard(s).committed} acumulado`, emphasis: 'neutral' }),
  card_closing_heavy:    s => ({ label: `${closingCard(s).name} · cierra en ${closingCard(s).daysToClosing} días`, emphasis: 'warning' }),
  card_concentration:    s => ({ label: `${topCreditCard(s).name} · ${cardConcentrationPct(s)}% del crédito`, emphasis: 'neutral' }),
  saldo_vivo_gap:        s => ({ label: `Pendiente de débito · ${s.saldoVivoGap}`, emphasis: 'neutral' }),
  recurring_creep:       s => ({ label: `Recurrentes · ${s.recurringTotal} por mes`, emphasis: 'neutral' }),
  pace_alarm:            s => ({ label: `Ritmo actual · ${Math.round(s.dailyRate)} por día`, emphasis: 'warning' }),
  good_rhythm:           s => ({ label: `Ritmo actual · ${Math.round(s.dailyRate)} por día`, emphasis: 'positive' }),
  commitment_timeline:   s => ({ label: `${s.commitmentTimeline[0].description} · ${s.commitmentTimeline[0].amount}`, emphasis: 'neutral' }),
  next_month_burden:     s => ({ label: `${nextMonthName(s)} · ${pct(s.nextMonthBurden)}% comprometido`, emphasis: 'neutral' }),
  pace_tense_ending:     s => ({ label: `Cierre proyectado · ${Math.abs(s.projectedBalance)} en rojo`, emphasis: 'warning' }),
  pace_good_ending:      s => ({ label: `Cierre proyectado · ${s.projectedBalance} disponible`, emphasis: 'positive' }),
  neutral_mid:           s => ({ label: `${s.topCategory.name} · ${pct(s.topCategory.share)}% del gasto`, emphasis: 'neutral' }),
}
```

### Pills 2 y 3 — pool independiente

Seis señales candidatas. Compiten por score. Ganan las dos más altas que no repitan el eje del hilo activo.

```ts
type PillSignal =
  | 'small_expenses_drain'
  | 'top_category_growth'
  | 'daily_average_trend'
  | 'commitment_alert'
  | 'deseo_ratio_snapshot'
  | 'next_debit_incoming'

function buildPillCandidates(s: HeroEngineInput): { signal: PillSignal; score: number; pill: Pill }[] {
  const candidates = []

  // Goteo
  if (s.goteoRatio > 0.30)
    candidates.push({
      signal: 'small_expenses_drain',
      score: 60 + (s.goteoRatio - 0.30) * 200,
      pill: { label: `${s.goteoCount} gastos chicos · ${pct(s.goteoRatio)}% del total`, emphasis: s.goteoRatio > 0.40 ? 'warning' : 'neutral' }
    })

  // Promedio semanal vs mensual
  if (s.weeklyAvg > 0 && s.dailyRate > 0) {
    const trendDelta = (s.weeklyAvg / s.dailyRate - 1) * 100
    if (Math.abs(trendDelta) > 15)
      candidates.push({
        signal: 'daily_average_trend',
        score: trendDelta > 0 ? 65 : 40,
        pill: {
          label: `Promedio semanal · ${trendDelta > 0 ? '+' : ''}${Math.round(trendDelta)}% vs el mes`,
          emphasis: trendDelta > 20 ? 'warning' : trendDelta < -15 ? 'positive' : 'neutral'
        }
      })
  }

  // Compromisos vs ingreso
  const commitmentRatio = (s.recurringTotal + nextMonthCommitted(s)) / s.monthlyIncome
  if (commitmentRatio > 0.45)
    candidates.push({
      signal: 'commitment_alert',
      score: commitmentRatio > 0.55 ? 90 : 70,
      pill: { label: `Compromisos fijos · ${pct(commitmentRatio)}% del ingreso`, emphasis: commitmentRatio > 0.50 ? 'warning' : 'neutral' }
    })

  // Snapshot deseo
  if (s.deseoRatio > 0.40)
    candidates.push({
      signal: 'deseo_ratio_snapshot',
      score: 50 + (s.deseoRatio - 0.40) * 150,
      pill: { label: `Deseos este mes · ${pct(s.deseoRatio)}% del total`, emphasis: s.deseoRatio > 0.55 ? 'warning' : 'neutral' }
    })

  // Próximo débito
  if (s.pendingSubscriptions && s.pendingSubscriptions.nextDebitDays <= 3)
    candidates.push({
      signal: 'next_debit_incoming',
      score: 45,
      pill: { label: `${s.pendingSubscriptions.names[0]} · debita en ${s.pendingSubscriptions.nextDebitDays} días`, emphasis: 'neutral' }
    })

  return candidates.sort((a, b) => b.score - a.score)
}

// Regla de no-redundancia: excluir señales que ya cubre Pill 1
const EXCLUDED_BY_THREAD: Partial<Record<HeroThread, PillSignal[]>> = {
  deseo_overload:        ['deseo_ratio_snapshot'],
  subscription_incoming: ['next_debit_incoming'],
  pace_alarm:            ['daily_average_trend'],
  next_month_burden:     ['commitment_alert'],
  recurring_creep:       ['commitment_alert', 'next_debit_incoming'],
}

function buildPills23(s: HeroEngineInput, thread: HeroThread): Pill[] {
  const excluded = EXCLUDED_BY_THREAD[thread] ?? []
  const candidates = buildPillCandidates(s)
    .filter(c => !excluded.includes(c.signal))

  // No dos señales del mismo eje
  const winners: typeof candidates = []
  for (const c of candidates) {
    if (winners.length >= 2) break
    const sameAxis = winners.some(w => sameSignalAxis(w.signal, c.signal))
    if (!sameAxis) winners.push(c)
  }

  return winners.map(w => w.pill)
}
```

---

## Guardias de datos

Algunos hilos solo se activan si los datos son confiables. Si la guardia no se cumple, el hilo se omite y cae al siguiente candidato.

| Hilo | Guardia |
|---|---|
| `category_spike` | `categorySpike.txCount >= 3` |
| `card_closing_heavy` | Requiere historial de ≥ 3 meses en esa tarjeta para computar `isHeavy` |
| `saldo_vivo_gap` | `saldoVivoGap > 0` — si no hay compromisos devengados registrados, el gap es 0 y el hilo no dispara |
| `commitment_timeline` | `commitmentTimeline.length >= 3` con fechas explícitas cargadas |
| `debit_vs_credit_shift` | Requiere ≥ 7 días de datos (`dayOfMonth >= 7`) |
| `deseo_overload` | En núcleo: `totalSpent > monthlyIncome × 0.30` (masa mínima) |

---

## Cache

```ts
// Leer
function readHeroCache(): HeroCache | null {
  try {
    const raw = localStorage.getItem('gota_hero_cache')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// Escribir
function writeHeroCache(cache: HeroCache): void {
  localStorage.setItem('gota_hero_cache', JSON.stringify(cache))
}

// ¿Recomputar?
function shouldRecompute(cache: HeroCache | null, s: HeroEngineInput): boolean {
  if (!cache) return true
  const today = format(s.today, 'yyyy-MM-dd')
  if (cache.computedAt !== today) return true
  if (s.bigExpenseToday && s.bigExpenseAmount > s.monthlyIncome * 0.20) return true
  if (cache.monthPhase !== s.monthPhase) return true
  if (s.closingCards.some(c => c.daysToClosing === 0)) return true
  return false
}
```

---

## Entry point

```ts
export function buildHeroOutput(
  metrics: Metrics,
  expenses: Expense[],
  cards: Card[],
  subscriptions: Subscription[]
): InsightResult {

  const signals = computeSignals(metrics, expenses, cards, subscriptions)
  const cache = readHeroCache()

  if (!shouldRecompute(cache, signals) && cache) {
    return {
      titular: cache.titular,
      sentiment: cache.sentiment,
      chips: cache.chips,
    }
  }

  const thread = evaluateThread(signals)
  const resolved = resolveAntiRepetition(thread, signals, getAllCandidates(signals))
  const variantIndex = selectVariant(signals.today)

  const [templateText, sentiment] = TEMPLATES[resolved][variantIndex]
  const titular = interpolate(templateText, signals)

  const pill1 = PILL1[resolved](signals)
  const pills23 = buildPills23(signals, resolved)
  const chips = [pill1, ...pills23].map(p => p.label)

  const newCache: HeroCache = {
    thread: resolved,
    variantIndex,
    titular,
    sentiment,
    chips,
    computedAt: format(signals.today, 'yyyy-MM-dd'),
    monthPhase: signals.monthPhase,
  }

  writeHeroCache(newCache)

  return { titular, sentiment, chips }
}
```

---

## Superficie de archivos

```
/lib/heroEngine/
  index.ts          ← buildHeroOutput() — entry point
  signals.ts        ← computeSignals() — transforma metrics + raw data en HeroEngineInput
  rules.ts          ← evaluateThread() + resolveAntiRepetition()
  templates.ts      ← TEMPLATES + PILL1 + buildPills23()
  interpolate.ts    ← reemplaza [variables] en strings con valores reales
  cache.ts          ← readHeroCache() + writeHeroCache() + shouldRecompute()
  types.ts          ← todos los tipos e interfaces
```

## Archivos que se modifican

```
/lib/analytics/insights.ts    ← evaluateInsights() reemplazado por buildHeroOutput()
/lib/analytics/metrics.ts     ← agregar: weeklyAvg, bigExpenseToday, creditRatioThisWeek
```

## Archivos que NO se tocan

```
/components/analytics/TitularHero.tsx
/components/analytics/InsightChips.tsx
/app/analytics/page.tsx
```

---

## Stop conditions para Claude Code

1. `TitularHero` e `InsightChips` renderizan sin cambios visuales
2. El hero no es el mismo dos días seguidos en condiciones normales
3. Si `esPrimerosDias` es true → solo `fresh_start`, sin chips
4. Si no hay ingreso → hilos que dependen de ratios vs ingreso no se activan, aparece banner existente
5. Mes histórico → `dayOfMonth = daysInMonth`, `daysLeft = 0`, se evalúa como cierre
