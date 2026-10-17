# Gota - Design System

**Version:** 4.0 - Light Mode "Fria vNext"  
**Status:** SOURCE OF TRUTH visual vigente

---

## Uso obligatorio

Este documento es la fuente de verdad visual para Gota junto con `app/globals.css`.

Orden de autoridad para decisiones visuales:
1. Codigo real en `app/` y `components/`
2. Tokens/utilities en `app/globals.css`
3. Este documento
4. Docs de producto/copy, solo si no contradicen el sistema visual

No usar docs historicos de diseno para definir UI nueva. Si un documento esta marcado como DNU, puede servir como contexto historico, pero no como input visual vigente.

Referencias reales para el patron actual:
- `components/ui/BlueHeaderZone.tsx`
- `components/dashboard/DashboardShell.tsx`
- `components/movimientos/MovimientosClient.tsx`
- `components/analytics/AnalyticsClient.tsx`
- `components/dashboard/SaldoVivo.tsx`
- `components/dashboard/DashboardHeader.tsx`

---

## Principios

- Light mode only.
- Fondo blanco y jerarquia de superficies mas estricta.
- `accent` para interaccion y navegacion.
- Listas y heroes sobre fondo directo; menos cards genericas.
- Solo Phosphor Icons, peso Light.

---

## Tokens

Fuente de verdad de tokens:
- CSS: `app/globals.css`

### Fondos y superficies

| Token | Valor | Uso |
|---|---|---|
| `bg-primary` | `#FFFFFF` | Fondo principal |
| `bg-secondary` | `#F8FBFD` | Sheets y superficies suaves |
| `bg-tertiary` | `#EEF4F8` | Inputs y shells internos |
| `surface-glass` | `rgba(190,225,248,0.28)` + `blur(24px)` + borde `rgba(255,255,255,0.90)` | SmartInput y elementos glass prioritarios |
| `surface-glass-neutral` | `rgba(255,255,255,0.72)` + `blur(24px)` + borde `rgba(255,255,255,0.90)` | Cards traslucidas neutras, como Insights |
| `surface-module` | `#FFFFFF` + `0 1px 6px rgba(0,0,0,0.07)` | Modulos elevados, como metricas de Movimientos |
| `separator` | `rgba(33,120,168,0.07)` | Separadores internos |

### Texto y color

| Token | Valor | Uso |
|---|---|---|
| `text-primary` | `#0D1829` | Texto principal, montos de egreso |
| `text-secondary` | `#4A6070` | Texto secundario |
| `text-tertiary` / `text-dim` | `#90A4B0` | Captions, subtexto |
| `primary` | `#2178A8` | CTA, links, navegacion, estados activos |
| `success` | `#1A7A42` | Ingresos |
| `warning` | `#B84A12` | Deseo, alertas, percibidos |
| `danger` | `#A61E1E` | Error, alarmas reales |
| `data` | `#1B7E9E` | Transferencias y datos neutros |

### Reglas de color

- Egresos: `text-primary`
- Ingresos: `success`
- `danger` reservado para alarmas reales
- `primary` se usa en elementos interactivos o navegables

---

## Tipografia

**Font:** `DM Sans` con `Geist Sans` como fallback.

| Utility | Size | Weight | Uso |
|---|---|---|---|
| `type-label` | 11px | 700 | Etiquetas uppercase |
| `type-meta` | 12px | 400 | Fechas, metadata |
| `type-body` | 15px | 500 | Body, inputs, filas |
| `type-body-lg` | 16px | 700 | Body enfatizado |
| `type-title` | 22px | 800 | Titulos |
| `type-amount` | 22px | 800 | Montos secundarios |
| `type-hero` | 40px | 800 | Hero numbers |

Reglas:
- `caption/meta` usa `text-dim`
- `label` usa tracking amplio y uppercase
- Pesos habilitados: 400 / 500 / 700 / 800

---

## Radius y sombras

