# Auditoria de documentacion de diseno - 2026-06-11

## Resultado

La fuente de verdad visual vigente queda consolidada en:

1. `app/globals.css`
2. `docs/design-system-final.md`
3. Implementacion real en pantallas actuales:
   - `components/ui/BlueHeaderZone.tsx`
   - `components/dashboard/DashboardShell.tsx`
   - `components/movimientos/MovimientosClient.tsx`
   - `components/analytics/AnalyticsClient.tsx`
   - `components/dashboard/SaldoVivo.tsx`
   - `components/dashboard/DashboardHeader.tsx`

El patron visual actual es Strategy 5 / Blue Header Zone:
- `blue-zone` para header azul con gradiente.
- `header-glass` para botones/pills sobre el header.
- `card-s5` para tarjetas de contenido en zona blanca.
- Overlap fijo de contenido sobre header: `marginTop: -24`.
- Texto e iconos sobre header en blanco.

## Hallazgos

- `docs/design-system-final.md` si documenta el blue header actual y ahora queda marcado como source of truth.
- `app/globals.css` contiene los tokens/utilities reales: `--color-primary-deep`, `blue-zone`, `header-glass`, `card-s5`.
- Home, Movimientos y Analisis ya usan el patron en codigo real.
- `docs/gota-frontend-guidelines.md` sigue siendo util para arquitectura frontend, pero no para decisiones visuales: es anterior al blue header.
- Varios documentos historicos siguen teniendo valor como contexto, pero mezclan dark mode, Fria v2/v3, exploraciones o planes transicionales. Quedan DNU para UI vigente.

## Docs Vigentes Para UI

- `docs/design-system-final.md`
- `app/globals.css`
- `components/ui/BlueHeaderZone.tsx`
- `components/dashboard/DashboardShell.tsx`
- `components/movimientos/MovimientosClient.tsx`
- `components/analytics/AnalyticsClient.tsx`
- `components/dashboard/SaldoVivo.tsx`
- `components/dashboard/DashboardHeader.tsx`

## Docs DNU Para Decisiones Visuales

- `DESIGN.md`
- `gota-lightmodedesign.md`
- `ui-review-plan.md`
- `docs/gota-design-system.md`
- `docs/gota-design-specv2.md`
- `docs/gota-design-philosophy.md`
- `docs/design-system-audit-2026-03-03.md`
- `docs/ui-product-upgrade-plan-2026-04-11.md`
- `docs/mobile-ui-exploration-2026-05.md`
- `docs/analysis-ui-iteration.md`
- `docs/onboarding-design-prompt.md`
- `docs/gota_onboarding_v3.html`
- `docs/gota-landing-login.jsx`
- `docs/uiux-audit-top-tier-2026-04-23.md`

## Instruccion Recomendada Para Modelos Externos

```text
Use app/globals.css and docs/design-system-final.md as the visual source of truth.
The current UI uses Strategy 5 / Blue Header Zone with blue-zone, header-glass, card-s5, and a fixed -24px content overlap.
Use DashboardShell, MovimientosClient, AnalyticsClient, SaldoVivo, and DashboardHeader as real implementation examples.
Do not use any DNU or historical design document as source for current UI decisions.
If a DNU document conflicts with app/globals.css or design-system-final.md, ignore the DNU document.
```
