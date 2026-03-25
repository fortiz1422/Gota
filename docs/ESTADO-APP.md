# ESTADO-APP.md — Auditoría completa de Gota
**Fecha:** 2026-03-24 | **Autor:** Claude Code (auditoría de código real)

---

## 1. Stack y arquitectura

### Framework y lenguaje
- **Next.js 15** (App Router, no Pages Router)
- **React 19**
- **TypeScript** strict
- **Tailwind v4** — configuración vía CSS `@theme {}` en `app/globals.css`, sin `tailwind.config.js`

### Backend y datos
- **Supabase** (PostgreSQL 15, Auth, RLS)
- Google OAuth exclusivo (sin email/password)
- RPC de Supabase: `get_dashboard_data` (función SQL del lado del servidor)

### AI
- **Gemini** `gemini-2.5-flash-lite` via `@google/generative-ai`
- API version: `v1` (explícito en `lib/gemini/client.ts`)
- Solo para SmartInput — no se usa en ningún otro lugar

### Estado del cliente
- **@tanstack/react-query** para fetching, caché y invalidación
- Sin Zustand — estado local con `useState` en cada componente
- Hero Engine usa **localStorage** como caché persistente

### Deploy e infraestructura
- Vercel
- PWA: `manifest.json` + service worker (`sw.js`) — registrado por `ServiceWorkerRegistrar.tsx`
- `themeColor` en viewport: `#F0F4F8` (Modo Fría, light)

### Autenticación / Middleware
- **`proxy.ts`** (no `middleware.ts`) — Next.js 16 nombra el middleware de manera no estándar
- Protege todas las rutas excepto `/login`, `/auth/`, y assets estáticos
- Auth callback en `/auth/callback/route.ts`

### Fuentes
- **DM Sans** (primary: 400, 500, 600, 700, 800) — `--font-dm-sans`
- **Geist** (fallback) — `--font-geist-sans`

### Íconos
- **@phosphor-icons/react** — usado en toda la app (weight: `"regular"` o `"duotone"`)
- **Lucide React** — NO se usa (era el sistema anterior, eliminado)

---

## 2. Pantallas y rutas

### Estructura del App Router

```
app/
├── (auth)/
│   └── login/
│       ├── page.tsx            ← Login Google OAuth
│       └── LoginButton.tsx     ← 'use client'
├── (dashboard)/
│   ├── layout.tsx              ← Auth guard + ReactQueryProvider + TabBar
│   ├── loading.tsx             ← Skeleton global del grupo
│   ├── page.tsx                ← "/" — Dashboard principal
│   ├── analytics/
│   │   ├── page.tsx            ← "/analytics"
│   │   └── loading.tsx
│   ├── expenses/
│   │   ├── page.tsx            ← "/expenses" (llamada "Movimientos" en UI)
│   │   └── loading.tsx
│   └── settings/
│       ├── page.tsx            ← "/settings"
│       └── loading.tsx
├── onboarding/
│   ├── page.tsx                ← "/onboarding" — flujo de primera vez
│   ├── OnboardingFlow.tsx
│   └── components/
│       ├── StepBienvenida.tsx
│       ├── StepAhamoment.tsx
│       └── StepConfiguracion.tsx
├── api/                        ← Ver sección 7
├── auth/
│   └── callback/route.ts       ← Exchange de código OAuth
└── layout.tsx                  ← Root layout (fuentes, SW, metadata)
```

### Detalle de cada pantalla

#### `/` — Dashboard
- **Rendering:** Server Component (`page.tsx`) → Client (`DashboardShell`)
- **Params:** `?month=YYYY-MM` (default: mes actual), `?currency=ARS|USD`
- **Datos:** Un fetch a `/api/dashboard` desde React Query
- **Componentes montados:** DashboardHeader, CurrencyToggle, HomePlusButton, SaldoVivo, SaldoVivoSheet, FiltroEstoico, SubscriptionReviewBanner, Ultimos5, SmartInput (fixed bottom), CierreMesModal (condicional), RolloverBanner (condicional), IncomeSetupModal (condicional)
- **Prefetch:** Prefetchea `/api/analytics-data` en background al montar

