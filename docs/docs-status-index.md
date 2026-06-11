# Docs Status Index

**Fecha:** 2026-06-11
**Objetivo:** separar la fuente de verdad actual de documentos historicos, exploratorios o DNU.

## Source of Truth Visual

- [design-system-final.md](/C:/Users/Admin/Documents/gota/docs/design-system-final.md) - documento visual vigente.
- [../app/globals.css](/C:/Users/Admin/Documents/gota/app/globals.css) - tokens y utilities reales.
- [../components/ui/BlueHeaderZone.tsx](/C:/Users/Admin/Documents/gota/components/ui/BlueHeaderZone.tsx) - wrapper del blue header vigente.
- [../components/dashboard/DashboardShell.tsx](/C:/Users/Admin/Documents/gota/components/dashboard/DashboardShell.tsx) - referencia principal de Home.
- [../components/movimientos/MovimientosClient.tsx](/C:/Users/Admin/Documents/gota/components/movimientos/MovimientosClient.tsx) - referencia principal de Movimientos.
- [../components/analytics/AnalyticsClient.tsx](/C:/Users/Admin/Documents/gota/components/analytics/AnalyticsClient.tsx) - referencia principal de Analisis.
- [design-docs-audit-2026-06-11.md](/C:/Users/Admin/Documents/gota/docs/design-docs-audit-2026-06-11.md) - auditoria y reglas de uso de docs.

## Docs Vigentes No Visuales

- [gota-frontend-guidelines.md](/C:/Users/Admin/Documents/gota/docs/gota-frontend-guidelines.md) - patrones de frontend y arquitectura; no usar como fuente visual.
- [gota-backend-structure.md](/C:/Users/Admin/Documents/gota/docs/gota-backend-structure.md) - backend/schema.
- [gota-prd.md](/C:/Users/Admin/Documents/gota/docs/gota-prd.md) - producto y alcance.
- [gota-app-flows.md](/C:/Users/Admin/Documents/gota/docs/gota-app-flows.md) - flujos; validar contra codigo si afecta UI actual.
- [roadmap-deudas-tecnicas-y-negocio.md](/C:/Users/Admin/Documents/gota/docs/roadmap-deudas-tecnicas-y-negocio.md)
- [account-period-balance-decision.md](/C:/Users/Admin/Documents/gota/docs/account-period-balance-decision.md)
- [monthly-income-audit.md](/C:/Users/Admin/Documents/gota/docs/monthly-income-audit.md)
- [cuotas-feature-audit.md](/C:/Users/Admin/Documents/gota/docs/cuotas-feature-audit.md)
- [financial-logic-consolidation-audit.md](/C:/Users/Admin/Documents/gota/docs/financial-logic-consolidation-audit.md)
- [live-balance-dashboard-gap-analysis.md](/C:/Users/Admin/Documents/gota/docs/live-balance-dashboard-gap-analysis.md)
- [movement-classification-audit.md](/C:/Users/Admin/Documents/gota/docs/movement-classification-audit.md)
- [financial-consolidation-status-and-next-step.md](/C:/Users/Admin/Documents/gota/docs/financial-consolidation-status-and-next-step.md)

## Contexto Rapido

- [context.md](/C:/Users/Admin/Documents/gota/docs/context.md)
- [qwen-context.md](/C:/Users/Admin/Documents/gota/docs/qwen-context.md)
- [gota-app-bible.md](/C:/Users/Admin/Documents/gota/docs/gota-app-bible.md)

## DNU Para Decisiones Visuales

Estos documentos no deben usarse como fuente visual vigente. Pueden servir para historia, rationale o comparacion.

- [../DESIGN.md](/C:/Users/Admin/Documents/gota/DESIGN.md)
- [../gota-lightmodedesign.md](/C:/Users/Admin/Documents/gota/gota-lightmodedesign.md)
- [../ui-review-plan.md](/C:/Users/Admin/Documents/gota/ui-review-plan.md)
- [gota-design-system.md](/C:/Users/Admin/Documents/gota/docs/gota-design-system.md)
- [gota-design-specv2.md](/C:/Users/Admin/Documents/gota/docs/gota-design-specv2.md)
- [gota-design-philosophy.md](/C:/Users/Admin/Documents/gota/docs/gota-design-philosophy.md)
- [design-system-audit-2026-03-03.md](/C:/Users/Admin/Documents/gota/docs/design-system-audit-2026-03-03.md)
- [ui-product-upgrade-plan-2026-04-11.md](/C:/Users/Admin/Documents/gota/docs/ui-product-upgrade-plan-2026-04-11.md)
- [mobile-ui-exploration-2026-05.md](/C:/Users/Admin/Documents/gota/docs/mobile-ui-exploration-2026-05.md)
- [analysis-ui-iteration.md](/C:/Users/Admin/Documents/gota/docs/analysis-ui-iteration.md)
- [onboarding-design-prompt.md](/C:/Users/Admin/Documents/gota/docs/onboarding-design-prompt.md)
- [gota_onboarding_v3.html](/C:/Users/Admin/Documents/gota/docs/gota_onboarding_v3.html)
- [gota-landing-login.jsx](/C:/Users/Admin/Documents/gota/docs/gota-landing-login.jsx)
- [uiux-audit-top-tier-2026-04-23.md](/C:/Users/Admin/Documents/gota/docs/uiux-audit-top-tier-2026-04-23.md)
- [saldo-vivo-diagnostico-2026-04.md](/C:/Users/Admin/Documents/gota/docs/saldo-vivo-diagnostico-2026-04.md)
- [saldo-vivo-modelo-y-transicion-2026-04.md](/C:/Users/Admin/Documents/gota/docs/saldo-vivo-modelo-y-transicion-2026-04.md)
- [saldo-vivo-signoff-inputs.md](/C:/Users/Admin/Documents/gota/docs/saldo-vivo-signoff-inputs.md)
- [Gota-Product History.md](/C:/Users/Admin/Documents/gota/docs/Gota-Product History.md)

## Regla Para Prompts Externos

Para Claude/Fable u otro modelo de UI, pasar primero el bloque "Source of Truth Visual". Si se adjuntan docs DNU, aclarar explicitamente que no deben guiar decisiones visuales actuales.
