# Auditoría Integral — Gota v1.0

**Fecha:** 2026-04-17  
**Alcance:** Producto, negocio, features, diseño, técnica  
**Base:** 36 docs de referencia + codebase completo (~2,764 LOC app)

---

## Dimensión 1: Lógica de Producto y Coherencia

### 1.1 — Saldo Vivo vs. Disponible Real: ambigüedad conceptual para el usuario

**Dimensión:** Lógica de producto  
**Diagnóstico:** Gota tiene dos conceptos financieros core — Saldo Vivo (balance real) y Disponible Real (balance menos compromisos de tarjeta) — pero el usuario promedio no entiende por qué existen dos números ni cuándo mirar cada uno. El "flip" animado entre ambos en el hero es elegante técnicamente pero genera confusión cognitiva. El usuario se pregunta: "¿cuál es mi plata de verdad?". La respuesta correcta es "Disponible Real", pero el hero muestra Saldo Vivo por defecto.

**Por qué ahora:** Es el número #1 que el usuario ve al abrir la app. Si no lo entiende o no confía, el producto falla en su premisa central. Cada segundo de duda es churn potencial.

**Benchmarks:**
- YNAB: muestra "Available to Budget" como número único hero — todo lo demás es secundario
- Copilot (by Monarch): "Cash Available" prominente, debt obligations en sección separada
- Mercado Pago: saldo disponible único, inversiones separadas
- **La lección:** un solo número hero, el resto es contexto expandible

**Propuesta concreta:**
1. Disponible Real como hero por defecto — es el número que responde "¿cuánta plata tengo para gastar?"
2. Saldo Vivo como breakdown — tap en el hero abre SaldoVivoSheet que muestra: Saldo Vivo → menos compromisos tarjeta = Disponible Real
3. Eliminar el flip — reemplazar por un solo número con subtitle dinámico: "Disponible Real · $X en compromisos"
4. Tooltip de onboarding: en el primer uso, explicar en 1 frase: "Este es tu dinero disponible después de descontar lo que debés en tarjeta"

**Data model:** Sin cambios — ambos cálculos ya existen en `lib/live-balance.ts`

**Frontend:**
- Modificar `SaldoVivo.tsx`: eliminar toggle flip, mostrar Disponible Real como hero
- Modificar `SaldoVivoSheet.tsx`: agregar breakdown Saldo Vivo → Compromisos → Disponible Real
- Modificar `DashboardShell.tsx`: ajustar subtitle dinámico

**Effort:** S | **Impacto:** Alto en retención D1/D7. Si el usuario no entiende el hero number, no vuelve.

---

### 1.2 — Categoría "Pago de Tarjetas" como hack contable, no como flujo de usuario

**Dimensión:** Lógica de producto  
**Diagnóstico:** El pago de tarjeta se modela como un "gasto" con categoría especial "Pago de Tarjetas" que se excluye de `gastos_percibidos`. Esto funciona contablemente pero es un anti-pattern de UX: el usuario tiene que "registrar un gasto" para indicar que pagó una deuda. Conceptualmente, pagar la tarjeta no es gastar — es mover plata de cuenta corriente a saldar deuda. Además, el flujo actual obliga a elegir `card_id` manualmente, lo cual es fricción innecesaria cuando la sugerencia de pago (CardPaymentPrompt) ya sabe qué tarjeta y cuánto.

**Por qué ahora:** Con GOT-18 (sugerencia de pago) ya semi-implementado, el flujo punta a punta necesita ser coherente. Si el usuario recibe un prompt "Pagá tu VISA — $45,000" pero tiene que navegar a SmartInput, escribir "pago tarjeta visa 45000", y confirmar categoría y `card_id`... perdiste la magia.

**Benchmarks:**
- Nubank: "Pagar fatura" es un botón dedicado, no un "gasto"
- Mercado Pago: "Pagar tarjeta" es una acción de transferencia, no de gasto
- YNAB: los pagos de tarjeta son "transfers" entre categorías, nunca un gasto

**Propuesta concreta:**
1. CardPaymentPrompt → CardPaymentForm en 1 tap: el banner de sugerencia abre directamente el modal de pago con monto y tarjeta pre-llenados
2. El modal de pago crea la transacción internamente — el usuario nunca ve que es un "gasto con categoría especial"
3. Registrar como tipo `card_payment` en vez de `expense` con categoría "Pago de Tarjetas" (nuevo tipo de transacción)
4. A largo plazo: separar `card_payments` como tabla o al menos como `type: 'card_payment'` en `expenses`

**Data model:**
- Agregar campo `type` a `expenses`: `'expense' | 'card_payment'` (default `'expense'`)
- O mantener el modelo actual pero hacer que el CardPaymentForm lo abstraiga completamente

**Frontend:**
- `CardPaymentPrompt.tsx` → link directo a `CardPaymentForm` modal
- `CardPaymentForm.tsx`: ya existe, conectar con `card-cycles` API para marcar ciclo como pagado
- Ocultar "Pago de Tarjetas" del category picker en SmartInput

**Effort:** M | **Impacto:** Medio en engagement. Reduce fricción en un flujo que ocurre 1-4x/mes por usuario.

---