#### `/analytics` — Analytics
- **Rendering:** Server Component → Client (`AnalyticsDataLoader` → `AnalyticsClient`)
- **Params:** `?month=YYYY-MM`
- **Datos:** Un fetch a `/api/analytics-data` desde React Query
- **Tabs internos:** "Diario" (TitularHero + InsightChips + CategoriaRows) y "Análisis" (FugaSilenciosa, MapaHabitos, Compromisos)
- **Prefetch:** Prefetchea `/api/dashboard` en background al montar

#### `/expenses` — Movimientos
- **Rendering:** Completamente Server Component (carga todo en el servidor)
- **Params:** `?month=YYYY-MM`, `?category=`, `?payment_method=`, `?page=`
- **Datos:** 5 queries paralelas (config, income_entries, transfers, accounts, expenses con count)
- **Paginación:** 20 por página, clásica (links, no infinite scroll)
- **Lista:** income_entries al tope de página 1, luego transfers + expenses mezclados por fecha DESC

#### `/settings` — Configuración
- **Rendering:** Server Component (carga config + accounts), componentes cliente para acciones
- **Secciones:** Moneda, Tarjetas, Ingresos mensuales (legacy), Rollover, Cuentas bancarias/digitales, Cuenta de usuario

#### `/onboarding` — Primera vez
- **Rendering:** Server Component verifica `onboarding_completed`; si true → redirect `/`
- **Pasos:** Bienvenida → Aha moment → Configuración

---

## 3. Features implementadas

### Feature: SmartInput (NLP → Gemini → ParsePreview)
**Estado: Completo**

- Input de texto libre ("café 2500 con tarjeta")
- `POST /api/parse-expense` → Gemini con `temperature: 0.1`
- Prompt en `lib/gemini/prompts.ts` — incluye hoy en AR (timezone Buenos Aires), 24 categorías, reglas de moneda/pago
- Respuesta validada con `ParsedExpenseSchema` (Zod)
- ParsePreview modal para confirmar/editar antes de guardar
- Rate limit: 10 requests/minuto por usuario (in-memory)
- Soporta gastos en cuotas desde ParsePreview (`installments`, `installment_start`, `installment_grand_total`)
- **Archivos clave:** `components/dashboard/SmartInput.tsx`, `components/dashboard/ParsePreview.tsx`, `app/api/parse-expense/route.ts`, `lib/gemini/`

### Feature: Saldo Vivo
**Estado: Completo — multicuenta**

- Fórmula: `saldo_inicial + ingresos - gastos_percibidos - pago_tarjetas + transferAdjustment`
- `saldo_inicial` viene de `account_period_balance` (rollover) o `monthly_income.saldo_inicial_ars/usd`
- `ingresos` viene de `income_entries` (new) o `monthly_income.amount_ars/usd` (legacy)
- Datos traídos vía RPC `get_dashboard_data(p_user_id, p_month, p_currency)`
- Muestra Twin Pills: "Percibidos" (gasto directo + pago tarjetas) y "Tarjeta" (crédito diferido)
- Tap en número → abre `SaldoVivoSheet` con breakdown por cuenta
- Cross-currency transfers ajustan el saldo según moneda vista
- **Archivos clave:** `components/dashboard/SaldoVivo.tsx`, `components/dashboard/SaldoVivoSheet.tsx`, `app/api/dashboard/route.ts`, `app/api/dashboard/account-breakdown/route.ts`

### Feature: Rollover (traspaso de saldo entre meses)
**Estado: Completo — 3 modos**

- **auto:** Al abrir el dashboard del mes actual sin ingresos, calcula saldo del mes anterior y lo escribe automáticamente en `account_period_balance` con `source: 'rollover_auto'`
- **manual:** Muestra `CierreMesModal` con resumen del mes anterior; usuario confirma y elige a qué cuenta asignar el saldo
- **off:** Sin rollover
- Configurable en Settings
- **Archivos clave:** `lib/rollover.ts`, `components/dashboard/CierreMesModal.tsx`, `components/dashboard/RolloverBanner.tsx`

### Feature: Multicuenta
**Estado: Completo**

- Tabla `accounts` con tipos: `bank`, `cash`, `digital`
- Una cuenta marcada `is_primary`
- `account_id` en expenses, income_entries, subscriptions (nullable — fallback a primary)
- Transfers entre cuentas (mismo o distinto currency)
- Per-account balance tracking en `account_period_balance`
- **Archivos clave:** `app/api/accounts/`, `app/api/transfers/`, `components/settings/AccountsSection.tsx`, `components/dashboard/TransferForm.tsx`

