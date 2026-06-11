# Gota — Onboarding revamp: nota de handoff

**Fecha:** 2026-06-11
**Prototipo:** `.tmp_fable/onboarding-revamp/index.html` (abrir directo en el navegador; no requiere server)
**Dirección elegida:** Strong-fit — "El primer Saldo Vivo"

---

## 1. Archivos inspeccionados

Onboarding vivo (cableado en producción):

- `app/onboarding/page.tsx` — gate server-side (`onboarding_completed`)
- `app/onboarding/OnboardingFlow.tsx` — máquina de estados, usa `OnboardStep1-5`
- `app/onboarding/steps/OnboardStep1Welcome.tsx`
- `app/onboarding/steps/OnboardStep2Moneda.tsx`
- `app/onboarding/steps/OnboardStep3Cuenta.tsx`
- `app/onboarding/steps/OnboardStep4Saldo.tsx`
- `app/onboarding/steps/OnboardStep5Done.tsx`

Onboarding huérfano (existe pero NO está cableado en `OnboardingFlow.tsx`):

- `app/onboarding/steps/StepW1Welcome.tsx` … `StepW8Paywall.tsx` (wizard marketing)
- `app/onboarding/steps/Step1SaldoVivo.tsx` … `Step6Done.tsx` (setup viejo)
- `app/onboarding/components/WizardProgress.tsx`, `ProgressDots.tsx`, `BackButton.tsx`
  (solo los usan los steps huérfanos)

Sistema visual:

- `docs/design-system-final.md` (v4.0 + Strategy 5)
- `app/globals.css` (tokens y utilities reales)
- `components/ui/BlueHeaderZone.tsx`
- `components/dashboard/DashboardHeader.tsx`
- `components/dashboard/SaldoVivo.tsx` (variante `in-header` — referencia exacta del hero)

> **Hallazgo de higiene:** conviven tres generaciones de steps en `app/onboarding/steps/`.
> Al integrar esta propuesta, borrar `StepW*` y `Step1-6` (más `WizardProgress`,
> `ProgressDots`, `BackButton` si quedan sin consumidores).

---

## 2. Concepto

El onboarding actual pide datos (moneda → cuenta → saldo) sin haber establecido
**qué compra el usuario con esos datos**. La pantalla final dice "Tu Saldo Vivo ya
está activo" pero nunca explicó qué es. Y visualmente vive en un mundo
(blanco + CTA negro) que no es el de la app (Strategy 5, blue header zone).

La propuesta reorganiza todo alrededor de una sola promesa:

> **Al final de estos 3 pasos vas a ver TU Saldo Vivo, armado con TUS números.**

- **S1 Bienvenida** muestra el resultado antes de pedir nada: el mismo hero azul
  del home con un Saldo Vivo de ejemplo (chip "Ejemplo" — honesto, sin fake data),
  y 3 filas que explican el modelo (saldo real / SmartInput / bimoneda).
- **S2–S4** son los mismos 3 inputs de hoy, pero cada pantalla dice qué desbloquea
  ese dato. En S4 un **preview en vivo** (`card-s5`) muestra el Saldo Vivo
  armándose mientras el usuario tipea.
- **S5 Armando** es una transición corta que repite los datos *reales* del usuario
  con checks (es el momento en que se persiste config).
- **S6 Listo** ES el hero del home: mismo blue-zone, mismo `type-hero`, mismo
  breakdown ARS|USD. El CTA "Ir a mi Saldo Vivo" entrega al usuario a una pantalla
  que ya conoce. Onboarding y producto quedan visualmente continuos.

---

## 3. Estructura sugerida de componentes (Next.js + Tailwind)

```
app/onboarding/
├── OnboardingFlow.tsx          # máquina de estados (se mantiene, cambia el orden)
├── components/
│   ├── StepHeader.tsx          # blue-zone slim: back (header-glass) + "Paso N de 3" + 3 segmentos
│   ├── OptionCard.tsx          # radio-card (S2 moneda y panel viz)
│   ├── AmountInput.tsx         # input subrayado con prefijo + formateo es-AR en vivo
│   ├── PrimaryCta.tsx          # pill primary + estados disabled/loading
│   └── LiveSaldoPreview.tsx    # card-s5 con el saldo armándose (S4)
└── steps/
    ├── StepWelcome.tsx         # S1 — hero ejemplo + modelo en 3 filas
    ├── StepMoneda.tsx          # S2 — paso 1/3
    ├── StepCuenta.tsx          # S3 — paso 2/3 (chips + tipo)
    ├── StepSaldo.tsx           # S4 — paso 3/3 (montos + LiveSaldoPreview)
    ├── StepArmando.tsx         # S5 — transición; persiste onboarding_completed
    └── StepListo.tsx           # S6 — hero real + teaser SmartInput
```