| Token | Valor |
|---|---|
| `radius-card` | 16px |
| `radius-card-lg` | 22px |
| `radius-input` | 16px |
| `radius-button` | 12px |
| `radius-pill` | 9999px |

Sombras vigentes:
- `shadow-module`: `0 1px 6px rgba(0,0,0,0.07)`
- `shadow-sm`: `0 1px 3px rgba(13,24,41,0.05)`
- `shadow-md`: `0 4px 12px rgba(13,24,41,0.08)`
- `shadow-lg`: `0 8px 24px rgba(13,24,41,0.10)`

---

## Superficies

### `surface-glass`

- Tinte azul leve
- Blur 24px
- Radio 16px
- Para `SmartInput` y elementos glass de mayor presencia

### `surface-glass-neutral`

- Traslucido neutro
- Blur 24px
- Radio 16px
- Para cards glass que no deben verse azules

### `surface-module`

- Blanco solido
- Sombra suave
- Para bloques de lectura y metricas

Fallback sin `backdrop-filter`:
- `surface-glass` -> `bg-tertiary`
- `surface-glass-neutral` -> `bg-secondary`

---

## Componentes clave

### TabBar

- Barra inferior plana
- Labels siempre visibles
- Sin pill protagonista alrededor del tab activo

### SmartInput

- Va al final de Home
- Usa `surface-glass`
- Radio 16px

### Home

- `SaldoVivo` y listas sobre fondo directo
- Menos stack de cards
- `Ultimos5` con separadores simples y CTA en `accent`
- `+` en esquina superior derecha

### Movimientos

- Header mas limpio
- Filtro inline con la primera referencia de fecha visible
- `+` en esquina superior derecha
- Widget de metricas como `surface-module`

### Analisis / Insights

- `Diario` como vista principal del tab
- `Insights` como pantalla navegada
- Cards de insights en `surface-glass-neutral`

### Iconos de categoria

- Contenedor circular `32x32`
- Fondo semantico al 7%
- Icono Phosphor Light de `15px`

---

---

## Strategy 5 — Blue Header Zone (vigente desde 2026-05-26)

El layout principal de todas las pantallas adopta el patrón "Blue Header Zone":

### Nuevos tokens

| Token | Valor | Uso |
|---|---|---|
| `--color-primary-deep` | `#1B6A93` | Endpoint del gradiente en blue-zone |

### Nuevas utilities (app/globals.css)

| Utility | Descripción |
|---|---|
| `blue-zone` | Gradiente `#2178A8 → #1B6A93` + highlight radial + `border-bottom-radius 28px` |
| `header-glass` | `rgba(255,255,255,0.16)` + `blur(10px)` + `border rgba(255,255,255,0.22)` — para elementos sobre blue-zone |
| `card-s5` | `#FFFFFF` + `radius 18px` + `border rgba(13,24,41,0.04)` + `shadow-md` — superficie estándar de contenido |

### Componente BlueHeaderZone

`components/ui/BlueHeaderZone.tsx` — wrapper que aplica `blue-zone` más `relative shrink-0`. Recibe `children`, `className` y `style`.

### Patrón de layout

```
<div className="min-h-screen bg-bg-primary">
  <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)' }}>
    {/* Header nav, hero, SaldoVivo — texto en text-white */}
  </BlueHeaderZone>
  <div style={{ marginTop: -24 }}>
    {/* Tarjetas card-s5, listas, contenido */}
  </div>
</div>
```

### Reglas S5

- Textos e iconos sobre `blue-zone` → `text-white` y opacidades en blanco.
- Pills, botones y avatares en blue-zone → `header-glass`.
- Tarjetas de contenido en la zona blanca → `card-s5` (reemplaza `surface-glass-neutral` para insights y módulos).
- `surface-glass` sigue reservado para SmartInput.
- El overlap de `-24px` es fijo; no alterar sin coordinación visual.

---

## Referencias