### Feature: Ingresos
**Estado: Completo — doble sistema (legacy + nuevo)**

- **Nuevo (preferido):** `income_entries` — entradas individuales con `account_id`, `category` (salary/freelance/other), `date`
- **Legacy:** `monthly_income` — monto mensual fijo ARS/USD; aún presente en DB y usado como fallback
- `HomePlusButton` → IncomeModal para agregar entradas
- **Archivos clave:** `app/api/income-entries/`, `app/api/monthly-income/`, `components/dashboard/IncomeModal.tsx`

### Feature: Suscripciones (auto-insert)
**Estado: Completo**

- Tabla `subscriptions` con `day_of_month` — define qué día se cobra mensualmente
- Al cargar `/api/dashboard` en el mes actual, `processSubscriptions()` inserta automáticamente las suscripciones que ya llegaron a su día (fire-and-forget, sin bloquear la respuesta)
- `subscription_insertions` evita duplicados via `upsert` con `ignoreDuplicates: true`
- `SubscriptionReviewBanner` en home alerta si hay suscripciones pendientes de revisión
- CRUD en Settings
- **Archivos clave:** `app/api/subscriptions/`, `app/api/dashboard/route.ts` (processSubscriptions), `components/subscriptions/`

### Feature: Cuotas en curso
**Estado: Parcial**

- UI: `CuotasEnCursoSheet` accesible desde `HomePlusButton`
- DB: `expenses.installment_group_id`, `installment_number`, `installment_total`
- Schema Zod: soporta `installments`, `installment_start`, `installment_grand_total`
- **No documentado en el PRD** (marcado como "Out of scope"), pero está implementado en la UI
- Estado real de implementación de la lógica de inserción en múltiples cuotas: no auditado en detalle en este pase

### Feature: Analytics — Diario
**Estado: Completo**

- **TitularHero:** Frase generada por el Hero Engine (rule-based, NO AI)
- **InsightChips:** 1-3 chips secundarios
- **CategoriaRow:** Lista de categorías del mes ordenada por total DESC, expandible a partir de 5
- Sin gráficos
- **Archivos clave:** `lib/heroEngine/`, `components/analytics/TitularHero.tsx`, `components/analytics/InsightChips.tsx`, `components/analytics/CategoriaRow.tsx`

### Feature: Analytics — Análisis (tab secundario)
**Estado: Completo**

Tres tarjetas bento con drill-down:
1. **Fuga Silenciosa** — gastos por debajo del P25 del mes; requiere ≥4 transacciones
2. **Mapa de Hábitos** — distribución de gastos por día del mes (visual de barras)
3. **Compromisos** — crédito por tarjeta, separado por ciclo de cierre

- **Archivos clave:** `components/analytics/AnalysisView.tsx`, `components/analytics/FugaSilenciosa.tsx`, `components/analytics/MapaHabitos.tsx`, `components/analytics/Compromisos.tsx`, `lib/analytics/computeCompromisos.ts`

### Feature: Hero Engine
**Estado: Completo — sistema sofisticado**

Sistema completamente rule-based en `lib/heroEngine/`:
- **signals.ts:** Computa ~20 señales desde Metrics + contexto (tarjetas, suscripciones, compromisos)
- **rules.ts:** `collectAllCandidates()` retorna threads priorizados por fase del mes (inicio/nucleo/cierre). Threads: `fresh_start`, `big_expense_echo`, `card_closing_heavy`, `closing_alert`, `deseo_overload`, `category_spike`, `debit_vs_credit_shift`, `subscription_incoming`, `recurring_creep`, `pace_tense_ending`, `pace_good_ending`, `pace_alarm`, `good_rhythm`, `neutral_mid`
- **templates.ts:** 3 variantes por thread, seleccionadas determinísticamente por día del año (no aleatorio)
- **cache.ts:** Resultado cacheado en localStorage; se recomputa si cambió el día, hay un gasto grande hoy, cambió la fase del mes, o cierra una tarjeta
- **Anti-repetición:** Si el thread ganador es igual al del día anterior, usa el siguiente candidato

### Feature: Exportación CSV
**Estado: Completo**

- `GET /api/export` — genera CSV UTF-8 con BOM
- Link directo desde la pantalla de Analytics (sin JS)

### Feature: Onboarding
**Estado: Completo**

- 3 pasos, flujo lineal
- Guarda `user_config.onboarding_completed = true` al finalizar
- Si ya completó → redirect a `/`