`StepHeader`, `OptionCard`, `AmountInput` y `PrimaryCta` reemplazan los tres
`OnboardNav` duplicados inline que hay hoy en los steps 2-4.

### Estados por componente

| Componente | Estados |
|---|---|
| `StepHeader` | paso activo (segmento blanco), pasos hechos (blanco 62%), pendientes (blanco 28%) |
| `OptionCard` | default / hover / selected (borde primary + ring 3px primary 8% + badge tint) |
| `OptionCard` (panel viz) | colapsado (max-height 0) / expandido — solo cuando moneda = "Las dos" |
| `AmountInput` | vacío (placeholder disabled-color) / con valor (formateo en vivo) / focus (border primary) |
| `PrimaryCta` | enabled / disabled (opacity .35) / loading ("Creando…") / retry ("Reintentar") |
| `LiveSaldoPreview` | inactivo (opacity .55, "$ 0") / activo (opacity 1, monto en primary) / bimoneda (línea secundaria) |
| `StepCuenta` error | banner `danger-soft` + CTA pasa a "Reintentar"; el input conserva lo tipeado |
| `StepListo` | con saldo (hero + breakdown) / sin saldo (hero $ 0 + nota "pendiente" hacia Config → Cuentas) |

---

## 4. Decisiones de jerarquía

1. **El número siempre manda.** En S1 y S6 el elemento más grande de la pantalla
   es el Saldo Vivo (`type-hero`, 40px), no el headline de marketing.
2. **Una pregunta por pantalla**, en `type-question` (26px/800) — extensión
   propuesta de la escala (entre `type-title` 22 y `type-hero` 40). Si no se quiere
   agregar utility, mapear a `type-title` con override de tamaño en el step.
3. **El subtítulo de cada paso explica qué desbloquea el dato**, no repite la
   pregunta ("Es el punto de partida de tu Saldo Vivo…").
4. **Labels de campo** en `type-label`-style (11px/700/uppercase/tracking),
   `text-tertiary` — idéntico al patrón del app.
5. **Progreso como 3 segmentos** en el header azul (no dots ni barra %):
   comunica "sos parte de un proceso corto y finito".
6. **CTA semántico**: "Armar mi Saldo Vivo", "Crear cuenta", "Ir a mi Saldo Vivo" —
   nunca "Empezar"/"Continuar" genérico salvo pasos intermedios.

## 5. Reglas de spacing / density

- Padding horizontal de contenido: **24px** (26px en bloques de pregunta, igual que hoy).
- Header de paso: 18/20px de padding, alto efectivo ~74px + safe-area.
- Gap entre option-cards: **9px**; padding interno 17/18px.
- Bloque pregunta → primer control: **22-26px**.
- Overlap blue-zone → contenido blanco: **−24px fijo** (regla S5, no tocar).
- CTA zone: `16px 24px 28px` + `pb-safe-cta` en la app real.
- Radios: cards de opción 18px (card-s5), inputs subrayados sin radius,
  CTA `radius-pill` (se conserva la identidad pill del onboarding actual,
  pero en `primary`, no en negro — ver riesgos).

## 6. Comportamiento responsive

- El prototipo desktop muestra un frame de 390×844 centrado (solo para review).
  Bajo 560px el frame desaparece y ocupa `100dvh` — ese es el comportamiento real.
- En la app: `min-h-app` + `pt-safe-top` en el header azul + `pb-safe-cta` en el CTA,
  como ya hace el onboarding actual.
- S2 con panel expandido y S3 con teclado abierto son las pantallas más altas:
  el `.screen` scrollea internamente y el CTA queda al final del flujo de contenido
  (no fixed), igual que hoy.
- El preview en vivo de S4 usa `margin-top: auto` — con teclado abierto queda
  visible justo encima del CTA en viewports ≥ 700px de alto; en viewports menores
  scrollea. Verificar en device real con keyboard inset (`dvh`).

## 7. Core vs accesorio

**Core (no recortar):**
- S1 con hero de ejemplo + chip "Ejemplo" (la promesa)
- StepHeader azul con segmentos (continuidad S5 + momentum)
- Preview en vivo en S4 (el dato se vuelve resultado en tiempo real)
- S6 como espejo exacto del hero del home (el handoff)
- Formateo es-AR en vivo en los montos

**Accesorio (recortable sin romper el concepto):**
- S5 "Armando" (puede ser un estado de loading del CTA de S4 si se quiere acortar)
- Animación del caret en el teaser SmartInput
- Stagger de las filas en S5
- Nota de tipo de cambio en S2 (podría vivir solo en el panel expandido)

