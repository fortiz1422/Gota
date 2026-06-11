# DNU PARA UI VIGENTE - HISTORICO - Gota Mobile UI Exploration

> Exploracion previa al cierre de Strategy 5 / Blue Header Zone. No usar como fuente visual vigente.
**Fecha:** 2026-05-25  
**Etapa:** Exploración + Refinement (input para Claude Design)  
**Alcance:** Home + TabBar — solo capa visual, sin tocar lógica

---

## 1. Diagnóstico del estado actual

### Home — estructura actual

```
pt-safe
├── HEADER ROW (px-4, pt-5)
│   ├── Avatar circular [izquierda] → abre CuentaSheet
│   └── HomePlusButton [derecha] → abre modal de acciones
│
├── PendingSharedReceiptBanner (condicional)
│
├── SaldoVivo (sin card, directo sobre fondo)
│   ├── Label "Saldo Vivo" + eye toggle
│   ├── Hero number (type-hero 40px/800)
│   ├── ARS | USD breakdown (type-meta)
│   └── "Disponible real" row (border-t separator + icon 44px + monto)
│
├── CommitmentsSummary (condicional, border-t separator)
│   ├── Icon circle + label + monto total
│   └── Progress bar + leyenda A pagar / En curso
│
├── RecurringIncomeBanner (condicional)
├── InstrumentosCard (FF_INSTRUMENTS flag)
├── SubscriptionReviewBanner (condicional)
│
└── Ultimos5 (lista de movimientos recientes)
    └── → "Ver todos" → /movimientos

FIXED BOTTOM (BottomZone)
├── SmartInput (Gemini, expansible)
└── TabBar integrado (solo en Home, cuando SmartInput está cerrado)
```

### TabBar — comportamiento actual

- **En Home (`/`):** integrado dentro de `BottomZone`, después de SmartInput.
- **En otras rutas:** `fixed bottom-0` con `backdrop-filter: blur(16px)` y `border-t`.
- **Active state:** icono `weight="bold"` + texto `text-primary`. Sin pill, sin indicator.
- **3 tabs:** Home, Movimientos, Análisis.
- **Labels:** siempre visibles, 12px, `whitespace-nowrap`.

---

## 2. Problemas identificados

### Jerarquía visual

| # | Problema | Impacto |
|---|----------|---------|
| P1 | **Hero sin framing**: el número principal (SaldoVivo) flota sobre blanco sin ningún contenedor visual. La métrica más importante no tiene peso visual. | Alto |
| P2 | **Mismo peso visual en todas las secciones**: CommitmentsSummary, Ultimos5 y banners opcionales están todos al mismo "nivel" visual, solo separados por `border-t`. | Alto |
| P3 | **Sin contexto de mes en Home**: `DashboardHeader` no está integrado en `DashboardShell`. El usuario no sabe en qué mes está sin scrollear. | Medio |
| P4 | **BottomZone opaca el propósito del SmartInput**: en estado colapsado, el SmartInput no comunica claramente que es un campo de entrada. Parece un área gris de navegación. | Medio |
| P5 | **Active state de TabBar demasiado minimal**: solo cambio de color y peso de fuente. No hay indicador geométrico (pill, underline, top bar). | Medio |
| P6 | **Inconsistencia visual Home vs. otras rutas**: en Home el TabBar está "dentro" del contenido; en otras rutas está "fuera" como fixed nav. Este cambio puede producir sensación de salto. | Bajo |

### Percepción nativa

- El layout es correcto para web: columna full-width, `max-w-md`, padding horizontal uniforme.  
- Para una PWA que debe sentirse **app nativa**, falta: jerarquía de superficies (elevation), identificación de zonas (header / content / toolbar), y micro-pattern de activación de tabs.
- El Hero necesita "contener" su contenido. En apps nativas premium (Nubank, Revolut, N26) el saldo siempre vive dentro de una superficie diferenciada.

### Densidad

- Con datos normales (SaldoVivo + Compromisos + Ultimos5), el scroll empieza después del hero. Bien.
- Cuando hay banners opcionales acumulados (RecurringIncome + Subscriptions + Instruments), el Home puede verse muy cargado. No hay prioridad visual entre ellos.

---

## 3. Propuestas de dirección visual

> Los artefactos visuales están en `/components/_exploration/` y en la ruta `/ui-exploration` (solo dev).

---

### Variante A — Fintech Calma / Premium

**Postura:** "Respirá. El número es lo único que importa ahora."