### 1.3 — El Filtro Estoico no tiene consecuencias

**Dimensión:** Lógica de producto  
**Diagnóstico:** El Filtro Estoico (Necesidad/Deseo) es uno de los 5 pilares del producto, pero actualmente solo produce un pie chart en el dashboard. No genera alertas, no alimenta presupuestos, no cambia el hero message, no tiene metas. Es un dato que se captura con fricción (el usuario tiene que clasificar cada gasto) pero no devuelve valor proporcional al esfuerzo. Esto viola el principio de "reciprocidad inmediata" — si le pedís algo al usuario, devolvé algo en el momento.

**Por qué ahora:** Cada campo que le pedís al usuario sin retorno inmediato es un paso más hacia el abandono del registro manual. Si el filtro no hace nada útil, los usuarios dejan de clasificar, y perdés el pilar.

**Benchmarks:**
- YNAB "Age of Money": un solo metric que da contexto sobre salud financiera — no data input sin output
- Fintual "Monthly Report": insights narrativos basados en clasificación automática
- Copilot "Spending Insights": alertas proactivas cuando una categoría supera el promedio

**Propuesta concreta:**
1. **Hero Engine integration:** agregar señales de Filtro Estoico al `heroEngine/signals.ts` — "El 68% de tus gastos este mes fueron deseos" como hero message
2. **Weekly "Estoico Pulse":** pill semanal en Analytics — "Esta semana: 4 necesidades, 7 deseos, $12,000 en deseos evitables"
3. **Meta mensual (opcional):** "Este mes quiero que máx 40% sean deseos" → barra de progreso en dashboard
4. **Auto-clasificación sugerida:** SmartInput sugiere Necesidad/Deseo basado en categoría (Supermercado = Necesidad, Restaurante = Deseo) — el usuario confirma o corrige

**Data model:**
- Nueva tabla `user_goals`: `id`, `user_id`, `type ('estoico_ratio')`, `target_value (0.4)`, `period ('monthly')`, `active`
- O campo en `user_config`: `estoico_target_ratio: number | null`

**Frontend:**
- `heroEngine/signals.ts`: agregar `wantRatio`, `wantAmount`, `wantCount`
- `heroEngine/rules.ts`: nueva rule `estoico_excess` con priority media
- `heroEngine/templates.ts`: 3 variantes ("Más del 60% fueron deseos — ¿fue intencional?")
- `FiltroEstoico.tsx`: agregar barra de progreso vs meta si existe
- `SmartInput.tsx` / `ParsePreview.tsx`: pre-llenar `is_want` basado en category mapping

**Effort:** M | **Impacto:** Alto en engagement y retención. Le da sentido a un pilar que hoy es decorativo.

---

### 1.4 — Rollover: modelo complejo para un problema que se resuelve más simple

**Dimensión:** Lógica de producto  
**Diagnóstico:** El sistema de rollover (auto/manual/off) con `account_period_balance` como snapshot mensual agrega complejidad significativa al modelo de datos y al código. El diagnóstico en `saldo-vivo-diagnostico-2026-04.md` identifica que el filtro mensual en SQL (`DATE_TRUNC`) rompe el cálculo de Saldo Vivo cuando hay gastos retroactivos. El rollover "compensa" pero no soluciona. La solución correcta ya está identificada: Saldo Vivo siempre calcula desde `opening_balance` hasta hoy, sin filtro mensual. Pero el rollover sigue como mecanismo paralelo, generando confusión.

**Por qué ahora:** Dos sistemas paralelos para lo mismo = bugs. Ya hubo al menos un diagnóstico de root cause por esto.

**Benchmarks:**
- YNAB: no tiene concepto de "meses". Presupuesto continuo, rolling forward.
- Monarch: vista mensual es solo un filtro de display, nunca afecta el cálculo de balance

**Propuesta concreta:**
1. Saldo Vivo = `opening_balance` + ALL transactions from day 0 to today — siempre, sin filtro mensual
2. Vista mensual = filtro de display solamente — Movimientos filtra por mes, pero Saldo Vivo no
3. Deprecar `account_period_balance` como fuente operativa — mantener solo para snapshots históricos (analytics)
4. Rollover mode = siempre "auto" implícito — no hay opción porque no hay nada que "cargar"

**Data model:**
- `account_period_balance`: marcar como readonly / derived-only
- Eliminar `rollover_mode` de `user_config` (o deprecar)
- `opening_balance_ars/usd` en `accounts` se convierte en la única seed

**Frontend:**
- `SaldoVivo.tsx`: simplificar fetch — siempre usa `buildLiveBalanceHeroSummary()` con rango completo
- Eliminar `RolloverBanner.tsx` (ya no necesario)
- Settings: remover toggle de rollover mode

**Effort:** M (refactor de `lib/live-balance.ts` + `dashboard-queries.ts` + API) | **Impacto:** Alto en mantenibilidad. Reduce superficie de bugs en el cálculo financiero core.

---

## Dimensión 2: Oportunidades de Negocio

### 2.1 — Conversión anónimo → registrado: sin urgencia ni gancho

