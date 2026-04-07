# ESTADO-APP.md — Auditoría completa de Gota
**Fecha:** 2026-03-24 | **Última actualización:** 2026-04-05 | **Autor:** Claude Code (auditoría de código real)

---

## 1. Stack y arquitectura

### Framework y lenguaje
- **Next.js 15** (App Router, no Pages Router)
- **React 19**
- **TypeScript** strict
- **Tailwind v4** — configuración vía CSS `@theme {}` en `app/globals.css`, sin `tailwind.config.js`

### Backend y datos
- **Supabase** (PostgreSQL 15, Auth, RLS)
- Google OAuth + **Supabase Anonymous Auth** ("Explorar sin cuenta")
  - Anonymous sign-ins: ON (Supabase Dashboard)
  - Manual linking: ON — permite convertir anon → cuenta Google via `linkIdentity()`
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
│       ├── page.tsx            ← Login — Server Component
│       └── LoginButton.tsx     ← 'use client' — Google OAuth + "Explorar sin cuenta"
├── (dashboard)/
│   ├── layout.tsx              ← Auth guard + ReactQueryProvider + TabBar + AnonymousBanner
│   ├── loading.tsx             ← Skeleton global del grupo
│   ├── page.tsx                ← "/" — Dashboard principal
│   ├── analytics/
│   │   ├── page.tsx            ← "/analytics"
│   │   └── loading.tsx
│   ├── expenses/
│   │   ├── page.tsx            ← "/expenses" (ruta legacy — sigue existiendo)
│   │   └── loading.tsx
│   ├── movimientos/
│   │   └── page.tsx            ← "/movimientos" — nueva tab de lista completa [2026-04-03]
│   └── settings/
│       ├── page.tsx            ← "/settings" (ruta legacy — ya no aparece en TabBar)
│       └── loading.tsx
├── onboarding/
│   ├── page.tsx                ← "/onboarding" — flujo de primera vez
│   ├── OnboardingFlow.tsx
│   └── components/
│       ├── StepBienvenida.tsx
│       ├── StepAhamoment.tsx
│       └── StepConfiguracion.tsx
├── api/                        ← Ver sección 7
│   └── movimientos/route.ts    ← GET lista de movimientos con stats [2026-04-03]
├── auth/
│   └── callback/route.ts       ← Exchange de código OAuth
└── layout.tsx                  ← Root layout (fuentes, SW, metadata)
```

### Detalle de cada pantalla

#### `/` — Dashboard
- **Rendering:** Server Component (`page.tsx`) → Client (`DashboardShell`)
- **Params:** `?month=YYYY-MM` (default: mes actual), `?currency=ARS|USD`
- **Datos:** Un fetch a `/api/dashboard` desde React Query
- **Componentes montados:** HomePlusButton, SaldoVivo, SaldoVivoSheet, FiltroEstoico, SubscriptionReviewBanner, Ultimos5, SmartInput (fixed bottom), CierreMesModal (condicional), RolloverBanner (condicional), CuentaSheet (condicional)
- **Header:** Avatar circular con inicial del email (abre CuentaSheet) + HomePlusButton — ya **no** incluye DashboardHeader ni CurrencyToggle [2026-04-03]
- **Prefetch:** Prefetchea `/api/analytics-data` en background al montar

#### `/analytics` — Analytics
- **Rendering:** Server Component → Client (`AnalyticsDataLoader` → `AnalyticsClient`)
- **Params:** `?month=YYYY-MM`
- **Datos:** Un fetch a `/api/analytics-data` desde React Query
- **Tabs internos:** "Diario" (TitularHero + InsightChips + CategoriaRows) y "Análisis" (FugaSilenciosa, MapaHabitos, Compromisos)
- **Prefetch:** Prefetchea `/api/dashboard` en background al montar

#### `/expenses` — Movimientos (legacy)
- **Rendering:** Completamente Server Component (carga todo en el servidor)
- **Params:** `?month=YYYY-MM`, `?category=`, `?payment_method=`, `?page=`
- **Datos:** 5 queries paralelas (config, income_entries, transfers, accounts, expenses con count)
- **Paginación:** 20 por página, clásica (links, no infinite scroll)
- **Lista:** income_entries al tope de página 1, luego transfers + expenses mezclados por fecha DESC
- **Nota:** La ruta sigue existiendo pero ya no aparece en la TabBar. El tab activo de Movimientos redirige a `/movimientos`. [2026-04-03]

#### `/movimientos` — Movimientos (nueva) [2026-04-03, actualizado 2026-04-05]
- **Rendering:** Server Component (`page.tsx`) → Client (`MovimientosClient`)
- **Params:** `?month=YYYY-MM` (solo para el initial state; la navegación es local)
- **Datos:** Fetch a `/api/movimientos?month=&tipos=&origenes=&cuentas=&categorias=&monedas=&page=` con `useState+useEffect`
- **Componentes:** StripOperativo (3 métricas, tappable), FiltroSheet (bottom sheet con 5 secciones), MovimientosGroupedList (agrupado por día, "Cargar más")
- **Filtros [2026-04-05]:** Sistema avanzado 5 dimensiones — Tipo (gasto/ingreso/transferencia/suscripcion), Origen (percibido/tarjeta/pago_tarjeta), Cuenta (multiselect), Categoría (multiselect), Moneda (ARS/USD). Acceso vía ícono embudo (Funnel) en el header con badge numérico.
- **Strip interactivo [2026-04-05]:** Tocar pill "Percibidos" → activa filtro `origenes: ['percibido','pago_tarjeta']`. Tocar "Tarjeta" o "Pago tarjeta" → filtros individuales. Re-tapping toggling.
- **Fila de filtro activo [2026-04-05]:** Cuando hay filtros activos: chip `glass-1` con resumen del filtro + × para limpiar (izquierda); total filtrado en moneda seleccionada (derecha); skeleton durante carga.
- **Period selector:** `← Mes →` inline en el header, maneja estado local sin URL

#### `/settings` — Configuración (legacy)
- **Rendering:** Server Component (carga config + accounts), componentes cliente para acciones
- **Secciones:** Moneda, Tarjetas, Ingresos mensuales (legacy), Rollover, Cuentas bancarias/digitales, Cuenta de usuario
- **Nota:** La ruta sigue existiendo pero ya no aparece en la TabBar. La configuración se accede desde el avatar en el Home (CuentaSheet). [2026-04-03]

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
- ~~Twin Pills~~ eliminadas [2026-04-03] — Percibidos y Tarjeta ahora se ven en el StripOperativo de `/movimientos`
- Toggle ARS/USD inline junto al label (reemplaza CurrencyToggle separado del header) [2026-04-03]
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

### Feature: Anonymous Auth ("Explorar sin cuenta")
**Estado: Completo**

- Botón secundario en login → `supabase.auth.signInAnonymously()` → redirect a `/`
- Usuario anónimo tiene `user.id` válido; RLS funciona igual que Google
- `AnonymousBanner` (fixed bottom) visible en toda la app mientras el usuario sea anónimo
- Banner CTA "Guardar cuenta" → `linkGoogleAccount()` → OAuth → `user.id` se mantiene, todos los datos persisten
- `onAuthStateChange` detecta la conversión y oculta el banner automáticamente
- **Archivos clave:** `lib/auth.ts`, `components/AnonymousBanner.tsx`, `app/(auth)/login/LoginButton.tsx`

### Feature: Onboarding
**Estado: Completo — soporta usuarios anónimos**

- 3 pasos, flujo lineal (Bienvenida → Configuración → Aha moment)
- Guarda `user_config.onboarding_completed = true` al finalizar
- Si ya completó → redirect a `/`
- `PUT /api/user-config` usa **upsert** (`onConflict: 'user_id'`) → crea la fila si no existe (necesario para anon users que no tienen trigger de creación automática)

---

## 4. Componentes principales

### `DashboardShell` — `components/dashboard/DashboardShell.tsx`
**Client Component** — orquesta todo el dashboard
- Props: `selectedMonth: string`, `viewCurrency: 'ARS' | 'USD'`, `userEmail: string` [2026-04-03]
- Fetch único a `/api/dashboard` con React Query (`['dashboard', month, currency]`)
- Calcula `transferCurrencyAdjustment` (para cross-currency transfers)
- **Header** [2026-04-03]: `flex justify-between` con avatar circular (inicial del email, abre CuentaSheet) a la izquierda y HomePlusButton a la derecha. Eliminados: DashboardHeader (selector de mes), CurrencyToggle.
- Renderiza: header nuevo, SaldoVivo, FiltroEstoico, SubscriptionReviewBanner, Ultimos5, CuentaSheet
- SmartInput flotante fixed-bottom en z-index 50
- Fade abisal en z-index 46

### `SmartInput` — `components/dashboard/SmartInput.tsx`
- Props: `cards: Card[]`, `accounts: Account[]`, `onAfterSave?: () => void`
- Estado: `input`, `isParsing`, `parsed`
- Diseño: pill glass frosted, botón circular `#2178A8` cuando hay input
- Enter o click → `POST /api/parse-expense` → abre `ParsePreview`

