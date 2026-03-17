# Gota — Plan técnico · Estado del proyecto
_Última actualización: 2026-03-13_

---

## Stack
Next.js 16.1.6 · React 19 · TypeScript (strict) · Supabase · Gemini 2.5-flash-lite · Tailwind v4

---

## Audit: diseño / consistencia visual

| Item | Estado | Notas |
|---|---|---|
| Tokens hex en MEMORY.md incorrectos | ✅ Resuelto | Corregidos los 4 valores de bg-* |
| Lucide → Phosphor (TabBar, SaldoVivo, DashboardHeader, Ultimos5) | ✅ Resuelto | Todo migrado |
| `text-white` en ParsePreview → `text-bg-primary` | ✅ Resuelto | |
| Modal border inline rgba → `border-border-ocean` | ✅ Resuelto | |
| Settings `pb-6` → `pb-tab-bar` | ✅ Resuelto | |
| Top3 label `text-text-secondary` → `text-text-label` | ✅ Resuelto | |
| FiltroEstoico sin label de sección | ✅ Resuelto | Agregado "Tipo de gasto" |
| Ultimos5 `×` raw → `X` Phosphor | ✅ Resuelto | |
| SettingsPreferences `type-title` no aplicado | ✅ Resuelto | |
| "Ver todos →" raw arrow | ✅ Resuelto | `ArrowRight` Phosphor |
| `--color-ocean` token faltante | ✅ Resuelto | Agregado a `@theme`, habilita `bg-ocean/X` |
| TabBar boxShadow hardcodeado | ✅ Resuelto | `--shadow-tab-bar` CSS var + `.shadow-tab-bar` utility |
| Gradiente fade `#050A14` literal | ✅ Resuelto | `var(--color-bg-primary)` en layout.tsx y page.tsx |
| SVG fills hardcodeados (login, onboarding) | ✅ Resuelto | `primaryAlpha` de `lib/colors.ts` |
| Objetos JS con hex (TitularHero, CategoriaRow, Compromisos) | ✅ Resuelto | `colors.*` de `lib/colors.ts` |
| SVG stroke ocean en Compromisos | ✅ Resuelto | `oceanAlpha[10]` de `lib/colors.ts` |
| palette.html desactualizada | ✅ Resuelto | Regenerada con todos los tokens + lib/colors.ts |

---

## Riesgos estructurales

### 🔴 Críticos

| # | Item | Archivo/s | Status |
|---|---|---|---|
| R1 | **Sin rate limiting en Gemini API** — spam → costos descontrolados | `app/api/parse-expense/route.ts` | ⬜ Pendiente |
| R2 | **Sin error boundaries** — RPC falla → página blanca silenciosa | `app/(dashboard)/page.tsx`, `analytics/page.tsx` | ⬜ Pendiente |
| R3 | **Cuotas implementadas a medias** — UI existe, backend no popula `installment_group_id/number/total` correctamente | `app/api/expenses/route.ts`, `CuotasEnCursoSheet.tsx` | ⬜ Pendiente |

### 🟡 Medios

| # | Item | Archivo/s | Status |
|---|---|---|---|
| R4 | **`getUser()` duplicado ×26** — sin `requireAuth()` compartido | Todos los route handlers | ⬜ Pendiente |
| R5 | **Cast sin validación en query params** — `as 'CASH' \| 'DEBIT'...` sin runtime check | `app/api/expenses/route.ts:40-46` | ⬜ Pendiente |
| R6 | **Rollover en dos lugares** — auto en page.tsx, manual en CierreMesModal, sin abstracción | `lib/rollover.ts`, `CierreMesModal.tsx`, `page.tsx` | ⬜ Pendiente |
| R7 | **Duplicate detection incompleto** — no considera `currency` ni `account_id` | `app/api/expenses/duplicates/route.ts` | ⬜ Pendiente |
| R8 | **Click-outside save sin feedback de error** — ExpenseItem cierra el panel aunque el save falle | `components/expenses/ExpenseItem.tsx` | ⬜ Pendiente |
| R9 | **Hard delete en cuenta borra balances históricos** sin warning | `app/api/accounts/[id]/route.ts` | ⬜ Pendiente |

### 🟢 Deuda técnica menor

| # | Item | Status |
|---|---|---|
| D1 | `@tanstack/react-query` instalado, nunca importado (~400KB bundle) | ⬜ Pendiente |
| D2 | `addMonths()` definida en 3 archivos (`DashboardHeader`, `SettingsPreferences`, `page.tsx`) | ⬜ Pendiente |
| D3 | `monthly_income` deprecated pero API activa, convive con nuevo sistema | ⬜ Pendiente |
| D4 | `check_daily_expense_limit()` SQL function nunca llamada | ⬜ Pendiente |
| D5 | Tests: 0% de cobertura | ⬜ Pendiente |

---

## Backlog de features

| Feature | Prioridad | Notas |
|---|---|---|
| Tendencias mensuales | Alta | Placeholder en /analytics, datos en DB disponibles |
| Presupuesto por categoría | Alta | Nueva tabla en DB necesaria |
| Onboarding | Media | `app/onboarding/` existe, status desconocido — testear con cuenta nueva |

---

## Protocolo: cambio de paleta de colores

Para cambiar cualquier color del sistema actualizar **únicamente estos 2 archivos**:

1. `app/globals.css` — variables en `@theme {}`
2. `lib/colors.ts` — objeto `colors` + `primaryAlpha` + `oceanAlpha`

Todo lo demás (Tailwind utilities, CSS vars, `color-mix`, `var()` en inline styles) se actualiza en cascada.

---

## Archivos de referencia de diseño

| Archivo | Descripción | Estado |
|---|---|---|
| `app/globals.css` | Fuente de verdad — tokens CSS | ✅ Actualizado |
| `lib/colors.ts` | Tokens JS para SVG/inline | ✅ Creado 2026-03-13 |
| `palette.html` | Referencia visual de colores | ✅ Actualizado 2026-03-13 |
| `design-system-audit-2026-03-03.md` | Audit detallado de UI/componentes | ✅ Vigente |
| `ui-review-plan.md` | Plan de fixes visuales | ✅ Completado |
