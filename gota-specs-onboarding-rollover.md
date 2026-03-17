# Gota — Especificaciones: Onboarding + Rollover

## Stack de referencia
- Next.js App Router + React + TypeScript + Tailwind v4
- Supabase (auth + DB)
- Gemini Flash (parser NLP)
- PWA mobile-first (~390px)
- Paleta Deep Ocean: fondo `#0B0F19`, cards `#111827`, acento `#38BDF8`, verde `#4ADE80`, naranja `#FB923C`, texto `#F9FAFB`, texto suave `#9CA3AF`
- Tipografía: Geist Sans
- Border radius: cards 16px, inputs 12px, botones pill (999px)
- Nav: floating pill bottom con 3 tabs (Home / Análisis / Config)

---

# FEATURE 1 — ONBOARDING

## Objetivo
Guiar al usuario nuevo desde registro hasta su primer gasto cargado. Al finalizar el onboarding el dashboard no está vacío: tiene saldo inicial configurado y al menos un gasto registrado.

## Trigger
Se activa una única vez: cuando el usuario completa el registro (auth) y aún no tiene ningún período mensual configurado en la DB. Una vez completado, nunca vuelve a mostrarse.

---

## Pantallas

### Pantalla O-1 — Bienvenida

**Layout:**
- Fondo `#0B0F19` full screen, sin nav bar
- Logo Gota centrado, tamaño mediano
- Debajo del logo, headline en dos líneas:
  ```
  Tus finanzas,
  de a gota.
  ```
  Font: `text-3xl font-light text-white`, centrado
- Subtítulo: `"Registrá tus gastos en segundos. Sin formularios."` — `text-sm text-[#9CA3AF]`, centrado
- Botón CTA al fondo: pill full-width, fondo `#38BDF8`, texto blanco `font-medium`: `"Empezar"`
- Sin skip, sin links adicionales

**Lógica:** tap en "Empezar" → navega a O-2

---

### Pantalla O-2 — Configuración inicial

**Layout:**
- Header: flecha back (← icono, color `#9CA3AF`) + texto `"Paso 1 de 2"` en `text-sm text-[#9CA3AF]`
- Headline: `"¿Cuánto tenés disponible este mes?"` — `text-2xl font-semibold text-white`
- Subtítulo: `"Podés ajustarlo después en cualquier momento."` — `text-sm text-[#9CA3AF]`

**Campos (2 únicamente):**

Campo 1 — Ingreso del mes
- Label: `"INGRESO DEL MES"` — `text-xs tracking-widest text-[#9CA3AF]`
- Input: pill, fondo `#111827`, borde `1px solid rgba(56,189,248,0.15)` idle / `rgba(56,189,248,0.4)` focus
- Prefix `$` en `text-[#9CA3AF]`
- Tipo numérico, teclado numérico en mobile
- Placeholder: `"0"`

Campo 2 — Saldo inicial (opcional)
- Label: `"SALDO INICIAL (opcional)"` — mismo estilo
- Subtexto debajo del label: `"Si ya tenés algo ahorrado este mes, sumalo acá."` — `text-xs text-[#9CA3AF]`
- Mismo estilo de input
- Placeholder: `"0"`

**Moneda:** ARS por defecto. Toggle ARS/USD en la parte superior derecha (mismo estilo que en Config actual).

**Botón CTA:** `"Continuar"` — pill full-width, `#38BDF8`. Habilitado solo si Ingreso > 0.

**Lógica:**
- Al confirmar: crea el registro en `monthly_income` de Supabase para el período actual (año/mes) con `ingreso_ars`, `saldo_inicial_ars`
- Navega a O-3

---

### Pantalla O-3 — Aha Moment (registro del primer gasto)

**Layout:**
- Sin header de pasos
- Headline centrado en la parte superior: `"Registrá tu último gasto."` — `text-2xl font-semibold text-white`
- Subtítulo: `"Escribilo como quieras."` — `text-sm text-[#9CA3AF]`
- Ejemplos en chips horizontales scrolleables (no tapeables, solo visuales):
  ```
  café 1500   |   almuerzo 4 lucas   |   uber 3k   |   despensa 15000
  ```
  Chips: fondo `rgba(56,189,248,0.08)`, borde `rgba(56,189,248,0.15)`, texto `#38BDF8`, `text-xs`, border-radius pill