---

## 4. Componentes principales

### `DashboardShell` — `components/dashboard/DashboardShell.tsx`
**Client Component** — orquesta todo el dashboard
- Props: `selectedMonth: string`, `viewCurrency: 'ARS' | 'USD'`
- Fetch único a `/api/dashboard` con React Query (`['dashboard', month, currency]`)
- Calcula `transferCurrencyAdjustment` (para cross-currency transfers)
- Renderiza: header grid, modales condicionales, SaldoVivo, FiltroEstoico, SubscriptionReviewBanner, Ultimos5
- SmartInput flotante fixed-bottom en z-index 50
- Fade abisal en z-index 46

### `SmartInput` — `components/dashboard/SmartInput.tsx`
- Props: `cards: Card[]`, `accounts: Account[]`, `onAfterSave?: () => void`
- Estado: `input`, `isParsing`, `parsed`
- Diseño: pill glass frosted, botón circular `#2178A8` cuando hay input
- Enter o click → `POST /api/parse-expense` → abre `ParsePreview`

### `SaldoVivo` — `components/dashboard/SaldoVivo.tsx`
- Props: `data`, `currency`, `gastosTarjeta`, `transferAdjustment`, `onBreakdownOpen`
- Muestra número hero + Twin Pills
- Glow bioluminiscente: verde positivo, rojo negativo
- Tap en número → callback `onBreakdownOpen` (abre SaldoVivoSheet)

### `AnalyticsDataLoader` — `components/analytics/AnalyticsDataLoader.tsx`
- Fetch a `/api/analytics-data`
- Llama a `computeMetrics()` y `computeCompromisos()` en el cliente
- Pasa resultado a `AnalyticsClient`

### `AnalyticsClient` — `components/analytics/AnalyticsClient.tsx`
- Gestiona tabs (diario/análisis), drill states, estado `expanded`
- Llama a `buildHeroOutput()` en `useEffect` (porque accede a localStorage)
- Dos tabs: Diario y Análisis

### `TabBar` — `components/navigation/TabBar.tsx`
- 3 tabs: Home, Análisis, Config
- Propaga `?month=` si está presente en los params
- Diseño: pill glass frosted centrado, tab activo en `#0D1829` con texto

### `CategoryIcon` — `components/ui/CategoryIcon.tsx`
- Props: `category: string`, `size?: number`, `container?: boolean`
- Mapea 24 categorías a Phosphor icons + colores de Modo Fría
- `container=true` → div 36×36 con fondo suave y radio 10px
- También exporta `getCategoryColors(category)` para contenedores personalizados

### `Modal` — `components/ui/Modal.tsx`
- `createPortal` al `document.body`
- Bottom sheet en mobile, centrado en desktop

### `HomePlusButton` — `components/dashboard/HomePlusButton.tsx`
- Botón `+` en header → action sheet con 4 opciones: Ingreso, Suscripción, Cuotas en curso, Transferencia
- Gestiona `sheet: null | 'action' | 'income' | 'subscription' | 'cuotas' | 'transfer'`

---

## 5. Schema de Supabase

Relevado desde `types/database.ts` (el source of truth del cliente):

### `expenses`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| amount | decimal | ≥1 |
| currency | varchar | 'ARS' \| 'USD' |
| category | varchar | 24 categorías válidas |
| description | text | max 100 chars |
| is_want | boolean \| null | null para Pago de Tarjetas |
| payment_method | varchar | 'CASH' \| 'DEBIT' \| 'TRANSFER' \| 'CREDIT' |
| card_id | varchar \| null | requerido si CREDIT o Pago de Tarjetas |
| account_id | varchar \| null | cuenta origen (nullable → primary) |
| date | string | ISO date YYYY-MM-DD |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| installment_group_id | string \| null | agrupa cuotas |
| installment_number | number \| null | nro de cuota |
| installment_total | number \| null | total de cuotas |

### `monthly_income` (legacy)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK |
| month | string | YYYY-MM-01 |
| amount_ars | decimal | |
| amount_usd | decimal | |
| saldo_inicial_ars | decimal | |
| saldo_inicial_usd | decimal | |
| closed | boolean | |
| closed_at | timestamptz \| null | |