### `SaldoVivo` — `components/dashboard/SaldoVivo.tsx`
- Props: `data`, `currency`, `gastosTarjeta`, `transferAdjustment`, `onBreakdownOpen`
- Muestra número hero; **Twin Pills eliminadas** [2026-04-03]
- Toggle ARS/USD inline a la derecha del label (usa `router.push` igual que el CurrencyToggle eliminado) [2026-04-03]
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

### `AnonymousBanner` — `components/AnonymousBanner.tsx`
**Client Component** — visible únicamente para usuarios anónimos
- Se automonta en `(dashboard)/layout.tsx`; se oculta solo (`return null`) si `is_anonymous === false`
- `onAuthStateChange` escucha la conversión anon → Google en tiempo real
- CTA "Guardar cuenta" → `linkGoogleAccount()` con `redirectTo: /auth/callback`
- Diseño: glass frosted `fixed bottom-0 z-50`, mismo lenguaje visual que el resto de la app

### `TabBar` — `components/navigation/TabBar.tsx`
- **3 tabs: Home (`/`), Movimientos (`/movimientos`), Análisis (`/analytics`)** [2026-04-03]
- Config eliminado de la TabBar — accesible desde el avatar en el Home [2026-04-03]
- `isActive` Movimientos: `pathname.startsWith('/movimientos') || pathname.startsWith('/expenses')`
- `monthSuffix` solo en Home y Análisis; Movimientos maneja su periodo internamente
- Icono Movimientos: `ListBullets` (Phosphor)
- Diseño: pill glass frosted centrado, tab activo en `#0D1829` con texto