**Dimensión:** Negocio  
**Diagnóstico:** Gota permite auth anónima — excelente para reducir fricción de entrada. Pero no hay un mecanismo claro de "momento de verdad" para convertir al usuario anónimo en registrado. La conversión depende de que el usuario voluntariamente vaya a Settings y linkee su cuenta Google. No hay trigger proactivo (ej: "Llevás 15 transacciones, registrate para no perder tus datos"), no hay límite de funcionalidad, no hay urgencia.

**Por qué ahora:** Sin conversión, no hay retención medible, no hay email para re-engagement, no hay identidad para monetizar. Es el cuello de botella de todo el funnel.

**Benchmarks:**
- Duolingo: permite uso anónimo pero a los 3 días muestra "Guardá tu progreso" con urgencia emocional
- Notion: "Guest mode" con límite de bloques — fuerza registro orgánicamente
- Fintual: onboarding requiere registro, pero la experiencia pre-registro es tan buena que no importa
- Todoist: 5 projects free → registro para más

**Propuesta concreta:**
1. **Trigger por transacciones:** al llegar a 10 transacciones, mostrar banner persistente: "Ya registraste $X en gastos. Creá tu cuenta para no perder tus datos."
2. **Trigger por tiempo:** después de 3 días de uso, mostrar modal de conversión
3. **Trigger por feature:** al intentar usar Analytics o Export, pedir registro
4. **"Tus datos son efímeros":** mostrar warning sutil en dashboard para anónimos — "Sesión temporal · tus datos se pierden si cerrás el navegador"
5. **Post-registro reward:** "Ahora tenés acceso a Analytics completo + Export"

**Data model:**
- Agregar a `user_config`: `anonymous_transaction_count: number`, `first_seen_at: timestamp`
- O derivar del count de `expenses` + `income_entries`

**Frontend:**
- Nuevo componente `ConversionBanner.tsx` en dashboard (condicional a `auth.user.is_anonymous`)
- Modal de conversión: reusar `LoginButton.tsx` con copy persuasivo
- Gate en `/analytics` y `/api/export`: check `is_anonymous` → redirect a modal

**Effort:** S | **Impacto:** Crítico para funnel. Sin esto, 0% de retención medible a largo plazo.

---

### 2.2 — Monetización: el paywall es un placeholder sin estrategia

**Dimensión:** Negocio  
**Diagnóstico:** `StepW8Paywall.tsx` existe como placeholder. No hay definición de qué es free vs. premium, no hay pricing, no hay trial. El onboarding wizard termina en un paywall vacío — esto es un anti-pattern porque el usuario acaba de hacer 8 pasos de setup y lo último que ve es un muro sin propuesta de valor.

**Por qué ahora:** Sin modelo de monetización definido, no podés priorizar features. Todo se hace "porque sí" en vez de "porque convierte".

**Benchmarks:**
- YNAB: $14.99/mo, trial de 34 días. Free = nada. Funciona porque el producto es excelente.
- Copilot: $14.99/mo. Free tier muy limitado. Investment tracking es premium.
- Monarch: $9.99/mo. Bank connection es el differentiator premium.
- Fintual: freemium con advisory premium. Core investing es free.
- **Finanzas AR context:** Mercado Pago, Ualá, etc. son free — el usuario AR no está acostumbrado a pagar por fintech. Pero sí paga por productividad (Notion, Spotify).

**Propuesta concreta — Modelo Freemium con "Gota Pro":**

| Feature | Free | Pro ($2,999/mo ARS ~$3 USD) |
|---|---|---|
| SmartInput | 20 parses/mes | Ilimitado |
| Transacciones | Ilimitadas | Ilimitadas |
| Cuentas | 2 | Ilimitadas |
| Tarjetas | 1 | Ilimitadas |
| Analytics básico | Sí | Sí |
| Fuga Silenciosa | No | Sí |
| Mapa de Hábitos | No | Sí |
| Compromisos detallado | No | Sí |
| Export CSV/JSON | No | Sí |
| Filtro Estoico metas | No | Sí |
| Multi-currency USD | Básico | Completo con cotización |

**Data model:**
- Agregar a `user_config`: `plan: 'free' | 'pro'`, `plan_expires_at: timestamp | null`
- Tabla `subscriptions_billing`: `user_id`, `provider_id`, `status`, `amount`, `currency`, `started_at`, `expires_at`

**Frontend:**
- `StepW8Paywall.tsx`: rediseñar con comparación free/pro, CTA claro
- `lib/flags.ts`: agregar checks de plan — `isPro(user_config)`
- Gates en Analytics subfeatures, Export, y límites de SmartInput

**Effort:** L (requiere payment provider integration) | **Impacto:** Existencial. Sin monetización no hay negocio.

---

### 2.3 — Viralidad: cero mecanismos de distribución orgánica

**Dimensión:** Negocio  
**Diagnóstico:** Gota no tiene ningún mecanismo de distribución orgánica. No hay share, no hay referral, no hay contenido exportable que sirva como marketing, no hay "wow moment" compartible. En fintech AR, el boca a boca es el canal #1 (Ualá creció casi 100% por referral).

**Por qué ahora:** Antes de invertir en paid acquisition, los canales orgánicos deberían estar optimizados.