#### Layout
```
Header: Avatar | Mes pill (center) | Plus
Hero card: rounded-22, gradiente sutil azul (surface-glass-lite)
  └── Label · Hero number · Pills ARS/USD · divider
      └── Disponible + Compromisos en fila dentro del mismo card
           └── Progress bar 4px (warning + primary)
Sección "Últimos movimientos" (label uppercase + "Ver todos")
Lista de movimientos (comfortable density, 11px+ row height)

Bottom:
  SmartInput (glass pill, prominente, con icono ✦ Gemini)
  TabBar (pills rellenas en activo, como iOS)
```

#### Jerarquía
1. Hero card (nivel 1) — toda la info financiera del mes
2. Lista de movimientos (nivel 2) — actividad
3. BottomZone (toolbar) — acción + navegación

#### TabBar
- Pill background (`primarySoft`) alrededor del item activo.
- Labels visibles, 11px.
- Altura efectiva ~52px de touch area.

#### Acciones rápidas
- Plus en el header (igual que ahora).
- SmartInput como entry point principal para gastos.

#### Hero
- Card con `border-radius: 22px`, gradiente `rgba(33,120,168,0.07) → rgba(27,126,158,0.04)`, `border: 1px solid rgba(33,120,168,0.10)`.
- Disponible Real y Compromisos colapsados dentro del mismo card (no como elementos separados).
- Ahorra ~40px de altura vertical, simplifica el scroll.

#### Densidad
Baja-media. Una zona principal muy dominante, todo lo demás subordinado.

#### Pros
- Más premium, más "app bancaria de confianza".
- Hero unificado reduce scroll para ver el estado completo.
- El contexto financiero (disponible + compromisos) está siempre visible sin scroll.

#### Contras
- La card puede sentirse "grande" en iPhones SE o pantallas <375px.
- Menos datos a primera vista puede frustrar usuarios power.
- El pill de tab activo puede entrar en conflicto visual con el SmartInput si no se calibra bien la altura del BottomZone.

---

### Variante B — Nativa Operativa / Densa

**Postura:** "Soy una herramienta. Dame todo sin que tenga que scrollear."

#### Layout
```
Header: Avatar | "Mayo 2026" (centered, bold) | Plus
Hero compacto: card bg-secondary, border, padding apretado
  └── Label + Hero (30px/800) + eye toggle
      └── Fila de 3 chips: Ingresos / Gastos / Tarjetas
Fila de 2 cards compactas: Disponible Real | Compromisos
Section label "Recientes"
Lista densa (rows de 9px vertical padding, texto 13px)
Bottom: SmartInput texto + "Agregar" button · TabBar con dot indicador
```

#### Jerarquía
1. Stats compactos (balance + métricas mes) — nivel 1
2. Disponible + Compromisos lado a lado — nivel 2
3. Lista densa — nivel 3

#### TabBar
- Sin fill/pill en activo.
- Dot de 4px sobre el icono activo (arriba).
- Sin cambio de fondo.

#### Acciones rápidas
- SmartInput colapsado como "barra de texto" con botón "+ Agregar" visible.
- El CTA es más explícito que en las otras variantes.

#### Hero
- Sin gradiente. Card plana `bg-secondary` con border sutil.
- Hero number más pequeño (30px vs 40px).
- Los chips de stats (Ingresos / Gastos / Tarjetas) reemplazan al ARS/USD breakdown para dar más contexto operativo.

#### Densidad
Alta. Más info visible sin scroll en pantallas de tamaño estándar.

#### Pros
- Power users ven más sin scroll.
- El SmartInput visible como barra es más claro en su función.
- Los stats (ingresos/gastos del mes) son más relevantes que el breakdown ARS/USD para usuarios operativos.

#### Contras
- Se pierde la elegancia del hero dominante.
- Los chips de stats requieren datos (si el mes está vacío, lucen pobres).
- Puede sentirse "aglomerado" con datos reales variados.
- Rompe el principio de diseño actual: "SaldoVivo y listas sobre fondo directo, menos stack de cards".

---

### Variante C — Híbrida Sobria con Foco en Acción ⭐ (Recomendada)

**Postura:** "El estado está claro. La acción está a mano."

