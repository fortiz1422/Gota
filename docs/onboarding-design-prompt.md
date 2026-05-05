# Prompt de Diseño — Onboarding Gota (5 pantallas)

## Sobre el producto

**Gota** es una app de finanzas personales para el mercado argentino. Es mobile-first (PWA), con un solo developer.

**Problema que resuelve:** Los argentinos no tienen visibilidad real sobre su dinero. Las apps de finanzas son tediosas, no entienden la realidad argentina (multicuenta ARS/USD, tarjetas con cuotas, inflación) y se abandonan en 2 semanas.

**Propuesta de valor en una línea:** Registrá gastos en 5 segundos con lenguaje natural. Sabé exactamente cuánto podés gastar.

**Tres pilares:**
1. **Fricción = 0** — Un campo de texto + AI. Escribís "café 2500 con amigos" y queda registrado con categoría, fecha, todo.
2. **Valor inmediato** — Cada registro actualiza tu Saldo Vivo, tu ratio necesidad/deseo, y tus categorías top.
3. **Saldo Vivo = motor de confianza** — Tu balance real = ingresos - gastos - deuda de tarjeta pendiente. Si matchea tu banco, confiás y seguís usando.

**Tono de la marca:** Cercano, directo, argentino. No es una fintech corporativa ni una app de productivity hustle. Es una herramienta personal que habla como vos. Usa "vos/registrá/sabé" (voseo rioplatense).

---

## Identidad visual

### Logo
- **Wordmark** caligráfico/script en azul, con punto en la "a." — `gota.`
- No hay ícono separado, no hay forma de gota, no hay isotipo. El wordmark ES la marca.
- El archivo es `gota-wordmark.png` (896×1195px, ratio 3:4). El fondo del wordmark es #F0F4F8 (celeste muy pálido).

### Modo visual
- **Solo light mode** — tema "Fría" (paleta fría, azules desaturados).
- No existe dark mode.

### Paleta de colores

| Token | Valor | Uso |
|-------|-------|-----|
| `bg-primary` | `#FFFFFF` | Fondo principal |
| `bg-secondary` | `#F8FBFD` | Sheets, superficies suaves |
| `bg-tertiary` | `#EEF4F8` | Inputs, shells internos |
| `text-primary` | `#0D1829` | Texto principal |
| `text-secondary` | `#4A6070` | Texto secundario |
| `text-tertiary` | `#90A4B0` | Captions, subtexto |
| `text-disabled` | `#B8C9D4` | Texto deshabilitado |
| `primary` (accent) | `#2178A8` | CTAs, links, navegación, estados activos |
| `success` | `#1A7A42` | Ingresos, confirmaciones |
| `warning` | `#B84A12` | Alertas, categoría "Deseo" |
| `danger` | `#A61E1E` | Errores, alarmas reales |
| `separator` | `rgba(33,120,168,0.07)` | Líneas divisorias |
| `border-subtle` | `rgba(33,120,168,0.07)` | Bordes suaves |

**Soft variants** (para fondos de selección, pills activas):
- `primary/8` → `rgba(33,120,168,0.08)` — fondo de elemento seleccionado
- `primary/10` → `rgba(33,120,168,0.10)` — pills y badges activos
- `success/10` → `rgba(26,122,66,0.10)` — fondos de confirmación

### Tipografía

**Font:** DM Sans (Google Fonts), fallback Geist Sans.

| Escala | Size | Weight | Uso |
|--------|------|--------|-----|
| `type-label` | 11px | 700 | Etiquetas uppercase con tracking amplio |
| `type-meta` | 12px | 400 | Fechas, metadata |
| `type-body` | 15px | 500 | Body, inputs, filas |
| `type-title` | 22px | 800 | Títulos de sección |
| `type-hero` | 40px | 800 | Números hero |

Pesos habilitados: 400 / 500 / 700 / 800.

### Radios y sombras

| Token | Valor |
|-------|-------|
| `radius-card` | 16px |
| `radius-card-lg` | 22px |
| `radius-input` | 16px |
| `radius-button` | 12px |
| `radius-pill` | 9999px (full round) |