**SmartInput** (el mismo componente que existe en el home, adaptado a pantalla completa):
- Posicionado en la zona media-baja de la pantalla
- Input pill, fondo `#111827`, borde `rgba(56,189,248,0.15)` idle / `rgba(56,189,248,0.4)` focus
- Placeholder: `"ej: café 1500"`
- Ícono send → `#38BDF8`
- Focus automático al entrar a la pantalla

**Parse Preview** (aparece debajo del input al tipear, igual que en el home):
- Card `#111827`, border-radius 16px, borde `rgba(56,189,248,0.1)`
- Muestra: categoría detectada (con ícono), monto, fecha
- Botón `"Confirmar"` — pill, fondo `#38BDF8`

**Lógica:**
- Al confirmar el gasto: llama al mismo endpoint de creación de gasto que usa el home
- El Saldo Vivo se actualiza con el ingreso configurado en O-2 menos este gasto
- Navega directamente al Home (sin pantalla de éxito adicional)
- Flag en DB/localStorage: `onboarding_completed: true`

---

## Transiciones
- Entre pantallas: slide horizontal hacia la izquierda (left-to-right navigation)
- Sin animaciones pesadas — la app no usa Framer Motion
- La transición al Home al finalizar puede ser un fade simple

---

## Qué NO incluir en el onboarding
- Configuración de tarjetas (va a Config después)
- Configuración de rollover (va a Config después)
- Categorías personalizadas
- Tutorial explicativo con múltiples pantallas
- Notificaciones push
- Pantalla de éxito/celebración al terminar

---

## Archivos a crear/modificar
- `app/onboarding/page.tsx` — contenedor con estado de paso actual
- `app/onboarding/components/StepBienvenida.tsx`
- `app/onboarding/components/StepConfiguracion.tsx`
- `app/onboarding/components/StepAhamoment.tsx`
- `middleware.ts` — redirect a `/onboarding` si usuario autenticado sin período configurado
- `app/config/page.tsx` — no se toca, onboarding escribe directo a las mismas tablas que Config usa

---

---

# FEATURE 2 — ROLLOVER

## Objetivo
Automatizar el traspaso de saldo entre períodos mensuales. El usuario no tiene que completar manualmente los campos de `Saldo inicial` cada mes nuevo.

---

## Configuración en Settings (Config)

**Dónde:** Dentro de la sección `INGRESOS MENSUALES` en `app/config/page.tsx`, encima del selector de mes.

**UI:**
- Row con label `"Rollover automático"` — `text-sm text-white`
- Subtexto: `"Tu saldo disponible al cierre se traslada al mes siguiente."` — `text-xs text-[#9CA3AF]`
- Toggle a la derecha: estado ON/OFF. ON → fondo `#38BDF8`. OFF → fondo `#374151`
- Guardado en DB en tabla `user_preferences`: campo `rollover_mode` con valores `"auto"` | `"manual"` | `"off"`
- Default para usuarios nuevos: `"manual"`

---

## Modo AUTO

**Trigger:** El sistema detecta que el usuario abrió la app en un nuevo período (mes/año distinto al último período activo) y `rollover_mode = "auto"`.

**Lógica de cálculo del saldo a trasladar:**
```
saldo_final_mes_anterior = saldo_inicial + ingresos - total_gastos_del_mes
```
Los gastos incluyen tanto gastos directos como pagos de tarjeta registrados.

**Acción automática:**
1. Crea el registro en `monthly_income` para el nuevo período
2. Setea `saldo_inicial_ars` = `saldo_final_mes_anterior`
3. `ingreso_ars` queda en 0 hasta que el usuario lo complete en Config (se muestra banner)
4. No muestra ningún modal ni interrupción — ocurre en background al cargar el home

**Banner en Home (no bloqueante):**
- Aparece debajo del número Disponible
- Fondo `rgba(56,189,248,0.08)`, borde `rgba(56,189,248,0.15)`, border-radius 12px
- Texto: `"Rollover aplicado: +$X del mes anterior."` — `text-xs text-[#38BDF8]`
- Ícono ✓ a la izquierda
- Se descarta con tap o desaparece solo después de 5 segundos
- Si el ingreso del mes aún no está cargado, agrega: `"Recordá cargar tu ingreso de abril."` con link a Config

---

## Modo MANUAL

**Trigger:** El usuario navega por primera vez al nuevo período (tocando la flecha de mes en Config o en el home) y `rollover_mode = "manual"`.

