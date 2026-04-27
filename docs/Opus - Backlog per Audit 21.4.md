# Gota — Backlog Ideal
**Base:** Auditoría integral + Crítica destructiva UI/UX  
**Fecha:** 2026-04-18

---

## Cómo leer esto

- **Esfuerzo:** S = horas | M = 1-3 días | L = semana+
- **Impacto:** Crítico / Alto / Medio / Bajo
- **Prioridad:** P0 → P4

---

## P0 — Esta semana. Sin esto el producto no se sostiene.

| # | Item | Esfuerzo | Impacto | Razón |
|---|---|---|---|---|
| 01 | **Sentry / error tracking** | S | Crítico | Sin observabilidad en producción estás ciego. Bugs financieros silenciosos son peores que crashes visibles. Setup de 2h. |
| 02 | **Reemplazar todos los `alert()`** | S | Crítico | Destruye la ilusión de calidad en el momento más visible: cuando algo falla. Grep + toast en 20 minutos. |
| 03 | **Métricas baseline** | S | Crítico | Antes de cambiar nada, necesitás saber qué números querés mover: completion rate onboarding, % anónimos vs registrados, D1 retention. Sin baseline, no podés validar que los fixes funcionaron. |
| 04 | **Banner conversión anónimo → registrado** | S | Crítico | Sin conversión no hay retención medible, no hay email, no hay identidad. Trigger a las 10 transacciones: "No pierdas tus datos". |
| 05 | **Unit tests: `lib/live-balance.ts`** | M | Crítico | La lógica financiera core sin tests es una bomba de tiempo. Solo este archivo cubre el 80% del riesgo real. Prerequisito para cualquier refactor. |

---

## P1 — Próxima semana. Activación y primera impresión.

| # | Item | Esfuerzo | Impacto | Razón |
|---|---|---|---|---|
| 06 | **Disponible Real como hero único** | S | Alto | El usuario no entiende "Saldo Vivo". Quiere saber "cuánta plata tengo". Un número, breakdown en tap. Eliminar el flip. |
| 07 | **ParsePreview: colapsar a 3 campos visibles** | S | Alto | SmartInput promete magia y entrega un formulario de 10 campos. Mostrar solo monto, categoría, cuenta por defecto. Todo lo demás en "Más detalles" colapsado. |
| 08 | **SmartInput: estados visuales reales** | S | Alto | Idle → typing → parsing (pulsing dots, no spinner genérico) → preview con spring animation → confirmed con micro-feedback. Es el wow factor que el usuario le muestra a un amigo. |
| 09 | **SmartInput: placeholder rotativo** | S | Alto | "café 2500" estático no enseña. Rotar entre 4-5 ejemplos reales del mercado AR: "uber 1500 tarjeta", "sueldo 450k", "supermercado 12000 visa 3 cuotas". |
| 10 | **Empty states con CTA** | S | Alto | Usuario nuevo llega al dashboard vacío sin saber qué hacer. Ilustración sutil + flecha hacia SmartInput + auto-focus en primer login. El aha moment depende de esto. |
| 11 | **Onboarding: reducir a 6 pasos** | S | Alto | 14 pantallas para una app de "cero fricción" es ironía. W1 Welcome → Pain Point → Currency → Primera cuenta → SmartInput demo real → Dashboard. Eliminar W2, W4, W7, W8. |
| 12 | **Fix submit button SmartInput (44px min)** | S | Alto | Target de 32px en mobile es anti-ergonómico. Apple HIG dice 44px mínimo. 15 minutos de fix, impacto directo en usabilidad. |
| 13 | **Spacing: unificar padding a 16px** | S | Medio | px-2, px-4, px-5 conviven en pantallas de la misma app. El contenido "salta" 4px entre navegación. Mercado Pago usa 16px everywhere. Consistencia básica. |

---

## P2 — Sprint 3-4. Producto que engancha.