Sombras:
- `shadow-sm`: `0 1px 3px rgba(13,24,41,0.05)`
- `shadow-md`: `0 4px 12px rgba(13,24,41,0.08)`
- `shadow-lg`: `0 8px 24px rgba(13,24,41,0.10)`

### Iconografía
- **Phosphor Icons** — peso Light para UI general, Duotone para íconos decorativos/categoría.
- Contenedor circular de 32×32px con fondo semántico al 7% opacity.

---

## Componentes compartidos del onboarding

### Layout base
- `min-h-screen`, flex column
- Padding: `px-5`, `pt-safe` (safe area para notch), `pb-10`
- Fondo: `bg-primary` (#FFFFFF) o `bg-secondary` (#F8FBFD) según la pantalla

### Botón primario (CTA principal)
- Full width, `rounded-pill` (9999px), `py-4`
- Fondo `primary` (#2178A8), texto blanco, `font-semibold`, `text-sm`
- Estado disabled: `opacity-40`
- Feedback táctil: `active:scale-95` (press animation)
- Siempre fijado en la parte inferior de la pantalla

### Botón secundario/ghost
- Mismo ancho, sin fondo, texto `text-secondary`
- Para acciones como "Hacerlo después" o "Omitir"

### Input field
- `rounded-pill` (9999px), borde `border-border-ocean/30`, fondo `bg-secondary`
- Padding `px-4 py-3`
- Focus: borde transiciona a `primary/40`
- Placeholder: `text-dim`
- Label arriba: `10px`, uppercase, tracking widest, `text-tertiary`

### Selection pills
- `rounded-pill`, borde + padding `px-3 py-1.5` o `px-4 py-2`
- No seleccionado: `border-subtle`, `bg-secondary`, `text-secondary`
- Seleccionado: `border-primary`, `bg-primary/10`, `text-primary`, `font-medium`

### Selection cards (para opciones más grandes)
- `rounded-2xl` (16px), borde, padding `p-4`
- No seleccionado: `border-subtle`, `bg-secondary`
- Seleccionado: `border-primary`, `bg-primary/8`
- Título: `text-sm font-semibold`
- Subtítulo: `10px text-tertiary`

### Indicador de progreso
- Dots horizontales centrados, 1 por paso funcional (no incluye Welcome ni Done)
- Dot activo: más ancho (pill shape), color `primary`
- Dots inactivos: circulares pequeños, color `border-subtle`

### Back button
- Ícono Phosphor `CaretLeft`, tamaño 20, peso bold
- Color `text-secondary`, sin borde
- Posición: esquina superior izquierda, alineado con progress dots

### Transiciones entre pasos
- No hay transición animada entre pasos (corte directo)
- Las animaciones son internas a cada pantalla (aparición de elementos)

---

## Las 5 pantallas

---

### Pantalla 1: Welcome

**Objetivo:** Que el usuario entienda qué es Gota en 3 segundos y quiera empezar.

**Qué NO es:** No es un tutorial, no explica features, no pide datos.

**Layout:**
- Fondo `bg-secondary` (#F8FBFD) — consistente con el fondo del wordmark
- Sin header, sin back button, sin progress indicator
- Estructura vertical centrada:
  1. **Wordmark** — `gota-wordmark.png`, protagonista, centrado, tamaño generoso (ancho ~50-60% del viewport)
  2. **Tagline** — Una línea debajo del wordmark. Texto `text-secondary`, DM Sans regular, ~15px. Propuesta: "Tu plata, clara."
  3. **Screenshot del dashboard** (opcional) — Un screenshot real de la app mostrando el Home con Saldo Vivo y datos de ejemplo. Bordes redondeados (`radius-card-lg`), sombra `shadow-md`. Funciona como "preview" de lo que el usuario va a ver. Si se incluye, va debajo de la tagline con margen generoso.
  4. **CTA** — "Empezar" — botón primario pill, fijado abajo

**Comportamiento:**
- Es estática. Solo un botón.
- Analytics: dispara evento `onboarding_started`

**Lo que NO debe tener:**
- Mockups armados con HTML/divs simulando un dashboard
- Texto largo explicando features
- Múltiples CTAs o links

---

### Pantalla 2: Moneda

**Objetivo:** Saber si el usuario opera en pesos, dólares, o ambos.

**Dato que persiste:** `default_currency` → `PUT /api/user-config { default_currency }`

**Layout:**
- Fondo `bg-primary` (#FFFFFF)
- Header: Back button + Progress dots (dot 1 de 3 activo)
- Heading: "¿Con qué moneda operás?" — `text-2xl font-semibold text-primary`
- Subtext: "Podés cambiar esto cuando quieras." — `text-sm text-tertiary`
- **3 opciones como selection cards** (no 4, simplificamos):

| Opción | Label | Subtítulo | Valor guardado |
|--------|-------|-----------|----------------|
| 1 | 🇦🇷 Pesos argentinos | Solo ARS | `ARS` |
| 2 | 🇺🇸 Dólares | Solo USD | `USD` |
| 3 | 🔄 Ambas monedas | Registro en las dos, análisis en ARS | `ARS` |

- Cards en stack vertical (no grid), full width, con gap de 12px
- CTA: "Continuar" — disabled hasta que se seleccione una opción

**Comportamiento:**
- Seleccionar una card la marca visualmente (borde primary, fondo primary/8)
- Al tocar "Continuar", se persiste `default_currency` via API y avanza
- Si elige "Ambas", la pantalla de Saldo Inicial mostrará los dos campos. Si elige una sola moneda, solo el campo correspondiente.

---

### Pantalla 3: Cuenta

**Objetivo:** Crear la primera cuenta (banco, billetera digital, o efectivo).

**Dato que persiste:** `POST /api/accounts { name, type, is_primary: true }`

**Layout:**
- Fondo `bg-primary`
- Header: Back button + Progress dots (dot 2 de 3 activo)
- Heading: "¿Cuál es tu cuenta principal?" — `text-2xl font-semibold`
- Subtext: "Podés agregar más después en Configuración." — `text-sm text-tertiary`

**Inputs:**
1. **Nombre de la cuenta**
   - Label: "NOMBRE DE LA CUENTA" (type-label uppercase)
   - Input field pill con placeholder "Ej. Banco Nación"
   - Debajo: pills de atajos con nombres comunes — "Banco Nación", "BBVA", "Galicia", "Santander", "MercadoPago", "Efectivo"
   - Tocar un pill rellena el input y auto-selecciona el tipo correspondiente

2. **Tipo de cuenta**
   - Label: "TIPO" (type-label uppercase)
   - 3 pills horizontales: "Banco", "Digital", "Efectivo"
   - Selección simple (una activa a la vez)

- CTA: "Continuar" — disabled si el nombre está vacío
- Estado de loading: "Creando..." mientras se hace el POST

**Comportamiento:**
- Al seleccionar un pill de nombre (ej. "MercadoPago"), el tipo se auto-setea a "Digital"
- El usuario puede escribir un nombre custom y elegir tipo manualmente
- Error inline si el POST falla: "Error al crear la cuenta. Intenta de nuevo."

---

### Pantalla 4: Saldo Inicial

**Objetivo:** Registrar cuánto dinero tiene el usuario en la cuenta que acaba de crear.

**Dato que persiste:** `PATCH /api/accounts/{id} { opening_balance_ars, opening_balance_usd }`

**Layout:**
- Fondo `bg-primary`
- Header: Back button + Progress dots (dot 3 de 3 activo)
- Heading: "¿Cuánto hay en **{nombre_cuenta}** ahora?" — nombre en color `primary`
- Subtext: "No hace falta que sea exacto." — `text-sm text-tertiary`

**Inputs (condicional según moneda elegida en pantalla 2):**
- Si eligió **Solo ARS**: solo campo ARS
- Si eligió **Solo USD**: solo campo USD
- Si eligió **Ambas**: ambos campos (ARS primero, USD debajo)

Cada campo:
- Label uppercase (ej. "SALDO EN ARS")
- Input pill con prefix ("$" para ARS, "U$D" para USD)
- `inputMode="numeric"`, placeholder "0"

- CTA: "Continuar" — siempre habilitado (puede dejar en 0)
- No hay validación de monto mínimo

**Comportamiento:**
- Si el usuario deja los campos vacíos o en 0, se pasa `null` y la cuenta arranca en 0
- Si ingresa un valor, se hace PATCH al account creado en el paso anterior
- Error inline si falla

---

### Pantalla 5: Done

**Objetivo:** Confirmar que todo está listo y generar anticipación por empezar a usar la app.

**Dato que persiste:** `PUT /api/user-config { onboarding_completed: true }` — se ejecuta automáticamente al montar esta pantalla.

**Layout:**
- Fondo `bg-primary`
- Sin back button, sin progress dots
- Centrado vertical:
  1. **Ícono de confirmación** — Círculo grande (80×80px) con fondo `success/10`, checkmark SVG animado en `success`. Animación: `fadeScale` (0→1 opacity, 0.7→1 scale, 0.4s ease-out)
  2. **Heading:** "¡Listo!" — `text-2xl font-semibold`
  3. **Subtext:** "Tu Saldo Vivo está configurado." — `text-sm text-tertiary`
  4. **Checklist de lo configurado** — Items con "✓" verde:
     - `Cuenta "{nombre}" creada` (siempre)
     - `Saldo inicial registrado` (solo si puso un monto > 0)
  5. **Screenshot del dashboard** (opcional) — El mismo screenshot o uno mostrando el estado "listo para usar". Refuerza el destino.

- CTA: "Ver mi Saldo Vivo" — botón primario
- El botón está disabled brevemente mientras se completa el PUT a la API

**Comportamiento:**
- Al montar: dispara `PUT /api/user-config { onboarding_completed: true }` + evento analytics `onboarding_completed`
- Al tocar CTA: navega al dashboard (`/`). El tour de bienvenida se disparará automáticamente ahí (ya implementado, 800ms de delay).

---

## Consideraciones generales

### Mobile-first
- Viewport target: 375px de ancho (iPhone SE/mini). Todo debe verse bien ahí.
- Usar `pt-safe` para respetar el notch.
- Los botones CTA deben tener `padding-bottom: env(safe-area-inset-bottom)` para no quedar debajo del home indicator.

### Lo que sigue al onboarding
Al completar la pantalla Done y llegar al dashboard, se dispara un **tour guiado** de 4 pasos (ya implementado) que explica:
1. SmartInput — "Escribí como hablás"
2. Saldo Vivo — "Tu balance real del mes"
3. Tab Movimientos — "Gastos organizados por fecha"
4. Tab Análisis — "Patrones y tendencias"

Esto significa que el onboarding NO necesita explicar features. Su único trabajo es: **configurar la cuenta y generar ganas de empezar**.

### Screenshots de la app
Si se usan screenshots (en Welcome y/o Done), deben ser:
- Screenshots reales del dashboard con datos de ejemplo, no mockups HTML
- Enmarcados con `border-radius: 22px`, sombra `shadow-md`
- Datos de ejemplo creíbles para Argentina (montos en pesos razonables, categorías como "Supermercado", "Café", "Nafta")
- El screenshot debe mostrar un dashboard con datos — la promesa de "así se ve cuando lo usás"

### Qué NO debe tener este onboarding
- Steps informativos sin acción (no explicar Saldo Vivo, no mostrar testimonios)
- Preguntas de engagement tipo "¿cuál es tu objetivo?" — eso es para apps de suscripción masiva, no para Gota
- Paywall (no hay modelo de pago todavía)
- Demo del SmartInput (eso lo cubre el tour)
- Más de 5 pantallas

---

## Resumen de flujo de datos

```
Welcome → (sin datos)
   ↓
Moneda → PUT /api/user-config { default_currency: 'ARS' | 'USD' }
   ↓
Cuenta → POST /api/accounts { name, type, is_primary: true } → devuelve account.id
   ↓
Saldo → PATCH /api/accounts/{id} { opening_balance_ars, opening_balance_usd }
   ↓
Done → PUT /api/user-config { onboarding_completed: true }
   ↓
→ Redirect a "/" (dashboard) → Tour se dispara automáticamente
```
