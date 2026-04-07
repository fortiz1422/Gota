# qwen-context.md — Gota (GotaLabs)
> Contexto de arranque para Qwen Agent. Leer completo antes de tocar cualquier archivo.

---

## Qué es esto

Gota es una PWA de finanzas personales para Argentina. Solo founder. El objetivo central es responder una pregunta: **¿cuánta plata tenés realmente disponible hoy?** El número clave se llama `Saldo Vivo`.

---

## Stack — no usar alternativas sin aprobación

- **Next.js 15** App Router (no Pages Router). Middleware en `proxy.ts`, no `middleware.ts`.
- **React 19**, **TypeScript strict**
- **Tailwind v4** — config vía `@theme {}` en `app/globals.css`. No existe `tailwind.config.js`.
- **Supabase** — PostgreSQL 15, Google OAuth + Anonymous Auth, RLS activo en TODAS las tablas
- **TanStack React Query** — query keys: `['dashboard', month, currency]`, `['analytics', month]`
- **Zod** para validación en todas las API routes
- **Gemini** `gemini-2.5-flash-lite` via `@google/generative-ai` — SOLO en `/api/parse-expense`
- **Phosphor Icons** (`@phosphor-icons/react`) — weight `"regular"` o `"duotone"`. Lucide fue eliminado, no usarlo.
- **DM Sans** como fuente principal (`--font-dm-sans`)
- Deploy en **Vercel**

---

## Design System — Light "Fría" (único tema vigente)

Deep Ocean (dark) está DEPRECADO. No usar como referencia.

```
bgPrimary:    #F0F4F8
bgSecondary:  #E6ECF2
textPrimary:  #0D1829
textSecond:   #4A6070
textDim:      #90A4B0
accent:       #2178A8   ← azul, NO cyan
data:         #1B7E9E
green:        #1A7A42
orange:       #B84A12
danger:       #A61E1E

Glass: rgba(255,255,255,0.38) + backdrop-blur(16px) + border rgba(255,255,255,0.70)
glass-1: pills y rows base
glass-2: cards y panels
glass-3: nav flotante y sheets

Radii: redondeados grandes
Motion: mínimo y funcional (reduced-motion implementado)
```

---

## Estructura de rutas

```
app/
├── (auth)/login/               ← LoginButton.tsx ('use client')
├── auth/callback/route.ts      ← OAuth exchange
├── (dashboard)/
│   ├── layout.tsx              ← Auth guard + ReactQueryProvider + TabBar + AnonymousBanner
│   ├── page.tsx                ← Dashboard → DashboardShell
│   ├── analytics/page.tsx
│   ├── movimientos/page.tsx    ← Principal (nueva)
│   ├── expenses/page.tsx       ← Legacy, sin tab, accesible
│   └── settings/page.tsx      ← Legacy, sin tab, accesible
├── onboarding/
└── api/                        ← BFF — toda mutación pasa por acá
    ├── dashboard/route.ts      ← RPC + orquestación principal
    ├── parse-expense/route.ts  ← Gemini NLP
    ├── movimientos/route.ts
    ├── analytics-data/route.ts
    ├── expenses/route.ts
    ├── income-entries/route.ts
    ├── accounts/route.ts
    ├── cards/route.ts
    ├── transfers/route.ts
    ├── subscriptions/route.ts
    └── export/route.ts
```

**TabBar activo:** Home (`/`) · Movimientos (`/movimientos`) · Análisis (`/analytics`)
Config y Settings se acceden desde el avatar del Home (CuentaSheet).

---

## Conceptos de dominio — CRÍTICOS, no asumir

| Concepto | Definición |
|---|---|
| **Saldo Vivo** | `saldo_inicial + ingresos - gastos_percibidos - pago_tarjetas`. NO es saldo bancario. |
| **Gasto Percibido** | `payment_method` IN ('CASH','DEBIT','TRANSFER') y category ≠ 'Pago de Tarjetas' |
| **Gasto en Tarjeta** | `payment_method = 'CREDIT'` — compromiso, no sale de caja aún |
| **Pago de Tarjeta** | `category = 'Pago de Tarjetas'` — SÍ sale de caja, distinto de compra con crédito |
| **Transferencia** | Movimiento entre cuentas propias. No es ingreso ni gasto de consumo. |
| **Rollover** | Arrastre de saldo mes a mes. Modos: `auto`, `off`. `manual` existe en DB pero no expuesto en UI. |
| **Devengado** | Consumo comprometido en tarjeta, aún no debitado |
| **Percibido** | Ingreso efectivamente recibido en caja |

**Regla de oro:** Una compra con tarjeta ≠ pago de tarjeta. Confundirlos rompe Saldo Vivo.

---

## Modelo de datos — tablas principales