- Implementacion real: `app/globals.css`
- Wrapper actual: `components/ui/BlueHeaderZone.tsx`
- Home actual: `components/dashboard/DashboardShell.tsx`
- Movimientos actual: `components/movimientos/MovimientosClient.tsx`
- Analytics actual: `components/analytics/AnalyticsClient.tsx`
- Auditoria de docs: `docs/design-docs-audit-2026-06-11.md`

Material historico, no fuente vigente:
- `docs/gota-design-specv2.md`
- `docs/ui-product-upgrade-plan-2026-04-11.md`
- `docs/mobile-ui-exploration-2026-05.md`
- `gota-revamp-ui/project/src/S5Screens.jsx`


## Formularios (migración visual, 17/10/2026)

Variantes optativas `r` y `blue-hero`: sin variante se conserva el HTML anterior. No modifican navegación, validaciones ni datos. Las superficies excluidas mantienen sus tokens.

## §A. Qué patrón usar
1. ¿La pantalla está dentro de **Ajustes** (incluye hojas abiertas desde filas de Ajustes, aunque tengan monto)? → **R** (form, lista, elección, confirmación).
2. Si no: ¿es una carga/edición con **monto protagonista** abierta desde Inicio, Movimientos o Análisis? → **Header azul con monto**.
3. Si no, pero es de Análisis (Metas, Presupuesto) → **Header azul** (sin monto si no hay).
4. Si no encaja (filtros, upgrade anónimo, etc.) → no inventar: preguntar (ver S7).
Común a todos: DM Sans (ya es `--font-sans`), íconos Phosphor **duotone**, pills con la forma de los filtros de Movimientos (`rounded-pill`, borde 1px), un solo CTA ancho, error inline (nunca `alert()` nuevo; los `alert()` existentes quedan).

## §B. Formulario con monto · header azul
**Cuándo:** Transferencia, Ingreso, Editar gasto, Suscripción desde Inicio, Editar ingreso/transferencia, aportes a metas.
**Estructura:** zona azul (X + título centrado, monto grande centrado, chip de moneda) → tarjeta blanca solapada con filas → pills (fecha, tipo, etc.) → footer fijo con error inline + CTA.
| Elemento | Valor mockup |
|---|---|
| Gradiente zona | `linear-gradient(180deg,#2E86B8,#1B6A93)`, radio inferior 28px, alto ~250px (incluye safe-area) |
| Barra superior | alto 56, X 22px blanca a la izquierda, título 16px/600 blanco centrado |
| Monto | 44px/800, `letter-spacing:-0.03em`, `tabular-nums`, blanco; símbolo 30px `#ffffffb0`; vacío `#B8C9D4` |
| Chip moneda | fondo `#ffffff26`, texto blanco 13px/600, padding 6×12, radio 99 |
| Tarjeta | `#fff`, radio 22, sombra `0 4px 12px rgba(13,24,41,.08)`, margen lateral 16, solape −28px |
| Fila | padding 14×16, gap 12, separador 1px `#E3ECF2`; label 11px/600 uppercase `#5C7A8A` (+.4px); valor 15px/600 `#0D1829`; sub 12px `#5C7A8A`; chevron `#5C7A8A` |
| Avatar de cuenta | 38×38 círculo, fondo `#EEF4F8`, texto `#1B6A93` 15px/700, borde 1px `#cfe0ea` |
| Pill | borde 1px `#cfe0ea`, fondo `#fff`, texto `#1B6A93` 13px/600, padding 8×16, radio 99; activa `#2178A8` + blanco |
| Caja tipo de cambio | fondo `#EEF4F8`, radio 14, padding 12×16, 13px `#4A6070` |
| CTA | alto 54, radio 12, `#2178A8`, blanco 16px/600; deshabilitado `#B8C9D4` |
| Footer | padding 12×16×30, degradé `transparent → #F8FBFD 30%` |
| Error inline | `#C0392B` 13px/600 (mockup); ver §I-5 |
| Fondo de pantalla | `#F8FBFD` (`bg-secondary`) |
**No hacer:** teclado propio, selector en hoja donde hoy hay `<select>`, swap ⇅, "+ Nota" plegable, monto en el texto del CTA (todo es cambio de interacción/texto).
PNG: transferencia-completa, ingreso-v3, ingreso-edicion, gasto-edicion-v2, suscripcion-inicio.

