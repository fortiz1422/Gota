# Gota - Design System

**Version:** 4.0 - Light Mode "Fria vNext"  
**Status:** Produccion - fuente de verdad visual vigente

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

## Referencias

- Propuesta visual base: `docs/gota-design-specv2.md`
- Plan de upgrade UI: `docs/ui-product-upgrade-plan-2026-04-11.md`
- Implementacion real: `app/globals.css`