- `expenses` — gastos y pagos de tarjeta. Campos clave: `payment_method`, `category`, `card_id`, `account_id`, `installment_group_id`
- `income_entries` — sistema nuevo de ingresos (preferido)
- `monthly_income` — sistema legacy, fallback cuando no hay `income_entries`
- `accounts` — tipos: `bank`, `cash`, `digital`. Una es `is_primary`.
- `account_period_balance` — saldo base por cuenta por período (`YYYY-MM-01`)
- `cards` — `closing_day`, `due_day`, `account_id` vinculada
- `subscriptions` + `subscription_insertions` — deduplicación por mes
- `transfers` — `from_account_id`, `to_account_id`, soporte cross-currency
- `user_config` — `default_currency`, `rollover_mode`, `onboarding_completed`
- `yield_accumulator`, `instruments` — detrás de FF_YIELD / FF_INSTRUMENTS

**Source of truth del tipo:** `types/database.ts`

**Prioridad de ingresos en todo el código:** `income_entries` > `monthly_income` (fallback)

---

## Patrones de código — seguir siempre

### API routes
```ts
// Toda route comienza con:
const supabase = createServerClient(...)
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// Luego: parse body → validar con Zod → lógica → return JSON
```

### Componentes
- Server Component en `page.tsx` → delega a un solo Client Component
- Estado local con `useState` (no Zustand, no Redux)
- React Query para dashboard y analytics. Fetch directo (`useState+useEffect`) en movimientos.
- Bottom sheets para create/edit. `Modal` vía `createPortal`.
- Invalidación tras mutación: `queryClient.invalidateQueries({ queryKey: ['dashboard', ...] })`

### Naming
- PascalCase para componentes, camelCase para utils en `lib/`
- Mezcla intencional ES/EN: inglés para estructura técnica, español para dominio financiero
- Handlers: `handle*` | Booleans: `is*`, `has*` | Estado: `selected*`, `active*`

---

## Lógica de negocio clave — archivos a leer antes de tocar

| Qué | Archivo |
|---|---|
| Orquestación del dashboard | `app/api/dashboard/route.ts` |
| Saldo Vivo y rollover | `lib/rollover.ts` |
| Parseo NLP de gastos | `app/api/parse-expense/route.ts` + `lib/gemini/` |
| Movimientos unificados | `app/api/movimientos/route.ts` |
| Métricas de analytics | `lib/analytics/computeMetrics.ts` |
| Hero textual (rule-based) | `lib/heroEngine/` — NO usa LLM en runtime |
| Categorías (source of truth) | `lib/validation/schemas.ts` → `CATEGORIES` (24 categorías) |
| Formato de moneda/fecha | `lib/format.ts` → `formatAmount`, `formatCompact`, `todayAR()` |
| Rendimiento diario | `lib/yieldEngine.ts` (detrás de FF_YIELD) |

---

## Reglas del agente — no negociables

1. **NUNCA modificar RLS policies de Supabase** sin flag explícito en el issue
2. **NUNCA deployar** — solo abrir PR
3. **NUNCA asumir lógica de negocio financiera** — si hay duda, comentar en el PR
4. Correr `tsc --noEmit` antes de commitear. Si hay errores de tipo → fixear primero
5. Un PR por tarea. Descripción en español.
6. Leer el archivo completo antes de editarlo
7. No usar Lucide (reemplazado por Phosphor). No usar `tailwind.config.js`. No usar Deep Ocean tokens.
8. La función `addMonths()` y `getCurrentMonth()` están duplicadas en varios archivos — si las necesitás, extraer a `lib/` en lugar de duplicar de nuevo
9. Tokens de color en tres lugares: `lib/colors.ts`, `lib/design-tokens.ts`, `app/globals.css` — actualizar los tres si cambiás paleta

---

## Deudas técnicas conocidas — no introducir más

- Rate limiter in-memory en `lib/rate-limit.ts` — se pierde en cold starts
- `check_daily_expense_limit` — función SQL definida, no llamada en código
- `lib/analytics/insights.ts` — código muerto (reemplazado por heroEngine)
- `lib/categories.ts` — stub vacío, mapping real está en `CategoryIcon.tsx`
- Sin tests automatizados (candidatos: `computeMetrics`, `buildPrevMonthSummary`, heroEngine rules)
- Sin error boundaries en dashboard
- Fade abisal duplicado en `layout.tsx` y `DashboardShell.tsx`

---

## Contexto de producto

- App argentina → fechas en `America/Buenos_Aires`, moneda en ARS/USD
- Lenguaje Rioplatense, copy en español
- El mes (`YYYY-MM`) es la unidad principal de análisis
- La cuenta `is_primary` es el fallback cuando un movimiento no trae `account_id`
- Feature flags activos: `FF_YIELD`, `FF_INSTRUMENTS` — no tocar sin indicación explícita
- `proxy.ts` es el middleware de auth (no `middleware.ts`) — Next.js naming no estándar