### `income_entries` (nuevo)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK |
| account_id | string \| null | cuenta destino |
| amount | decimal | |
| currency | 'ARS' \| 'USD' | |
| description | string | |
| category | 'salary' \| 'freelance' \| 'other' | |
| date | string | |

### `user_config`
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | PK |
| default_currency | 'ARS' \| 'USD' | |
| cards | jsonb | `[{id, name, archived?, closing_day?}]` |
| onboarding_completed | boolean | |
| rollover_mode | 'auto' \| 'manual' \| 'off' | |

### `accounts`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK |
| name | string | |
| type | 'bank' \| 'cash' \| 'digital' | |
| is_primary | boolean | |
| archived | boolean | |
| opening_balance_ars | decimal | |
| opening_balance_usd | decimal | |

### `account_period_balance`
| Campo | Tipo | Notas |
|---|---|---|
| account_id | string | PK compuesto |
| period | string | PK — YYYY-MM-01 |
| balance_ars | decimal | |
| balance_usd | decimal | |
| source | 'opening' \| 'rollover_auto' \| 'manual' | |

### `transfers`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| from_account_id | string | |
| to_account_id | string | |
| amount_from | decimal | |
| amount_to | decimal | |
| currency_from | 'ARS' \| 'USD' | |
| currency_to | 'ARS' \| 'USD' | |
| exchange_rate | decimal \| null | para cross-currency |
| date | string | |
| note | string \| null | |

### `subscriptions`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| description | string | |
| category | string | |
| amount | decimal | |
| currency | 'ARS' \| 'USD' | |
| payment_method | 'DEBIT' \| 'CREDIT' | |
| card_id | string \| null | |
| account_id | string \| null | |
| day_of_month | integer | 1–31 |
| is_active | boolean | |
| last_reviewed_at | string | |

### `subscription_insertions`
| Campo | Tipo | Notas |
|---|---|---|
| subscription_id | string | FK subscriptions |
| month | string | YYYY-MM-01 |
| expense_id | string \| null | FK expenses |

### Funciones SQL (RPC)
- `get_dashboard_data(p_user_id, p_month, p_currency)` → JSON con `saldo_vivo`, `gastos_tarjeta`, `filtro_estoico`, `top_3`, `ultimos_5`
- `check_daily_expense_limit(p_user_id)` → boolean (50 gastos/día) — definida en DB, NO usada en el código actual
- `detect_duplicate_expenses(p_user_id, p_amount, p_category, p_date)` → array de duplicados potenciales

### Vista SQL
- `user_active_cards` — no usada en el código actual (deuda)

---

## 6. Hooks, stores y utilidades

### No hay Zustand ni stores globales
Todo el estado es local (`useState`) o servidor React Query.

### React Query
- Configurado en `components/providers/ReactQueryProvider.tsx`
- `staleTime` por defecto del queryClient: ver `lib/query-client.ts`
- Query keys usados:
  - `['dashboard', selectedMonth, viewCurrency]`
  - `['analytics', selectedMonth]`
  - `['account-breakdown', selectedMonth, currency]`
- Invalidación: `queryClient.invalidateQueries({ queryKey: ['dashboard', ...] })` tras guardar un gasto

### `lib/format.ts`
```ts
formatAmount(amount, currency)   // "$ 1.234.567" o "USD 1.234,56"
formatCompact(amount, currency)  // "$ 1.2M", "$ 450k"
formatDate(isoString)            // "3 mar."
todayAR()                        // YYYY-MM-DD en timezone AR
dateInputToISO(dateStr)          // YYYY-MM-DD → ISO con mediodía AR
```

### `lib/rollover.ts`
Exporta 4 funciones puras:
- `calcularSaldoFinal()` — cálculo simple con monthly_income
- `buildPrevMonthSummary()` — cálculo completo con prioridad income_entries > monthly_income
- `buildPerAccountBalances()` — saldo total al primary (rollover manual)
- `buildSmartPerAccountBalances()` — saldo per-account considerando transfers (rollover auto)

### `lib/analytics/computeMetrics.ts`
Función pura que recibe `expenses[]`, `ingresoMes`, `currency`, `selectedMonth` y retorna el objeto `Metrics` con ~30 campos calculados en memoria. Incluye Hero Engine signals (`weeklyAvg`, `creditRatioThisWeek`, `bigExpenseToday`).