**UI — Modal de Cierre de Mes:**

Se presenta un bottom sheet (no pantalla completa) con la siguiente estructura:

Header: `"Cierre de [mes anterior]"` — `text-lg font-semibold text-white`

Resumen del mes cerrado (solo lectura, cards compactas):
```
SALDO FINAL           $XXX.XXX
INGRESOS              $XXX.XXX
TOTAL GASTADO         $XXX.XXX
  └ Gastos directos   $XXX.XXX
  └ Pagos de tarjeta  $XXX.XXX
```
Cada fila: label `text-xs text-[#9CA3AF]` / valor `text-sm text-white font-medium`

Separador `rgba(255,255,255,0.06)`

Acción:
- Label: `"¿Trasladamos el saldo final al nuevo mes?"` — `text-sm text-white`
- Valor destacado: `"$XXX.XXX"` — `text-2xl font-light text-[#38BDF8]`
- Tres botones apilados:
  1. `"Sí, trasladar $XXX.XXX"` — pill filled `#38BDF8`, texto blanco
  2. `"Editar monto"` — pill outlined borde `rgba(56,189,248,0.3)`, texto `#38BDF8`
  3. `"Empezar en cero"` — texto plano `text-sm text-[#9CA3AF]`, sin borde

**Opción "Editar monto":**
- Expande un input inline (no nueva pantalla) con el monto pre-cargado
- Botón `"Confirmar"` activo al editar
- No modifica los datos del mes anterior, solo setea el `saldo_inicial` del mes nuevo

**Opción "Empezar en cero":**
- Confirma con un alert inline: `"¿Seguro? El saldo de [mes anterior] no se trasladará."` — dos opciones: `"Sí, empezar en cero"` / `"Cancelar"`
- Si confirma: crea el período nuevo con `saldo_inicial = 0`

**Lógica de cierre:**
- El modal solo aparece una vez por período
- Una vez que el usuario toma una acción (cualquiera), el período anterior queda en estado `closed: true` en DB
- Los períodos cerrados se pueden navegar y ver en modo lectura pero los campos `ingreso` y `saldo_inicial` se muestran deshabilitados con un badge `"CERRADO"` — `text-xs bg-[#1F2937] text-[#9CA3AF]`

---

## Modo OFF

- Sin banner, sin modal, sin acción automática
- Cada mes empieza con los campos vacíos como hoy
- Útil para usuarios que prefieren control total manual

---

## Estado de período cerrado en Config

Cuando un período está cerrado (`closed: true`):
- El selector de mes muestra el mes con un ícono de candado `🔒` pequeño en gris
- Los campos `Ingreso ARS`, `Ingreso USD`, `Saldo inicial ARS`, `Saldo inicial USD` tienen `opacity-50` y `pointer-events-none`
- Badge `"CERRADO"` arriba de los campos — fondo `#1F2937`, texto `#9CA3AF`, `text-xs`, border-radius 6px
- Los meses futuros sin datos muestran los campos normales y editables

---

## Tabla DB sugerida — `user_preferences`
```sql
user_id         uuid (FK auth.users)
rollover_mode   text CHECK (rollover_mode IN ('auto', 'manual', 'off')) DEFAULT 'manual'
created_at      timestamptz
updated_at      timestamptz
```

## Campo adicional en `monthly_income`
```sql
closed          boolean DEFAULT false
closed_at       timestamptz
```

---

## Archivos a crear/modificar
- `app/config/page.tsx` — agregar toggle rollover + lógica de período cerrado
- `app/config/components/RolloverToggle.tsx` — componente del toggle con descripción
- `app/config/components/CierreMesModal.tsx` — bottom sheet modal de cierre manual
- `lib/rollover.ts` — función `calcularSaldoFinal(periodo)` + `ejecutarRollover(modo, periodo)`
- `app/home/page.tsx` — detectar nuevo período al montar + ejecutar rollover si corresponde + mostrar banner
- `supabase/migrations/` — agregar campo `closed` a `monthly_income` + crear tabla `user_preferences`

---

## Orden de implementación recomendado
1. Migration de DB (closed + user_preferences)
2. `lib/rollover.ts` con la lógica de cálculo
3. Toggle en Config + guardado en DB
4. Modo AUTO: detección en home + banner
5. Modo MANUAL: CierreMesModal
6. Estado cerrado en Config (candado + campos deshabilitados)