#### Layout
```
Header: Avatar | "Mayo 2026" (text, no pill) | Plus
Hero card: bg-white, shadow-md (surface-module elevation)
  └── Label · Hero (38px/800) · ARS|USD inline
      └── border-t · Disponible Real row (icon + texto + monto ›)
Compromisos: barra anclada debajo del card, bg-secondary (patrón "extensión" del card)
Section label "Últimos movimientos"
Lista (comfortable density)

Bottom:
  SmartInput (glass pill, ✦ icono Gemini)
  TabBar con top-bar indicator (2px, 28px width sobre activo)
```

#### Jerarquía
1. Hero card elevado (shadow) + compromisos colgante — zona financiera
2. Lista de movimientos — zona de actividad
3. BottomZone (glass) — zona de acción + navegación

#### TabBar
- Thin top bar (2px, 28px) sobre el icono del tab activo.
- Patrón tomado de iOS nativo (tab bar indicator en aplicaciones como Wallet).
- Labels visibles, 11px.
- Sin pill fill en activo: más sobrio.

#### Acciones rápidas
- Plus en header (igual que ahora).
- SmartInput como glass pill: reconocible, con icono ✦ Gemini visible.

#### Hero
- `shadow-md` (`0 4px 12px rgba(13,24,41,0.08)`) sobre white: elevation sin color.
- Compromisos se "cuelga" visualmente del card con `border-radius: 0 0 12px 12px` y `bg-secondary`.
- Menos padding que Variante A pero más respiración que Variante B.

#### Densidad
Media. Equilibrio entre información y legibilidad.

#### Pros
- El elevation del hero card es el movimiento más impactante y requiere el cambio más mínimo.
- El top-bar de tab activo es el indicador más nativo sin tocar la estructura actual.
- Los compromisos "colgados" del card es un truco visual que unifica la zona financiera sin rediseñar components.
- Mantiene el principio del design system: `surface-module` para el hero.
- El SmartInput ya usa `surface-glass`, que en colapsado con el ✦ Gemini sería reconocible.

#### Contras
- El contexto del mes requiere un cambio pequeño (agregar el texto del mes en el header de `DashboardShell`).
- La "cola" de compromisos colgada del card es un patrón nuevo que hay que definir bien en tokens.

---

## 4. Recomendación final

### Dirección: Variante C (Híbrida Sobria) con elementos de Variante A

**Por qué C:**

1. **Costo de implementación bajo.** El cambio principal es agregar `box-shadow: var(--shadow-md)` al contenedor de SaldoVivo. El resto son ajustes de tokens, no refactors.

2. **Respeta el design system vigente.** `surface-module` ya existe como token. Solo hay que aplicarlo donde más importa: el hero.

3. **TabBar top-bar indicator es el cambio más nativo con menor riesgo.** No toca el HTML ni la lógica, solo CSS. El `border-top: 2px solid var(--color-primary)` sobre el item activo ya es suficiente.

4. **La "cola" de compromisos unifica la zona financiera** sin crear un nuevo componente. Es solo un reajuste del border-radius y background de `CommitmentsSummary`.

5. **Preserva el patrón BottomZone + SmartInput integrado**, que es el diferencial más inteligente de la app. Solo refina la presentación.

**Tomado de A:**
- Agregar el mes al header de DashboardShell (texto simple, no pill).
- El SmartInput con icono ✦ visible (ya tiene espacio para un placeholder más visible).

**Desechar de B:**
- Los chips de Ingresos/Gastos/Tarjetas son un cambio de modelo de datos en el hero, no solo visual. Fuera del scope.

---

## 5. Brief para Claude Design

### Título
**Gota Mobile — Shell refinement v1**

### Objetivo
Hacer que el Home se sienta app nativa premium sin cambiar la estructura de componentes ni la lógica.

### Cambios concretos a diseñar

#### 1. Hero card con elevation
- Envolver el contenido de `SaldoVivo` (y su componente adjunto `CommitmentsSummary`) en una superficie elevada.
- Token: `surface-module` (`background: #FFFFFF; box-shadow: 0 4px 12px rgba(13,24,41,0.08)`)
- Radius: `radius-card-lg` (22px)
- Padding: 20px horizontal, 18px vertical
- El `CommitmentsSummary` se convierte en la "sección inferior" del mismo card: background `bg-secondary`, radius `0 0 22px 22px`, separado del cuerpo por `border-t: separator`.

#### 2. Header con contexto de mes
- Agregar el mes actual como texto centrado en el header de `DashboardShell`.
- Texto: 14px / 600 / `text-secondary`
- No requiere month selector aquí (ya está en DashboardHeader en otras rutas)