## §C. Header azul de Análisis (título + monto a la izquierda)
**Cuándo:** Detalle de meta, Presupuesto; Nueva/Editar meta y Vincular transferencia sin monto.
| Elemento | Valor mockup |
|---|---|
| Zona | mismo gradiente, radio inferior 26, padding 26×18×46 |
| Eyebrow | 10px/700, `.12em`, opacidad .75, mt 14 |
| Título | 22px/700 blanco; bajada 12px opacidad .85, lh 1.35 |
| Pill en header ("Editar") | `#ffffff26`, blanco 12px/600, padding 5×12 |
| Monto | 34px/800, `-0.02em`, mt 14; secundario 14px/500 opacidad .8 |
| Barra de progreso | 8px, radio 9, fondo `#ffffff33`, relleno blanco |
| Tarjeta | radio 20, misma sombra, margen 0 14, solape −30 |
| Fila | padding 11×12, 13px; clave `#5C7A8A`; valor 600 |
| Label de sección | 10.5px/700 `.08em` `#5C7A8A`, padding 8×22×6 |
| Botones | alto 46, radio 12; primario `#2178A8`; contorno blanco `#1B6A93` borde `#cfe0ea`; destructivo blanco `#C0392B` borde `#f0c9c4` |
| Pills de acción | flex 1, borde `#cfe0ea`, `#1B6A93` 12px/600, padding 7×0 |
| Ícono de categoría en fila | 28 círculo `#EEF4F8` / `#1B6A93` |
| Input de monto en fila | 74 ancho, derecha, `#EEF4F8`, radio 10, padding 8×10, 14px/700; error borde 1.5px `#C0392B` |
| "Quitar" / "Agregar" | 12px/600 `#5C7A8A` / 13px/600 `#2178A8` |
| Error inline | 12px `#C0392B`, fondo `#fdf0ee`, radio 10, padding 8×12 |
PNG: analisis-metas-presupuesto.

## §D. Formulario R (Ajustes)
**Cuándo:** toda alta/edición dentro de Ajustes.
**Estructura:** X → (eyebrow) → título grande → bajada → pill Archivar (si aplica) → bloques blancos de filas → CTA ancho.
| Elemento | Valor mockup |
|---|---|
| Fondo | `#f2f4f7` |
| X | padding 16×18×4, 16px `#1d2b3a` |
| Eyebrow (si el código lo tiene) | 10px/700 `.08em` `#6b7b8b` (ver §I-6) |
| Título | 26px/700 `#14222f`, padding 8×20×2 |
| Bajada | 12px `#5b6b7b`, padding 2×20×14 |
| Label de sección | 10px/700 `.08em` `#6b7b8b`, padding 18×20×6 |
| Bloque | `#fff`, radio 14, margen 0 14 10, **sin sombra**, overflow hidden |
| Fila editable | padding 13×14, gap 10, separador 1px `#eef2f5`; ícono 16 `#7b8b9b`; label 14px `#5b6b7b` (izq.); **valor 14px/600 `#1f5f8b` (der.) = editable**; placeholder `#a9b5c1` |
| Fila larga (label arriba) | padding 11×14; valor con sangría 26 |
| Fila con switch | padding 12×14; label 14px `#14222f`; sub 11px `#7b8b9b`; switch 36×20, on `#1f5f8b`, off `#c9d3dd`, perilla 16 blanca |
| Monto en R | caption 11px `#7b8b9b`; monto 34px/700 `#14222f`; símbolo 18px opacidad .5 |
| Saldos ARS/USD (exc. c) | apilados, gap 8; código de moneda 10px `#7b8b9b`; valor 20px/700 `#14222f` (cero `#a9b5c1`); nota 10.5px `#7b8b9b` lh 1.4 |
| Pill | borde 1px `#d6dee6`, fondo `#fff`, 13px/600 `#14222f`, padding 7×12, radio 99; activa `#1f5f8b` + blanco |
| Pill Archivar | fondo `#1f5f8b1a`, sin borde, texto `#1f5f8b`; contenedor padding 0×20×14 |
| CTA | radio 12, `#1f5f8b`, blanco 14px/600, padding 13; margen 12–14 arriba, 20 lateral |
| Error inline R | 12px `#b42318`, fondo `#fdecea`, radio 10, padding 9×12, ícono warning; margen 0 14 8 |
| Aviso (no error) | bloque `#fff7e6`; texto 12px `#5b6b7b`; acción 13px/600 `#1f5f8b` |
`<select>` nativos se **estilizan** como fila (valor azul a la derecha); no se reemplazan por selector propio. Inputs de texto: el `<input>` vive en la fila, alineado a la derecha, sin subrayado.
PNG: fondo-claro-r, ajustes-r-estados-b (1).