### `lib/heroEngine/`
Sistema modular:
- `signals.ts` → `computeSignals()` — agrega contexto externo (tarjetas con closing_day, suscripciones pendientes)
- `rules.ts` → `collectAllCandidates()`, `resolveAntiRepetition()`, `selectVariant()`
- `templates.ts` → `TEMPLATES`, `PILL1`, `buildPills23()`
- `interpolate.ts` → reemplaza tokens `{field}` con valores de señales
- `cache.ts` → lee/escribe `gota_hero_cache` en localStorage
- `index.ts` → `buildHeroOutput()` — función principal exportada

### `lib/validation/schemas.ts`
- `CATEGORIES` — array de 24 categorías (source of truth para validación)
- `ExpenseSchema` — Zod con refinement (card_id requerido para CREDIT)
- `ParsedExpenseSchema` — discriminated union is_valid/!is_valid

### `lib/rate-limit.ts`
In-memory `Map<userId, timestamp[]>` — 10 requests/60s para `/api/parse-expense`. **Se pierde en cold starts de Vercel** (serverless).

### `lib/supabase/`
- `client.ts` → Supabase browser client (singleton)
- `server.ts` → Supabase server client (con cookies SSR)
- `admin.ts` → Admin client con service role key (para `/api/account` delete)

---

## 7. Integraciones externas

### Gemini Flash
- Modelo: `gemini-2.5-flash-lite`, API v1
- Uso: solo `/api/parse-expense`
- Config: `temperature: 0.1` para outputs determinísticos
- Strip de markdown si Gemini envuelve JSON en backticks
- Validación post-parse con Zod

### Supabase
- Auth: Google OAuth, sesión persistente por cookies (SSR compatible)
- DB: RLS activado en todas las tablas
- Queries: directas via `@supabase/ssr` en server components y `@supabase/supabase-js` en cliente

---

## 8. TODOs y deuda técnica

No se encontraron comentarios `TODO`, `FIXME`, o `HACK` en el código fuente.

Sin embargo, del análisis del código surgen las siguientes deudas implícitas:

### Deudas funcionales
1. **Rate limiter no persistente** (`lib/rate-limit.ts`): el Map en memoria se pierde en cada cold start de Vercel. En producción, un usuario podría bypassear el límite reiniciando o esperando un nuevo deployment.

2. **`check_daily_expense_limit`** (función SQL): está definida en el schema y en `types/database.ts`, pero **no se llama en ningún lugar del código**. El límite de 50 gastos/día no está activo.

3. **`user_active_cards` (vista SQL)**: definida en `types/database.ts`, no usada en ninguna query del código.

4. **`lib/categories.ts`**: stub vacío con un comentario que dice que el mapping se movió a `CategoryIcon.tsx`. El archivo debería eliminarse o redirigir mejor.

5. **Cuotas en curso**: `CuotasEnCursoSheet` existe en la UI y la DB tiene los campos (`installment_group_id`, etc.), pero no hay una ruta `/api/` dedicada para cuotas. La lógica de inserción de múltiples gastos desde la sheet no fue auditada en detalle.

6. **`lib/analytics/insights.ts`**: Contiene un sistema de reglas completo (`evaluateInsights`) que fue **reemplazado por el Hero Engine**. Está en el filesystem pero no es importado por ningún componente actual. Es código muerto.

### Deudas de calidad
7. **Sin error boundaries**: Si el RPC de Supabase falla, el dashboard falla silenciosamente. Mencionado en el PRD como deuda pero no implementado.

8. **Sin tests**: Cero cobertura. Las funciones puras (`computeMetrics`, `buildPrevMonthSummary`, reglas del Hero Engine) serían candidatos ideales.

---

## 9. Inconsistencias detectadas

### 9.1 Design System — documentación vs código real
`docs/gota-design-system.md` documenta el tema **Deep Ocean (dark)** con `--primary: #38bdf8` (cyan) y fondos `#060a0e`. El tema real en producción es **Modo Fría (light)** con `--primary: #2178A8` (azul) y fondos `#F0F4F8`. La doc está desactualizada por 1-2 versiones de rediseño.

### 9.2 PRD vs código — Out of scope
El PRD v3.0 marca "Cuotas/installments" como Out of Scope, pero el código tiene:
- `installment_group_id`, `installment_number`, `installment_total` en la tabla `expenses`
- `CuotasEnCursoSheet` accesible desde `HomePlusButton`
- Campos `installments`, `installment_start`, `installment_grand_total` en `ExpenseSchema`