**Benchmarks:**
- Ualá: referral con cashback para ambos
- Splitwise: viral por naturaleza (compartir gastos requiere invitar)
- Duolingo: share streaks en stories
- YNAB: no tiene viral loop, depende de content marketing

**Propuesta concreta:**
1. **Monthly Wrap shareable:** al cierre de mes, generar una imagen/card con stats del mes — "En marzo gasté $X, el 60% fueron necesidades, mi categoría top fue Supermercado". Diseño branded, compartible en stories/WhatsApp.
2. **Referral simple:** "Invitá a un amigo → ambos reciben 1 mes de Pro gratis"
3. **Export como marketing:** el CSV exportado incluye header "Generado con Gota — gotafinanzas.ar"

**Data model:**
- `referrals`: `id`, `referrer_user_id`, `referred_user_id`, `status`, `reward_applied_at`
- Monthly wrap: generado client-side con canvas/SVG, no necesita backend

**Frontend:**
- Nuevo componente `MonthlyWrap.tsx` en Analytics — generador de card visual
- `ReferralSection.tsx` en Settings
- Share API / download image

**Effort:** M (Monthly Wrap) + M (Referral) | **Impacto:** Alto en acquisition. El monthly wrap es el más fácil de implementar con mayor potencial viral.

---

### 2.4 — Sin email collection = sin re-engagement

**Dimensión:** Negocio  
**Diagnóstico:** Incluso usuarios registrados (Google OAuth) no tienen un canal de comunicación directa. No hay email de bienvenida, no hay weekly digest, no hay "volvé, hace 7 días que no registrás gastos". El único canal es que el usuario abra la PWA voluntariamente.

**Por qué ahora:** D7 retention en fintech personal es ~20%. Sin re-engagement, estás dejando 80% de los usuarios en la mesa.

**Benchmarks:**
- Mint/Monarch: weekly spending summary email
- YNAB: "You have money to budget" email cuando hay income sin asignar
- Copilot: "Your net worth changed by X%" monthly email

**Propuesta concreta:**
1. **Email de Google OAuth:** al registrarse, capturar email del perfil de Google (ya disponible en el token)
2. Almacenar en `user_config`: `email: string | null`, `email_notifications: boolean`
3. **Fase 1 — Transactional:** email de bienvenida + "Tu primer mes en Gota" al cierre del primer mes
4. **Fase 2 — Re-engagement:** "Hace X días que no registrás gastos" (via Supabase Edge Functions + cron)
5. **Fase 3 — Digest:** weekly summary con top 3 categorías y Disponible Real

**Data model:**
- `user_config`: agregar `email`, `email_opt_in`, `last_activity_at`
- Supabase Edge Function para cron jobs

**Frontend:**
- Capturar email en `auth/callback/route.ts` post-OAuth
- Settings: toggle "Recibir resumen semanal por email"

**Effort:** M | **Impacto:** Alto en retención D7/D30.

---

## Dimensión 3: Features de Alto Impacto No Implementadas

### 3.1 — Presupuestos por categoría (Budget Limits)

**Dimensión:** Feature  
**Diagnóstico:** Es la feature #1 más pedida en apps de finanzas personales y Gota no la tiene. Sin presupuestos, el usuario puede ver cuánto gasta pero no puede definir cuánto quiere gastar. Es la diferencia entre un espejo y un entrenador.

**Por qué ahora:** Sin presupuestos, Analytics es informativo pero no accionable. El usuario ve que gastó mucho en Restaurantes pero no tiene un benchmark personal.

**Benchmarks:**
- YNAB: presupuesto es el core — "Give every dollar a job"
- Monarch: budget por categoría con % y barra de progreso
- Copilot: "Smart budgets" que se ajustan automáticamente al promedio de 3 meses
- Mercado Pago: no tiene (oportunidad de diferenciación)

**Propuesta concreta — Modelo "Budget Ligero":**
1. El usuario define límite mensual por categoría (ej: "Restaurantes: $30,000")
2. Dashboard muestra barra de progreso en `Top3.tsx` — "Restaurantes: $22,000 / $30,000 (73%)"
3. Alert cuando llega al 80%: hero message "Estás cerca del límite en Restaurantes"
4. Resumen mensual: "Cumpliste 4/6 presupuestos este mes"
5. Setup automático sugerido: "Basado en tus últimos 3 meses, te sugerimos estos límites" → un tap para aceptar

**Data model:**
```sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'ARS',
  period TEXT DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: user_id = auth.uid()
```

**Frontend:**
- `BudgetSetup.tsx`: pantalla en Settings para definir límites
- `BudgetSuggestion.tsx`: modal que sugiere basado en promedios
- Modificar `Top3.tsx`: agregar barra de progreso vs budget
- `heroEngine/signals.ts`: señal `budgetNearLimit` cuando gasto > 80% del presupuesto
- `heroEngine/rules.ts`: rule `budget_warning` con priority alta

**Effort:** M | **Impacto:** Alto en engagement y retención. Transforma la app de tracker pasivo a coach activo.

---

### 3.2 — Metas de ahorro