### `MovimientosClient` — `components/movimientos/MovimientosClient.tsx` [2026-04-03, reescrito 2026-04-05]
**Client Component** — container de la pantalla Movimientos
- Props: `initialMonth: string`
- Estado: `selectedMonth`, `activeFilters: ActiveFilters`, `filterOpen`, `page`, `loadedMovements[]`, `filteredSum`, `filteredSumCurrency`
- `activeFilters` tiene 5 dimensiones: `tipos[]`, `origenes[]`, `cuentas[]`, `categorias[]`, `monedas[]`
- Fetch a `/api/movimientos` con `useState+useEffect` (sin React Query — estado autocontenido)
- `handleOrigenClick('percibido')` activa `origenes: ['percibido','pago_tarjeta']` (coincide con definición del strip: non-CREDIT)
- `activeOrigen` computado: detecta la combinación percibido+pago_tarjeta → devuelve `'percibido'` para resaltar el pill correcto
- `buildFilterSummary()`: la combinación percibido+pago_tarjeta se muestra como "Percibidos"; resto por labels individuales unidos con ` · `
- Period selector `← Mes →` inline en el header, paginación append (infinite-style)
- Skeleton de carga con 5 filas animadas; también skeleton para el total filtrado durante `isLoading`

### `StripOperativo` — `components/movimientos/StripOperativo.tsx` [2026-04-03, actualizado 2026-04-05]
- 3 columnas iguales: Percibidos / Tarjeta / Pago tarjeta
- Props añadidas: `activeOrigen?: OrigenFilter | null`, `onOrigenClick?: (o: OrigenFilter) => void`
- Cuando `onOrigenClick` está definido: cada columna es tappable (`cursor-pointer`, `active:opacity-60`)
- Estado activo: `bg-primary/[0.06]` de fondo, label en `#2178A8`; inactivo: label en `#90A4B0`
- Subtítulos descriptivos: "Caja + débito + pago tarjeta" / "Consumos aún no debitados" / "Pagos reales del mes"
- Datos computados por `/api/movimientos` (stats), siempre del mes completo sin filtrar