### 9.3 Doble sistema de ingresos
Dos mecanismos coexisten:
- **`monthly_income`** (legacy): monto mensual único ARS/USD
- **`income_entries`** (nuevo): entradas individuales con categoría y cuenta

El código los prioriza correctamente (`income_entries` > `monthly_income`), pero la lógica de prioridad está duplicada en 3 lugares: `app/api/dashboard/route.ts`, `app/api/analytics-data/route.ts`, y `lib/rollover.ts`.

### 9.4 Tres archivos de tokens de color
`lib/colors.ts`, `lib/design-tokens.ts` y `app/globals.css` (@theme) contienen los mismos valores de color. Los comentarios dicen "update BOTH files" (los TS files dicen esto), pero son tres. Un cambio de palette requiere actualizar tres archivos.

### 9.5 Fade abisal duplicado
`app/(dashboard)/layout.tsx` monta un fade abisal (height: 80, z-index: 45). `DashboardShell.tsx` monta otro (height: 180, z-index: 46). En la pantalla `/` se renderizan ambos superpuestos. En `/analytics` y `/expenses` solo el del layout.

### 9.6 `addMonths()` duplicada
La función helper `addMonths(ym, delta)` está duplicada en:
- `app/api/dashboard/route.ts` (línea 20)
- `app/api/analytics-data/route.ts` (línea 11)
- `app/api/dashboard/account-breakdown/route.ts` (línea 4)

Debería estar en `lib/`.

### 9.7 `getCurrentMonth()` duplicada
La función `getCurrentMonth()` aparece en 6 archivos distintos (todas las páginas + APIs). No está extraída en un módulo compartido.

### 9.8 TabBar — lógica de active state
```ts
isActive: pathname === '/' || pathname.startsWith('/expenses')
```
La pestaña "Home" se activa también en `/expenses`. Probablemente intencional (expenses es una subpágina de home), pero resulta confuso porque la TabBar también tiene "Home" apuntando a `/`. Si el usuario está en `/expenses` y toca "Home", va a `/` no a `/expenses` — correcto. Si está en `/expenses` y está leyendo la tab, parece que "Home" está activo — puede confundir.

### 9.9 `ANALYTICS_WORKPLAN.md` — desactualizado
El workplan en `docs/ANALYTICS_WORKPLAN.md` describe la pantalla de Analytics a construir, con PLACEHOLDERs sin completar. La pantalla ya está implementada con una arquitectura diferente a la planificada (dos tabs "Diario" / "Análisis", Hero Engine en lugar de `evaluateInsights`, Phosphor `@phosphor-icons/react` en lugar de `phosphor-react`).

### 9.10 `gota-design-system.md` — categorías incompletas
El PRD lista 21 categorías. El código real tiene 24: se agregaron `Entretenimiento`, `Mascotas`, e `Hijos` que no están documentadas en ningún doc de referencia.

### 9.11 Transfers en la cache de React Query
Cuando el usuario crea una transferencia, el código invalida la query del dashboard. Sin embargo, la query de `account-breakdown` tiene `staleTime: 0` y se recarga al abrir el sheet. No hay invalidación explícita del breakdown tras un transfer — si el usuario tiene el sheet abierto antes de hacer una transferencia, los datos quedan stale hasta cerrar y reabrir.

---

## Resumen de estado general

| Área | Estado |
|---|---|
| Auth + onboarding | ✅ Completo |
| SmartInput + ParsePreview | ✅ Completo |
| Saldo Vivo (multicuenta) | ✅ Completo |
| Rollover (3 modos) | ✅ Completo |
| Ingresos | ✅ Completo (doble sistema coexistente) |
| Suscripciones (auto-insert) | ✅ Completo |
| Analytics — Diario | ✅ Completo |
| Analytics — Análisis | ✅ Completo |
| Hero Engine | ✅ Completo |
| Movimientos / expenses | ✅ Completo |
| Settings | ✅ Completo |
| Transfers entre cuentas | ✅ Completo |
| Exportación CSV | ✅ Completo |
| Cuotas en curso | ⚠️ Parcial (UI + DB, falta auditar inserción múltiple) |
| Tests | ❌ Sin cobertura |
| Error boundaries | ❌ No implementado |
| Rate limiting persistente | ❌ In-memory, no sobrevive cold starts |
| Límite 50 gastos/día | ❌ Función SQL definida, no llamada |