**Dimensión:** Feature  
**Diagnóstico:** El usuario argentino ahorra en USD (blue, MEP, crypto). Gota trackea USD pero no tiene concepto de "meta de ahorro". Sin metas, el ahorro es accidental, no intencional. Esto es una oportunidad enorme para engagement recurrente.

**Por qué ahora:** Las cuentas remuneradas y el yield engine ya existen — las metas de ahorro son la capa de UX sobre esa infraestructura.

**Benchmarks:**
- Mercado Pago: "Alcancías" — metas de ahorro con nombre y ícono
- Ualá: "Objetivos" — similar
- Qapital: reglas automáticas de ahorro

**Propuesta concreta:**
1. Meta = nombre + monto objetivo + moneda + fecha target (opcional)
2. Vincular a cuenta específica (ej: "Viaje a Brasil" → cuenta USD)
3. Barra de progreso en dashboard (si hay espacio) o en Analytics
4. Sugerencia: "Si ahorrás $X por mes, llegás a tu meta en Y meses"

**Data model:**
```sql
CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'ARS',
  account_id UUID REFERENCES accounts,
  target_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Frontend:**
- `SavingsGoals.tsx` en Analytics o sección dedicada
- `GoalProgress.tsx` — barra de progreso circular
- Integración con SaldoVivo breakdown: mostrar cuánto del saldo está "comprometido" en metas

**Effort:** M | **Impacto:** Medio-alto en engagement. Crea razón para volver diariamente.

---

### 3.3 — Notificaciones push (PWA)

**Dimensión:** Feature  
**Diagnóstico:** Sin push notifications, la app es 100% pull — el usuario tiene que acordarse de abrir Gota. En un mercado donde compite con apps bancarias que sí notifican (Ualá, MP), esto es una desventaja de engagement.

**Por qué ahora:** Las PWA soportan push notifications en Android y desktop (Safari iOS desde 16.4+). Es la diferencia entre D7 retention del 15% y del 35%.

**Benchmarks:**
- Mercado Pago: notificación por cada movimiento
- Ualá: alerts de gastos
- YNAB: "Overspent in category" push

**Propuesta concreta:**

*Fase 1 — Recordatorios básicos:*
- "¿Registraste tus gastos de hoy?" (configurable: hora del día)
- "Mañana vence el pago de tu VISA"
- "Tu suscripción de Netflix se cobra en 2 días"

*Fase 2 — Insights:*
- "Llegaste al 80% del presupuesto de Restaurantes"
- "Este mes ahorraste un 15% más que el anterior"

**Data model:**
```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- user_config: notification_preferences JSONB
```

**Frontend:**
- Service worker registration en `layout.tsx`
- `NotificationSettings.tsx` en Settings
- Supabase Edge Function + cron para triggear notificaciones

**Effort:** L | **Impacto:** Alto en retención D7/D30.

---

### 3.4 — Importación de gastos desde banco/tarjeta (CSV)

**Dimensión:** Feature  
**Diagnóstico:** El input manual es el talón de Aquiles de toda app de finanzas personales. SmartInput reduce la fricción pero no la elimina. La importación de CSV del resumen de tarjeta o extracto bancario permite bootstrap rápido y reduce el esfuerzo continuo.

**Por qué ahora:** Es la razón #1 por la que usuarios abandonan apps manuales vs. apps con bank connection (Mint, Monarch). Gota no puede conectarse a bancos AR (no hay APIs públicas), pero los bancos AR sí permiten download de CSV/XLS.

**Benchmarks:**
- Monarch: bank connection automática (US market)
- Bluecoins: importación CSV con mapping de columnas
- Money Manager Ex: importación QIF/CSV

**Propuesta concreta:**
1. Upload de CSV/XLS en Settings → "Importar movimientos"
2. Preview con mapping de columnas (date, amount, description)
3. SmartInput batch: pasar cada fila por Gemini para categorizar automáticamente
4. Confirmación grupal: el usuario revisa y confirma todo de una vez
5. Templates pre-configurados para bancos AR: Galicia, BBVA, Santander, Nación, Brubank, MP

**Data model:**
- `import_batches`: `id`, `user_id`, `source`, `row_count`, `processed_count`, `status`, `created_at`
- Las transacciones importadas usan la misma tabla `expenses` con un campo `source: 'manual' | 'import' | 'subscription'`

**Frontend:**
- `ImportWizard.tsx`: upload → preview → mapping → confirm
- Reusar `parse-expense` API para categorización batch

**Effort:** L | **Impacto:** Alto en onboarding y retención. Elimina la barrera más grande del tracking manual.

---

## Dimensión 4: Diseño y UX

### 4.1 — Bottom sheet overload: todo es un bottom sheet

**Dimensión:** Diseño  
**Diagnóstico:** La app usa bottom sheets para casi todo: filtros, breakdown de saldo, detalle de gasto, pago de tarjeta, transfer, income, month selector. Esto genera "sheet fatigue" — el usuario no sabe si va a encontrar un formulario, un detalle, o un listado cuando abre un sheet. Además, los sheets no tienen profundidad visual consistente: algunos usan `glass-2`, otros `glass-3`, otros `surface-module`.

**Por qué ahora:** Con cada nueva feature (budgets, goals, import), la tentación es agregar otro sheet. Si no se resuelve ahora, la deuda de UX crece exponencialmente.

**Benchmarks:**
- Apple Wallet: bottom sheets para detalle, full-screen para acciones
- Revolut: mezcla de inline expansion + full-screen modals
- Mercado Pago: bottom sheets solo para confirmaciones rápidas, navegación full-screen

**Propuesta concreta — Regla de diseño:**
- **Bottom sheet:** acciones rápidas de 1-3 campos (filtros, selector, confirmación)
- **Modal full-screen:** formularios complejos (nuevo gasto manual, transfer, import)
- **Inline expansion:** detalles de lectura (breakdown de saldo, detalle de transacción)
- Aplicar consistencia de glass: sheets = `glass-3`, inline = `glass-1`, modals = `surface-module`

**Frontend:**
- Auditar cada sheet existente y reclasificar
- Crear `FullScreenModal.tsx` component para formularios
- Migrar `TransferForm`, `IncomeModal`, `CardPaymentForm` a full-screen

**Effort:** M | **Impacto:** Medio en UX quality. Previene deuda de diseño futura.

---

### 4.2 — SmartInput: el differentiator está sub-explotado visualmente

**Dimensión:** Diseño  
**Diagnóstico:** SmartInput es el pilar #1 de Gota — "cero fricción" — pero visualmente es una barra de input normal en el dashboard. No tiene presencia hero, no tiene animación de parseo, no tiene feedback de éxito memorable. El "momento mágico" (escribís lenguaje natural → se crea una transacción estructurada) debería sentirse como magia, no como un formulario.

**Por qué ahora:** Es el primer touch point funcional del usuario. Si no impresiona, no hay retention story.

**Benchmarks:**
- Arc Browser search bar: input que se expande y transforma con animación fluida
- Raycast: input → resultado con transición cinematográfica
- ChatGPT: typing animation + resultado progresivo

**Propuesta concreta:**
1. **Typing state:** micro-animación de "pensando..." mientras Gemini parsea (pulsing dots con accent color)
2. **Parse success:** ParsePreview aparece con spring animation desde el input, no como sheet separado
3. **Confetti micro:** al confirmar, partículas sutiles (2-3 gotas de agua, on brand) antes de que el gasto aparezca en Ultimos5
4. **Empty state mejorado:** placeholder rotativo — "café 2500", "uber 1200 tarjeta", "sueldo 450k"
5. **Shortcut visual:** mostrar que acepta "3k" = $3,000 y "medio palo" = $500,000

**Frontend:**
- `SmartInput.tsx`: agregar states (`idle → typing → parsing → preview → confirmed`)
- CSS animations en `globals.css`: keyframes para parsing dots, spring preview, micro-confetti
- `ParsePreview.tsx`: transform origin desde el input position

**Effort:** S | **Impacto:** Alto en perceived quality y "wow factor". Es lo que el usuario le muestra a un amigo.

---

### 4.3 — Onboarding wizard: 14 pasos es excesivo

**Dimensión:** Diseño  
**Diagnóstico:** El flujo actual tiene 8 pasos de wizard (W1-W8) + 6 pasos de setup (1-6) = 14 pantallas antes de llegar al dashboard. Para una app de "cero fricción", esto es ironía. El drop-off rate en onboarding aumenta ~20% por cada pantalla adicional después de la tercera.

**Por qué ahora:** Es literalmente la puerta de entrada. Si el 70% abandona en el paso 5, nunca vieron el producto.

**Benchmarks:**
- Duolingo: 4 pantallas de onboarding → ya estás en la lección
- Revolut: 3 pantallas → verificación → dashboard
- Copilot: bank connection → 2 pantallas → dashboard con datos

**Propuesta concreta — Reducir a 6 pantallas total:**
1. W1 Welcome (mantener — 2 sec, auto-advance)
2. W3 Pain Point (mantener — captura intent)
3. W5 Currency (mantener — necesario para setup)
4. Setup: tu primera cuenta (fusionar Step2 Account)
5. SmartInput demo ("Probá: café 2500" — el usuario hace su primera transacción en el onboarding)
6. Done → Dashboard

**Eliminar:** W2 Goal (decorativo), W4 Proof (no aporta a D7), W6 (redundante), W7 Processing (artificial), W8 Paywall (moverlo a después del día 3)

**Frontend:**
- Reducir `OnboardingFlow.tsx` de 14 a 6 steps
- Mover paywall a trigger por uso (ver 2.2)
- `StepSmartInputDemo.tsx`: nuevo step con SmartInput real pre-configurado

**Effort:** S | **Impacto:** Alto en conversión onboarding → dashboard. Cada pantalla eliminada = +10-15% completion.

---

### 4.4 — Empty states: la app vacía no invita a usarla

**Dimensión:** Diseño  
**Diagnóstico:** Un usuario nuevo que completa el onboarding llega a un dashboard con Saldo Vivo = $0, Ultimos5 vacío, Top3 vacío, Analytics vacío. No hay guía visual de qué hacer. El SmartInput está ahí pero no es obvio que es el primer paso.

**Por qué ahora:** El "aha moment" es cuando el usuario registra su primer gasto y ve cómo se refleja en Saldo Vivo. Si no lo encuentra rápido, no hay aha moment.

**Benchmarks:**
- Notion: empty states con ilustraciones y CTAs claros
- Linear: "Create your first issue" prominente
- Todoist: "All done! Enjoy your day" con ilustración

**Propuesta concreta:**
1. **Dashboard empty state:** ilustración sutil + texto "Registrá tu primer gasto" con flecha hacia SmartInput
2. **SmartInput auto-focus:** al primer login post-onboarding, el input está focused con placeholder animado
3. **Guided first transaction:** tooltip sobre SmartInput: "Escribí algo como 'café 2500'" → al confirmar, celebración
4. **Progressive disclosure:** Ultimos5 y Top3 muestran placeholder cards con copy motivacional hasta que haya data

**Frontend:**
- `EmptyDashboard.tsx`: componente condicional cuando `expenses.length === 0`
- `FirstTransactionGuide.tsx`: tooltip/spotlight component
- Empty states para cada sección: `Ultimos5Empty`, `Top3Empty`, `AnalyticsEmpty`

**Effort:** S | **Impacto:** Alto en activación D1. Es la diferencia entre "qué hago acá" y "ah, qué fácil".

---

## Dimensión 5: Arquitectura Técnica y Deuda Técnica

### 5.1 — Sin tests: cero cobertura en lógica financiera crítica

**Dimensión:** Técnica  
**Diagnóstico:** No hay ni un solo test en el repositorio. Ni unit tests para `live-balance.ts`, ni integration tests para los API routes, ni E2E. La lógica financiera (Saldo Vivo, Disponible Real, cuotas, card cycles) es lo más crítico de la app — un bug ahí destruye la confianza del usuario. Ya hubo al menos un diagnóstico de root cause de Saldo Vivo (`saldo-vivo-diagnostico-2026-04.md`), que un test habría prevenido.

**Por qué ahora:** Cada refactor (como la simplificación de rollover propuesta en 1.4) es un riesgo alto sin tests. Y el codebase va a crecer.

**Propuesta concreta:**

*Fase 1 — Unit tests para lógica financiera (prioridad máxima):*
- `lib/live-balance.ts`: test de cada función con escenarios (multi-cuenta, multi-moneda, con/sin tarjeta, con instrumento activo)
- `lib/analytics/computeCompromisos.ts`: test de ciclos pagados, pendientes, vencidos
- `lib/movement-classification.ts`: test de cada clasificación
- `lib/card-cycles.ts`: test de cálculo de períodos
- `lib/expenses/installments.ts`: test de generación de cuotas

*Fase 2 — API route tests:*
- `POST /api/expenses`: test de creación con y sin cuotas, con tarjeta
- `GET /api/dashboard`: test de respuesta con y sin data

*Fase 3 — E2E con Playwright:*
- Flujo SmartInput → expense → dashboard update
- Flujo card payment → compromisos update

**Frontend:**
- Agregar `vitest` al proyecto (compatible con Next.js)
- Crear `__tests__/` o `*.test.ts` colocated
- CI: agregar `npm test` a Vercel build pipeline

**Effort:** M (fase 1) + L (fases 2-3) | **Impacto:** Crítico en mantenibilidad y confianza. Prerequisito para cualquier refactor serio.

---

### 5.2 — Rate limiting insuficiente: SmartInput expuesto a abuso

**Dimensión:** Técnica  
**Diagnóstico:** `lib/rate-limit.ts` existe pero el rate limiting es client-side o basado en IP, lo cual es trivial de bypassear. Cada llamada a Gemini Flash cuesta dinero. Un usuario malicioso o un bot puede generar cientos de llamadas. No hay throttling server-side robusto ni API key rotation.

**Por qué ahora:** Si la app escala a 100+ usuarios, el costo de Gemini puede volverse prohibitivo sin control.

**Propuesta concreta:**
1. Rate limit server-side por `user_id`: 30 parses/día para free, 100/día para pro
2. Usar Upstash Redis (free tier) para sliding window counter
3. Fallback: si Redis no disponible, in-memory counter (por instancia Vercel)
4. Response: 429 con header `Retry-After` y mensaje amigable

**Data model:**
- Redis key: `ratelimit:parse:{user_id}` con TTL 24h
- O campo en `user_config`: `daily_parse_count`, `daily_parse_reset_at`

**Frontend:**
- `SmartInput.tsx`: mostrar remaining parses ("18 restantes hoy")
- Error handling: mostrar "Alcanzaste el límite diario" con opción de upgrade

**Effort:** S | **Impacto:** Medio en costo operativo. Previene sorpresas de billing.

---

### 5.3 — Dual icon library: Phosphor + Lucide = bundle innecesario

**Dimensión:** Técnica  
**Diagnóstico:** `package.json` incluye tanto `@phosphor-icons/react` como `lucide-react`. Esto duplica el bundle de íconos. El design system especifica Phosphor duotone como estándar.

**Por qué ahora:** Bundle size afecta TTI (Time to Interactive) en PWA, especialmente en conexiones 3G/4G argentinas.

**Propuesta concreta:**
1. Auditar uso de Lucide — reemplazar cada instancia con equivalente Phosphor
2. Eliminar `lucide-react` de dependencies
3. Usar tree-shaking de Phosphor (importar íconos individuales, no el paquete completo)

**Frontend:**
- Grep de `lucide-react` imports → reemplazar con Phosphor
- Verificar que `next.config.ts` tiene tree-shaking habilitado

**Effort:** S | **Impacto:** Bajo en performance, pero es higiene técnica.

---

### 5.4 — Sin Service Worker: la "P" de PWA no funciona

**Dimensión:** Técnica  
**Diagnóstico:** Gota se autodefine como PWA pero no tiene service worker registrado. Sin SW, no hay: offline support, push notifications, background sync, install prompt mejorado. Es una web app, no una PWA.

**Por qué ahora:** Las push notifications (3.3) y el offline-first (para zonas con conectividad intermitente en AR) requieren SW.

**Benchmarks:**
- Twitter Lite PWA: SW con cache-first para timeline, network-first para API
- Starbucks PWA: funciona offline con menú cacheado

**Propuesta concreta:**
1. `next-pwa` o Serwist para Next.js 15 — genera SW automáticamente
2. Cache strategy: cache-first para assets estáticos, network-first para API
3. Offline fallback: página "Sin conexión — tus datos se sincronizarán cuando vuelvas"
4. `manifest.json`: verificar que tiene `display: standalone`, icons, `theme_color`

**Frontend:**
- Configurar `next-pwa` o Serwist en `next.config.ts`
- `public/manifest.json`: verificar completitud
- Offline fallback page

**Effort:** M | **Impacto:** Alto en experiencia mobile y prerequisito para push notifications.

---

### 5.5 — No hay logging ni error tracking en producción

**Dimensión:** Técnica  
**Diagnóstico:** No hay Sentry, LogRocket, ni ningún servicio de error tracking. Si un usuario tiene un bug en producción, no hay forma de diagnosticarlo excepto que reporte manualmente. Para lógica financiera, un error silencioso (balance mal calculado) es peor que un crash visible.

**Por qué ahora:** A medida que escale, los bugs van a aparecer en combinaciones edge case que no podés anticipar.

**Propuesta concreta:**
1. Sentry: integración con Next.js (SDK oficial, 5 min setup)
2. Custom breadcrumbs: loggear cada cálculo de Saldo Vivo con inputs/output
3. User context: incluir `user_id` (no PII) en Sentry para correlación

**Frontend:**
- `npm install @sentry/nextjs`
- `sentry.client.config.ts`, `sentry.server.config.ts`
- Wrappear `live-balance.ts` con try/catch + `Sentry.captureException`

**Effort:** S | **Impacto:** Crítico en operabilidad. Sin esto estás ciego en producción.

---

## Matriz de Priorización

| # | Hallazgo | Effort | Impacto | Prioridad |
|---|---|---|---|---|
| 5.1 | Tests en lógica financiera | M | Crítico | **P0** |
| 5.5 | Error tracking (Sentry) | S | Crítico | **P0** |
| 2.1 | Conversión anónimo → registrado | S | Crítico | **P0** |
| 1.1 | Disponible Real como hero | S | Alto | **P1** |
| 4.3 | Reducir onboarding a 6 pasos | S | Alto | **P1** |
| 4.4 | Empty states | S | Alto | **P1** |
| 1.3 | Filtro Estoico con consecuencias | M | Alto | **P1** |
| 4.2 | SmartInput wow factor | S | Alto | **P1** |
| 3.1 | Presupuestos por categoría | M | Alto | **P2** |
| 2.4 | Email collection + re-engagement | M | Alto | **P2** |
| 1.4 | Simplificar rollover | M | Alto | **P2** |
| 5.4 | Service Worker real | M | Alto | **P2** |
| 2.3 | Monthly Wrap shareable | M | Alto | **P2** |
| 1.2 | Card payment como acción, no gasto | M | Medio | **P2** |
| 2.2 | Monetización Gota Pro | L | Existencial | **P3** |
| 3.3 | Push notifications | L | Alto | **P3** |
| 3.2 | Metas de ahorro | M | Medio-alto | **P3** |
| 3.4 | Import CSV de banco | L | Alto | **P3** |
| 4.1 | Reducir bottom sheet overload | M | Medio | **P3** |
| 5.2 | Rate limiting robusto | S | Medio | **P3** |
| 5.3 | Eliminar Lucide (dual icons) | S | Bajo | **P4** |

---

## Recomendación Ejecutiva

**Sprint 1 (esta semana):** P0 — Sentry (2h), tests de `live-balance.ts` (4h), banner de conversión anónimo (3h)

**Sprint 2 (próxima semana):** P1 — Disponible Real como hero, reducir onboarding, empty states, SmartInput polish

**Sprint 3-4:** P2 — Presupuestos, email, simplificar rollover, service worker

**Post-traction (50+ usuarios activos):** P3 — Monetización, push, metas, import CSV

---

El producto tiene una base sólida con diferenciadores reales (SmartInput, Saldo Vivo, contexto AR). Los gaps más urgentes no son de features sino de fundamentos: **testing, observabilidad, y conversión**. Resolvé esos primero y el producto se sostiene solo mientras escalás.