#### 3. TabBar active indicator
- Reemplazar el bold weight + color por: `border-top: 2px solid var(--color-primary)` sobre el item activo.
- O pill background `primarySoft` (Variante A) — decidir con el diseñador.
- Altura de touch area: mínimo 44px.

#### 4. SmartInput: placeholder más visible
- Placeholder: `"¿Qué gastaste?"` (más conversacional que el actual, si es que está vacío)
- Icono ✦ o similar como indicador Gemini en el lado derecho (ya hay espacio)

#### 5. Zona de movimientos: section header
- Agregar label `"Últimos movimientos"` + link `"Ver todos →"` antes de `Ultimos5`
- Clarifica la zona de actividad vs. la zona financiera del hero

### Tokens de referencia
- `surface-module`: `background: #FFFFFF; box-shadow: 0 4px 12px rgba(13,24,41,0.08)`
- `shadow-md`: `0 4px 12px rgba(13,24,41,0.08)`
- `separator`: `rgba(33,120,168,0.07)`
- `primary`: `#2178A8`
- `primarySoft`: `rgba(33,120,168,0.09)`
- `radius-card-lg`: `22px`

### Lo que NO cambiar
- Lógica de datos (queries, cálculos, APIs)
- Estructura de componentes (no fusionar SaldoVivo y CommitmentsSummary en código)
- Flujo de SmartInput (funciona bien)
- 3 tabs (correctos)
- BottomZone integrada en Home (patrón inteligente, mantener)
- Tokens de color existentes

---

## 6. Artefactos de exploración

- **Mockups:** `/ui-exploration` (ruta dev, throwaway)
- **Componentes:** `components/_exploration/` (throwaway, no importar en producción)
- **Este documento:** `docs/mobile-ui-exploration-2026-05.md`

---

## 7. Decisiones tomadas en esta etapa

| Decisión | Razonamiento |
|----------|-------------|
| Mantener 3 tabs | Correcto. Más tabs fragmentaría la app. |
| Mantener BottomZone integrada en Home | Diferenciador inteligente. No tocar. |
| Hero con elevation, no con color | Colores ya están en uso semántico. Elevation es el lever correcto. |
| Top-bar indicator en TabBar | Patrón más nativo que pill fill. Menor riesgo visual. |
| No mover `+` al centro del TabBar | El patrón de FAB central rompe la consistencia con otras rutas. |
| No agregar stats de mes en hero | Requiere datos nuevos. Fuera del scope visual. |

---

## 8. Dudas abiertas para resolver con diseñador

1. **TabBar active state:** ¿top-bar indicator (C) o pill background (A)? Ambos son válidos, pero no mezclar.
2. **CommitmentsSummary como "cola" del hero card:** ¿siempre visible aunque sean $0? ¿O se colapsa? Actualmente aparece solo si hay compromisos.
3. **Contexto de mes en Home:** ¿texto plano en header o pill tappable? Si es tappable, ¿qué hace? (Actualmente la navegación de mes vive en otras rutas.)
4. **SmartInput collapsed state:** ¿El placeholder `"¿Qué gastaste?"` es suficiente CTA? ¿O necesita un label tipo `"SMART INPUT"` / `"IA"` visible?
5. **Banners opcionales** (RecurringIncome, Subscriptions): cuando hay 2+ banners visibles, el Home se fragmenta. ¿Consolidar en un único "Alerts/Pendiente" card?
6. **Dark mode:** ¿Es un objetivo para esta etapa? El design system es light-only. Si se va a explorar dark en el futuro, los shadows de `surface-module` no funcionan igual sobre fondos oscuros.

---

## 9. Recomendaciones para la siguiente etapa (Claude Design)

1. **Empezar por el hero card** — es el cambio de mayor impacto visual y menor riesgo técnico.
2. **Diseñar 2 estados del hero:** con compromisos visibles y sin compromisos, para validar el patrón "cola colgante".
3. **Definir el TabBar active state** (top-bar vs. pill) antes de tocar cualquier otra cosa. Una vez definido, aplica a las 3 rutas con TabBar.
4. **No diseñar el SmartInput** en esta etapa — está en producción y funciona. Solo ajustar el placeholder si el diseñador lo ve necesario.
5. **Hacer un mock del Home con banners acumulados** (2-3 banners opcionales visibles) para detectar si se necesita una estrategia de "alert stack" unificada.
6. **Prototipar en 375px** (iPhone SE 3 / iPhone 14 estándar). El hero card no debe cortar en pantallas de < 390px de altura visible.