### `FiltroSheet` — `components/movimientos/FiltroSheet.tsx` [2026-04-05]
Bottom sheet de filtros avanzados. Reemplaza al `MovimientosFiltros` anterior.
- Exporta: `ActiveFilters`, `EMPTY_FILTERS`, `countFilters()`, tipos `TipoFilter`, `OrigenFilter`, `MonedaFilter`
- Props: `open`, `onClose`, `onApply`, `initial`, `accounts`, `categories`
- Sincroniza estado pendiente `f` con `initial` en cada apertura (`useEffect` en `open`)
- 5 secciones ordenadas:
  1. **Tipo** (siempre visible): gasto / ingreso / transferencia / suscripcion — multi-select chips
  2. **Origen** (condicional — visible si tipos incluye gasto/suscripcion o no hay tipos): percibido / tarjeta / pago_tarjeta
  3. **Cuenta** (colapsible, badge numérico): una cuenta por chip, data viene de la API
  4. **Categoría** (colapsible, badge numérico): categorías del mes actual, data viene de la API
  5. **Moneda** (siempre visible): ARS / USD
- `setTipos()` limpia `origenes` automáticamente si la sección Origen desaparece
- Footer sticky: botón "Aplicar filtros" (azul primario, llama `onApply(f); onClose()`)
- Chips: default `bg-white/60 border-bg-secondary text-text-secondary`; seleccionado `bg-primary/10 border-primary text-primary font-semibold`

### `MovimientosGroupedList` — `components/movimientos/MovimientosGroupedList.tsx` [2026-04-03]
- Agrupa movimientos por fecha, orden cronológico inverso
- Separador de fecha con línea a ambos lados (texto formateado con día + mes)
- Reutiliza el render de ítems de `Ultimos5` (mismo diseño visual)
- Pill "Cuota X/Y" inline con estilo glassmorphism
- Botón "Cargar más" al final cuando `total > loadedMovements.length`

### `CuentaSheet` — `components/settings/CuentaSheet.tsx` [2026-04-03]
**Client Component** — modal accesible desde el avatar en el Home
- Props: `open`, `onClose`, `userEmail`
- Carga al abrir: `/api/accounts`, `/api/cards`, `/api/user-config`
- Secciones: Perfil (avatar + email) / Configuración (botones → sub-sheets) / Preferencias (moneda + rollover) / Cuenta (logout + delete)
- Toggles de moneda y rollover hacen `PUT /api/user-config` directamente

### `CuentasSubSheet` — `components/settings/CuentasSubSheet.tsx` [2026-04-03]
- Modal apilado sobre CuentaSheet (`z-index` propio de Modal)
- Lista de cuentas activas con tipo e ícono
- Botones Banco / Digital / Efectivo → reutiliza `AccountBottomSheet`
- Botón "Listo" → cierra y vuelve al CuentaSheet

### `TarjetasSubSheet` — `components/settings/TarjetasSubSheet.tsx` [2026-04-03]
- Modal apilado sobre CuentaSheet
- Lista de tarjetas con días hasta cierre (warning si ≤5 días)
- Input inline para agregar tarjeta nueva (POST `/api/cards`)
- Botón "Listo" → cierra

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

### `lib/auth.ts`
Helpers de auth del lado del cliente:
- `signInAnonymously()` — crea sesión anónima real en Supabase
- `linkGoogleAccount()` — vincula Google al usuario anónimo actual; incluye `redirectTo: /auth/callback`

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
- Auth: Google OAuth + Anonymous Auth, sesión persistente por cookies (SSR compatible)
- Anonymous users tienen `user.id` válido → RLS (`auth.uid() = user_id`) funciona igual
- Conversión anon → Google via `linkIdentity()` — `user.id` no cambia, datos persisten
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
| Auth + onboarding | ✅ Completo (Google OAuth + Anonymous Auth) |
| SmartInput + ParsePreview | ✅ Completo |
| Saldo Vivo (multicuenta) | ✅ Completo |
| Rollover (3 modos) | ✅ Completo |
| Ingresos | ✅ Completo (doble sistema coexistente) |
| Suscripciones (auto-insert) | ✅ Completo |
| Analytics — Diario | ✅ Completo |
| Analytics — Análisis | ✅ Completo |
| Hero Engine | ✅ Completo |
| Movimientos `/movimientos` | ✅ Completo [2026-04-05] — filtro avanzado |
| Movimientos `/expenses` (legacy) | ✅ Completo (ruta accesible, sin tab) |
| Settings (legacy) | ✅ Completo (ruta accesible, sin tab) |
| CuentaSheet (nueva Config) | ✅ Completo [2026-04-03] |
| Transfers entre cuentas | ✅ Completo |
| Exportación CSV | ✅ Completo |
| Cuotas en curso | ⚠️ Parcial (UI + DB, falta auditar inserción múltiple) |
| Tests | ❌ Sin cobertura |
| Error boundaries | ❌ No implementado |
| Rate limiting persistente | ❌ In-memory, no sobrevive cold starts |
| Límite 50 gastos/día | ❌ Función SQL definida, no llamada |