| # | Item | Esfuerzo | Impacto | Razón |
|---|---|---|---|---|
| 14 | **Filtro Estoico: conectar al Hero Engine** | M | Alto | El pilar captura fricción sin devolver valor. Agregar señal `wantRatio` al engine: "El 68% de tus gastos fueron deseos". Auto-sugerencia de Necesidad/Deseo por categoría en SmartInput. |
| 15 | **Tipografía: eliminar hardcodeo** | M | Alto | 8 tokens definidos + 6 tamaños hardcodeados (`text-[10px]`, `text-[13px]`, etc.) en producción. El design system es una sugerencia, no un contrato. Grep + replace sistemático con Claude Code. |
| 16 | **Glass morphism: auditar y simplificar** | M | Medio | Blur de blanco sobre blanco tiene costo de GPU sin retorno visual. O se aplica sobre contenido con color (que lo justifique) o se reemplaza por elevación con sombra. Revisar cada instancia. |
| 17 | **Email collection post-OAuth** | M | Alto | El email del token de Google ya está disponible. Capturarlo, almacenarlo, usarlo para email de bienvenida y re-engagement. D7 retention en fintech es ~20% sin esto. |
| 18 | **Simplificar rollover** | M | Alto | Saldo Vivo siempre desde `opening_balance` sin filtro mensual. Deprecar `account_period_balance` como fuente operativa. Elimina la clase entera de bugs ya documentados. |
| 19 | **Presupuestos por categoría (Budget Ligero)** | M | Alto | Transforma la app de espejo a entrenador. El usuario define límite, ve barra de progreso en Top3, recibe alerta al 80%. Setup sugerido automático basado en promedios. |
| 20 | **Service Worker real** | M | Alto | Sin SW no es una PWA, es una web app. Prerequisito para push notifications y offline. `next-pwa` o Serwist en `next.config.ts`. |
| 21 | **Monthly Wrap shareable** | M | Alto | Canal de distribución orgánica #1. Card visual generada client-side con stats del mes, branded, compartible en WhatsApp/stories. Bajo costo, alto potencial viral. |
| 22 | **Paywall informativo (sin cobrar)** | S | Alto | No necesitás integrar MercadoPago todavía. Necesitás saber si alguien haría tap en "Upgrade a Pro". Un paywall con comparación free/pro sin flujo de pago real te da esa señal en días. |
| 23 | **Rate limiting server-side por `user_id`** | S | Medio | El in-memory actual se resetea en cold starts de Vercel. Upstash Redis free tier, sliding window. Previene sorpresas de billing si escala. |
| 24 | **Card payment como acción, no gasto** | M | Medio | CardPaymentPrompt → CardPaymentForm en 1 tap. El usuario nunca ve que es un "gasto con categoría especial". Coherencia con GOT-18. |
| 25 | **Navegación: acceso a Settings desde todas las tabs** | S | Medio | Desde Movimientos y Analytics no hay forma visible de ir a Settings. Un ícono en el header de cada tab resuelve sin necesidad de un 4to tab. |

---

## P3 — Post-tracción. Cuando tenés 50+ usuarios activos.

| # | Item | Esfuerzo | Impacto | Razón |
|---|---|---|---|---|
| 26 | **Monetización Gota Pro (MercadoPago)** | L | Existencial | Sin modelo de monetización definido no hay negocio. Pero implementar antes de tener usuarios es optimizar en vacío. Validar primero con paywall informativo (item 22). |
| 27 | **Push notifications (Fase 1)** | L | Alto | Recordatorio diario + alerta de vencimiento de tarjeta. Requiere SW (item 20). En Android ya funciona, iOS desde 16.4+. |
| 28 | **Metas de ahorro** | M | Medio-alto | Crea razón para volver diariamente. Vinculadas a cuentas USD existentes. Barra de progreso en Analytics. |
| 29 | **Importación CSV de banco** | L | Alto | Elimina la barrera más grande del tracking manual. Templates para Galicia, BBVA, Brubank, MP. Categorización batch via Gemini. |
| 30 | **Refactor Ultimos5 (449 líneas → composición)** | M | Medio | Dios-componente con 4 tipos de movimiento, 4 modales y lógica de sorting. Bugs edge-case imposibles de diagnosticar. Separar por tipo de transacción. |
| 31 | **Analytics: URL-based navigation** | M | Medio | El drill-down con `useState` rompe back button y no permite deep linking. Cada nivel de Analytics debería tener su URL. |
| 32 | **Referral: invitá a un amigo** | M | Alto | Ambos reciben 1 mes Pro gratis. Requiere monetización implementada (item 26). Ualá creció ~100% por referral. |

---

## P4 — Deuda técnica menor. Cuando haya tiempo.

| # | Item | Esfuerzo | Impacto | Razón |
|---|---|---|---|---|
| 33 | **Eliminar `lucide-react`** | S | Bajo | Bundle duplicado con Phosphor. Grep de imports + reemplazar. Higiene técnica, no urgente. |
| 34 | **Tests API routes (Fase 2)** | M | Medio | `POST /api/expenses`, `GET /api/dashboard`. Después de los unit tests de lógica financiera (item 05). |
| 35 | **E2E Playwright (Fase 3)** | L | Medio | Flujo completo SmartInput → dashboard update. Solo tiene sentido cuando el producto está estabilizado. |
| 36 | **Bottom sheet audit y reclasificación** | M | Medio | Regla: sheets para acciones 1-3 campos, full-screen para formularios. Migrar TransferForm, IncomeModal. Previene deuda de diseño futura. |

---

## Items fuera del producto — Pero igual de importantes

| # | Item | Esfuerzo | Impacto | Razón |
|---|---|---|---|---|
| A | **5 sesiones de usuario real (15 min c/u)** | S | Crítico | Todo lo de arriba es análisis interno. Un usuario real usando SmartInput sin instrucciones te va a decir cosas que Opus no encontró. |
| B | **Privacidad: política + account deletion** | S | Crítico | Compliance con Ley 25.326. Blocker legal para lanzamiento en AR. Ya identificado en auditoría previa. |
| C | **Build in public (Twitter/X)** | S | Alto | Canal de distribución orgánica antes de tener producto terminado. Documentar el proceso construye audiencia y acelera feedback loop. |

---

## Resumen ejecutivo

```
Esta semana    → 01-05   Fundamentos: observabilidad, conversión, baseline
Próxima semana → 06-13   Primera impresión: hero, SmartInput, onboarding
Sprint 3-4     → 14-25   Producto que engancha: estoico, budgets, email
Post-tracción  → 26-32   Escala: monetización, push, importación
Siempre        → A, B, C Usuarios reales, legal, distribución
```

**El riesgo ahora no es saber qué hacer. Es no arrancar.**