## §E. Lista R
Fondo `#f2f4f7`, título grande + bajada, **todas las filas en un solo bloque blanco** (radio 14). Fila: padding 12×14, gap 12, separador `#eef2f5`; ícono 34×34 radio 10 fondo `#eef3f7` color `#1f5f8b`; título 14px/600 `#14222f`; sub 11.5px `#7b8b9b`; valor 14px/600 `#14222f`; chevron `#a9b5c1`. Encabezado de grupo ("ACTIVAS") 11px/600 `.06em` `#7b8b9b`, padding 6×22. Vacío: bloque padding 30×20 centrado, ícono 26 `#7b8b9b`, título 15px/600, texto 12px `#7b8b9b`. CTA debajo del bloque. PNG: fondo-claro-r2, ajustes-r-estados (1), ajustes-r-estados-b (3).

## §F. Elección R
Igual que lista R, sin valor a la derecha, con chevron; cada opción es un botón-fila (título + descripción). Elecciones cortas (≤ 4 opciones de una palabra o dos) van en pills dentro de un bloque. PNG: fondo-claro-r2 (1), ajustes-r-estados (3).

## §G. Confirmación R
Fondo `#f2f4f7`; eyebrow 10px/700 `#6b7b8b`; título 22px/700 `#14222f` lh 1.2; descripción 12.5px `#5b6b7b` lh 1.4; cuerpo en bloque blanco 12.5px `#33475b` lh 1.45 padding 12×14; botón destructivo `#b42318` radio 12 padding 13, blanco 14px/600; "Cancelar" 13px/600 `#5b6b7b`. El mockup lo dibuja como hoja inferior (radio 24 arriba, grab 40×4 `#c9d3dd`, velo `#0d182966`); hoy `ConfirmationSurface` es pantalla completa en mobile: **se mantiene el contenedor** salvo decisión D3. Foco inicial en Cancelar/cerrar (como hoy). PNG: ajustes-r-estados (2), ajustes-r-estados-b (2).

## §H. Error inline
Siempre el componente `InlineError` (`role="alert"`), en el footer arriba del CTA donde ya está; en R con los tokens de §D, en header azul con los de §B/§C. Nunca agregar `alert()`; nunca sacar los `alert()` existentes (`SubscriptionSheet`, `YieldItem`). Mensajes: los del código, sin cambiar.


### Decisiones de compatibilidad

Duotone en formularios; Light en navegación existente. Gradiente, radios, solape y gris R son optativos. Se conservan `blue-zone`, `card-s5`, los tokens previos y el color `danger`. Azul R nuevo `primary-r`; montos 44 px en cargas y 34 px en planificación. Cuentas sigue usando SettingsDetail/ManagementSurface y TaskSurface. El contenedor de confirmaciones sigue siendo FullScreenSheet.