---

## 10. Historial de cambios

### 2026-04-03 — Rediseño de arquitectura: Home + Movimientos + CuentaSheet

**Scope:** 9 archivos modificados, 9 archivos creados. Build: ✅ sin errores.

#### Nueva tab Movimientos

**Archivos creados:**
- `app/(dashboard)/movimientos/page.tsx` — Route server component con auth check
- `app/api/movimientos/route.ts` — GET con params `month`, `type` (all/gastos/ingresos/tarjeta/transferencias), `categories` (CSV), `page`. Retorna `movements[]`, `stats` (percibidos/tarjeta/pagoTarjeta), `total`, `categories[]`
- `components/movimientos/StripOperativo.tsx` — Card glassmorphism con 3 columnas de métricas
- `components/movimientos/MovimientosFiltros.tsx` — Chips horizontales + modal multiselect de categorías
- `components/movimientos/MovimientosGroupedList.tsx` — Lista agrupada por día, pill Cuota X/Y, "Cargar más"
- `components/movimientos/MovimientosClient.tsx` — Container con period selector, estado local, paginación append

**Lógica de stats en `/api/movimientos`:**
- `percibidos` = expenses no-crédito + pago_tarjetas (egresos reales de caja, ARS)
- `tarjeta` = sum expenses CREDIT excl. "Pago de Tarjetas" (devengado, ARS)
- `pagoTarjeta` = sum expenses category="Pago de Tarjetas" (abonado, ARS)

#### Rediseño del Home

**Archivos modificados:**
- `app/(dashboard)/page.tsx` — agrega prop `userEmail: user.email ?? ''` a `<DashboardShell>`
- `components/dashboard/DashboardShell.tsx`:
  - Nueva prop `userEmail: string`
  - Header reemplazado: grid 3 columnas → flex justify-between (avatar + HomePlusButton)
  - Eliminados imports: `CurrencyToggle`, `DashboardHeader`
  - Agrega estado `cuentaSheetOpen` y monta `<CuentaSheet>`
- `components/dashboard/SaldoVivo.tsx`:
  - Eliminado bloque "Twin Pills" (Percibidos + Tarjeta pills)
  - Eliminados imports: `Wallet`, `CreditCard`, `formatCompact`
  - Agrega imports: `useRouter`, `getCurrentMonth`
  - Agrega toggle ARS/USD inline a la derecha del label, usando `router.push` igual que el CurrencyToggle viejo
- `components/dashboard/Ultimos5.tsx`:
  - Elimina `<Link href="/expenses">Ver todos</Link>` del header
  - Elimina import de `Link` y `ArrowRight`

#### Migración de Config a CuentaSheet

**Archivos creados:**
- `components/settings/CuentaSheet.tsx` — Modal principal con 4 secciones: Perfil / Configuración (acceso a sub-sheets) / Preferencias (moneda + rollover) / Cuenta (logout + delete)
- `components/settings/CuentasSubSheet.tsx` — Sub-sheet de cuentas, reutiliza `AccountBottomSheet`
- `components/settings/TarjetasSubSheet.tsx` — Sub-sheet de tarjetas, reutiliza lógica de `CardsSection`

**Archivos modificados:**
- `components/navigation/TabBar.tsx`:
  - Reemplaza tabs `[Home, Análisis, Config]` → `[Home, Movimientos, Análisis]`
  - Icono: `Gear` eliminado; `ListBullets` agregado
  - `isActive` Movimientos: `pathname.startsWith('/movimientos') || pathname.startsWith('/expenses')`
  - Config tab eliminado (accesible desde avatar en Home)

