# Gota Web Panel Brief v1 Implementation Plan

> **For Hermes:** ejecutar en `/root/projects/Gota-worktrees/web-panel-brief-v1`, con TDD por slice y verificación visual antes de activar el flag.

**Goal:** reemplazar, detrás de flag, el Panel desktop basado en cards por un brief financiero presente-tense que usa la verdad financiera y Signals canónicos existentes.

**Architecture:** `WebDashboardRoute` conserva los loaders actuales y selecciona el shell estable o `WebPanelBriefV1` mediante `FF_WEB_PANEL_BRIEF_V1`. La superficie nueva compone Saldo/Disponible/Libre desde `DashboardApiData`, ritmo desde Analytics/Budget y señales desde `/api/intelligence/signals`. No crea detectores paralelos.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 + tokens Gota, TanStack Query, Vitest.

---

## Task 1 — Feature flag y contrato de rollout

**Files**
- Modify: `lib/flags.ts`
- Modify: `lib/__tests__/flags.test.ts`
- Modify: `app/api/intelligence/signals/route.ts`
- Modify: `lib/server/__tests__/signals-route.test.ts`

**RED:** probar que `FF_WEB_PANEL_BRIEF_V1` está apagada por defecto y que Signals API queda habilitada si Signals Center o Web Panel están activos.

**GREEN:** agregar flag y guard compartido sin cambiar defaults existentes.

**Verify:** `npm test -- lib/__tests__/flags.test.ts lib/server/__tests__/signals-route.test.ts`.

## Task 2 — Modelo puro de ritmo Web

**Files**
- Create: `lib/web-panel/month-pace.ts`
- Create: `lib/web-panel/month-pace.test.ts`

**RED/GREEN vertical**
1. Plan activo: observado, referencia al día, delta monto/pp y categoría principal.
2. Sin plan + >=3 meses: promedio same-day, ventana/muestra y delta porcentual.
3. Historia limitada: previous month + quality partial.
4. Sin benchmark: learning sin línea punteada ni cifras comparativas.
5. Excluir pagos de tarjeta, transfers y extraordinarios mediante los datos clasificados que ya entrega Analytics.

**Verify:** `npm test -- lib/web-panel/month-pace.test.ts`.

## Task 3 — Modelo de composición del Panel

**Files**
- Create: `lib/web-panel/panel-model.ts`
- Create: `lib/web-panel/panel-model.test.ts`

**RED/GREEN vertical**
1. Ecuación reconciliable Saldo = Disponible + tarjeta; Libre = Disponible − metas.
2. Estado actual únicamente; histórico se marca como cierre y no usa señales actuales en contenido.
3. Horizon events con `included`, `future`, `estimated` y moneda.
4. Activity rows preservan transferencias y masking.
5. Selección de una señal principal desde `SignalCenterModel` sin reglas financieras nuevas.

## Task 4 — Superficie visual Web Panel v1

**Files**
- Create: `components/dashboard/web-panel/WebPanelBriefV1.tsx`
- Create: `components/dashboard/web-panel/WebPanelTopbar.tsx`
- Create: `components/dashboard/web-panel/WebTrustStage.tsx`
- Create: `components/dashboard/web-panel/WebMonthPace.tsx`
- Create: `components/dashboard/web-panel/WebHorizon.tsx`
- Create: `components/dashboard/web-panel/WebCalculationDrawer.tsx`
- Modify: `components/web/dashboard/WebDashboardRoute.tsx`

**Implementation**
- Flag-off conserva `DesktopDashboardShell` byte-for-byte.
- Flag-on usa canvas editorial, navegación/deep links honestos y estados parciales locales.
- Montos ocultos se formatean en un solo helper.
- El gráfico muestra sólida observada y punteada benchmark seleccionado, marcador de hoy, delta y base metodológica.
- `Plan | Habitual` aparece solo cuando ambos benchmarks existen.

**Verify:** typecheck y render real con datos autenticados o fixtures de exploración.

## Task 5 — Signals desktop y explicación

**Files**
- Create: `components/dashboard/web-panel/WebCalculationDrawer.tsx`
- Modify: `components/signals/SignalsSheet.tsx`
- Modify: `components/ui/FullScreenSheet.tsx`
- Reuse: `hooks/useSignalsCenter.ts`
- Reuse: `components/signals/SignalDetailView.tsx` logic/contracts

**Implementation**
- Drawer derecho 460–520px desktop; full-screen narrow.
- Tabs Ahora/Cobertura.
- Detail con evidencia, data quality, action y Assistant.
- Query compartida con el Action Slot y el drawer; una sola carga canónica por moneda.
- Signal principal usa la misma occurrence que el drawer.
- Sin contador; tone dot semántico.

## Task 6 — Estados, URL y acciones honestas

**Files**
- Modify: `components/web/dashboard/WebDashboardRoute.tsx`
- Modify/new tests under `lib/web-panel/`

**States**
- calm/watch/risk/learning;
- no accounts;
- budget loading/error/empty;
- analytics loading/error;
- stale/partial Signals;
- masked;
- historical context.

**Actions**
- Deep links solo a rutas existentes.
- No simular confirmación de pago.
- Panel actual usa `month=current`; histórico deriva a cierre/Análisis con copy explícito.

## Task 7 — QA y rollout

**Commands**
- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

**Visual QA**
- 1440×1000
- 1280×800
- 820×1180
- masking
- Signals drawer
- learning/error

**Rollout**
- Flag `NEXT_PUBLIC_FF_WEB_PANEL_BRIEF_V1=false` por defecto.
- Preview branch con flag on.
- Smoke autenticado.
- Activación separada; rollback apagando flag.