## 8. Riesgos y decisiones de implementación

1. **CTA negro → primary.** El onboarding actual usa fondo `--color-text-primary`
   (negro azulado). El sistema dice "primary para interacción"; el prototipo usa
   primary pill. Es un cambio de identidad del flujo: validar con una pasada visual
   en device antes de fijarlo.
2. **Conversión bimoneda sin fake math.** Ni el preview de S4 ni el hero de S6
   inventan tipo de cambio: muestran el monto de la moneda principal + la línea
   secundaria "+ US$ X · el total combinado usa el oficial del día". En la app real,
   S6 puede usar `valuationRate` (como `SaldoVivo.tsx`) si está disponible en ese
   momento; si no, mantener este fallback.
3. **Persistencia.** Mantener el contrato actual: `PUT /api/user-config`
   (default_currency, hero_balance_mode) en S2, `POST /api/accounts` en S3,
   `PATCH /api/accounts/:id` en S4, `onboarding_completed: true` en S5/S6.
   S5 "Armando" es el lugar natural para el `onboarding_completed` (hoy está en Done).
4. **Error handling.** El prototipo muestra el patrón: banner `danger-soft` con
   copy que baja ansiedad ("tus datos quedan guardados acá") + CTA "Reintentar".
   Aplicar igual en S2 (hoy el PUT falla silenciosamente "best effort" — aceptable)
   y S4.
5. **`type=number` → `inputMode=numeric` + formateo.** Los inputs actuales usan
   `type="number"` con parseFloat crudo; el prototipo formatea miles es-AR en vivo
   sobre `type="text" inputmode="numeric"`. Decisión pendiente: soporte de decimales
   (el prototipo acepta solo enteros; para saldo inicial alcanza, confirmar).
6. **Analytics.** Conservar `onboarding_started`, `first_account_created`,
   `onboarding_completed`; oportunidad de agregar `onboarding_saldo_skipped`.
7. **Blue-zone + teclado iOS.** El header azul es slim en S2-S4 justamente para
   que el teclado no lo coma. Verificar que `border-bottom-radius 28px` no genere
   repaint feo al hacer scroll con teclado abierto en Safari.

## 9. Qué tocar para integrarlo en `app/onboarding`

1. Crear los componentes compartidos (`StepHeader`, `OptionCard`, `AmountInput`,
   `PrimaryCta`, `LiveSaldoPreview`) portando el CSS del prototipo a Tailwind
   (todos los valores ya son tokens de `globals.css`; `blue-zone`, `header-glass`,
   `card-s5`, `surface-glass` ya existen como utilities).
2. Reescribir `OnboardStep1Welcome` → `StepWelcome` (hero ejemplo + modelo),
   y migrar Step2-4 al nuevo layout (header azul + pregunta + job copy).
   La lógica de estado/fetch de cada paso se conserva casi 1:1.
3. Agregar `StepArmando` (persiste `onboarding_completed`, muestra los datos
   reales, `setTimeout` → Listo) y reescribir `OnboardStep5Done` → `StepListo`
   reutilizando la estética del `SaldoVivo` variante `in-header`.
4. Decidir si `type-question` entra como utility en `globals.css` o se resuelve
   inline en los steps.
5. Borrar los steps huérfanos (`StepW1-8`, `Step1-6`) y sus componentes sin uso.
6. QA: recorrido completo en device (iPhone con notch), las 3 ramas de moneda,
   skip de saldo, error de red en S3, y back desde cada paso.

## 10. Screenshots

Exportadas automáticamente (Chrome headless, viewport 390×844 @2x, modo `?clean`):

| Archivo | Pantalla / estado |
|---|---|
| `screenshots/01-bienvenida.png` | S1 — hero ejemplo + modelo |
| `screenshots/02-moneda.png` | S2 — "Las dos" seleccionada, panel viz expandido, "En pesos" |
| `screenshots/03-cuenta.png` | S3 — chip Mercado Pago aplicado, tipo Digital autoseleccionado |
| `screenshots/03b-cuenta-error.png` | S3 — error de red + Reintentar |
| `screenshots/04-saldo.png` | S4 — montos cargados, preview en vivo activo |
| `screenshots/05-armando.png` | S5 — transición con los datos reales |
| `screenshots/06-listo.png` | S6 — hero real bimoneda + teaser SmartInput |
| `screenshots/06b-listo-sin-saldo.png` | S6 — variante saldo salteado ($ 0 + nota a Config) |

Para recapturar a mano: abrir `index.html?clean`, devtools → device toolbar 390×844,
navegar con la dev bar (quitar `?clean`) o por consola con `window.__goto('listo')`.
La dev bar incluye toggle "Simular error de red" y el salto "6b Listo (sin saldo)".