---

### 2026-04-05 — Filtro avanzado en Movimientos

**Commit:** `95d7773` — `feat(movimientos): filtro avanzado con sheet, pills interactivos y total filtrado`
**Scope:** 4 archivos modificados. Build: ✅ sin errores.

#### Nuevo sistema de filtros

**Archivo creado:**
- `components/movimientos/FiltroSheet.tsx` — reemplaza `MovimientosFiltros.tsx`. Bottom sheet con 5 secciones (Tipo, Origen condicional, Cuenta colapsible, Categoría colapsible, Moneda). Footer sticky con "Aplicar filtros". Exporta `ActiveFilters`, `EMPTY_FILTERS`, `countFilters()` y los tipos de filtro.

**Archivos modificados:**

- `components/movimientos/MovimientosClient.tsx` — reescrito:
  - Estado `typeFilter + categoryFilter[]` reemplazado por `activeFilters: ActiveFilters` (5 dimensiones)
  - Nuevo estado `filterOpen`, `filteredSum`, `filteredSumCurrency`
  - Header: ícono `Funnel` (Phosphor) con badge numérico (`activeCount`) abre el sheet
  - `handleOrigenClick('percibido')` activa `origenes: ['percibido','pago_tarjeta']` — coincide con la definición del strip (non-CREDIT = percibido + pago_tarjeta)
  - Fila de filtro activo: chip `glass-1` truncado con `buildFilterSummary()` + `×` para limpiar (izquierda); skeleton/total filtrado en moneda correcta (derecha)
  - `buildFilterSummary()`: la combinación percibido+pago_tarjeta se consolida como "Percibidos"; el resto se lista con ` · ` como separador

- `components/movimientos/StripOperativo.tsx`:
  - Nuevas props: `activeOrigen?: OrigenFilter | null`, `onOrigenClick?: (o: OrigenFilter) => void`
  - Cada columna es tappable cuando se pasa `onOrigenClick`; estado activo con `bg-primary/[0.06]` y label `#2178A8`
  - Subtítulos actualizados: "Caja + débito + pago tarjeta", "Consumos aún no debitados", "Pagos reales del mes"

- `app/api/movimientos/route.ts` — reescrito:
  - Params nuevos: `tipos`, `origenes`, `cuentas`, `categorias`, `monedas` (CSV). Eliminados: `type`, `categories` del sistema anterior.
  - `wantsExpenses`, `wantsIncome`, `wantsTransfers` derivados de `tipos` para evitar queries innecesarias
  - `cardAccountMap`: `cards.filter(c => c.account_id).map(c => [c.id, c.account_id])` — resuelve gastos de tarjeta de crédito a su cuenta vinculada para el filtro de Cuenta
  - Filtro Cuenta: coincide por `e.account_id` directo, o por `cardAccountMap[e.card_id]` para gastos CREDIT
  - Filtro Origen: cuando `origenes.length > 0`, `filteredIncome` y `filteredTransfers` se vacían (origen es exclusivo de expenses)
  - `filteredSum` se calcula server-side sobre todos los registros filtrados (no solo la página actual). Lógica de neto: solo cuando `tipos` incluye explícitamente `'ingreso'` Y no hay filtro de origen activo.
  - Response agrega: `filteredSum: number`, `filteredSumCurrency: 'ARS' | 'USD'`

#### Decisiones de diseño documentadas

- **"Percibidos" en el strip = percibido + pago_tarjeta:** El strip muestra gastos non-CREDIT (incluye pago de tarjetas), por lo que tocar el pill Percibidos activa ambos orígenes. Usar solo `['percibido']` excluiría los pagos de tarjeta y el total no coincidiría con el número del strip.
- **Origen excluye income/transfers:** Cuando hay filtro de origen activo, income y transfers se excluyen del listado y del `filteredSum`. Los orígenes (percibido/tarjeta/pago_tarjeta) son categorías propias de expenses.
- **`filteredSum` server-side:** Se computa antes de la paginación para que la cifra mostrada represente el total del mes filtrado, no solo la página visible.
- **Skeleton en total filtrado:** Durante `isLoading`, se muestra un skeleton en lugar del total anterior para evitar datos stale visibles al usuario.
