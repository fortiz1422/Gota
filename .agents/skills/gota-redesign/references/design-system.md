# Gota Design System — Referencia Rápida (Modo Fría vNext)

> Fuente de verdad: `app/globals.css` + `docs/design-system-final.md`
> NO usar: `docs/gota-design-system.md` (histórico, tema dark Deep Ocean)

---

## Fondos y superficies

| Clase | Valor | Uso |
|---|---|---|
| `bg-bg-primary` | #FFFFFF | Fondo de pantalla |
| `bg-bg-secondary` | #F8FBFD | Cards simples, sheets |
| `bg-bg-tertiary` | #EEF4F8 | Inputs, shells internos |
| `surface-module` | blanco + shadow-module | Módulos elevados, métricas |
| `surface-glass` | rgba(190,225,248,0.28) + blur(24px) | SmartInput, glass principal |
| `surface-glass-neutral` | rgba(255,255,255,0.72) + blur(24px) | Cards glass neutras |

## Texto

| Clase | Valor | Uso |
|---|---|---|
| `text-text-primary` | #0D1829 | Texto principal, egresos |
| `text-text-secondary` | #4A6070 | Texto secundario |
| `text-text-tertiary` / `text-text-dim` | #90A4B0 | Captions, metadata |
| `text-text-disabled` | #B8C9D4 | Deshabilitados |

## Accents

| Clase | Valor | Uso |
|---|---|---|
| `text-primary` / `bg-primary` | #2178A8 | CTA, links, activo, nav |
| `text-success` | #1A7A42 | Ingresos, positivo |
| `text-warning` | #B84A12 | Deseo, alertas |
| `text-danger` | #A61E1E | Errores, alarmas reales |
| `text-data` | #1B7E9E | Transferencias, datos neutros |

## Soft variants (fondos tintados)

| Clase | Uso |
|---|---|
| `bg-primary-soft` | Fondo azul suave — NO usar `bg-primary/8` ni `/12` |
| `bg-success-soft` | Fondo verde suave |
| `bg-warning-soft` | Fondo naranja suave |
| `bg-danger-soft` / `bg-danger-light` | Fondo rojo suave |
| `bg-data-soft` | Fondo data suave |

## Bordes

| Clase | Uso |
|---|---|
| `border-border-subtle` | Separadores internos, cards base |
| `border-border-strong` | Bordes fuertes, hovers |
| `bg-separator` | Línea divisora (1px) |

---

## Tipografía — utilities `type-*`

NUNCA usar Tailwind tipográfico raw (`text-sm`, `text-2xl font-bold`, etc.).

| Utility | Tamaño / Peso | Uso |
|---|---|---|
| `type-hero` | 40px / 800 | Saldo principal |
| `type-title` | 22px / 800 | Títulos de pantalla |
| `type-amount` | 22px / 800 | Montos secundarios |
| `type-amount-sm` | 19px / 700 | Montos en listas |
| `type-body-lg` | 16px / 700 | Body enfatizado |
| `type-body` | 15px / 500 | Body estándar, inputs, filas |
| `type-meta` | 12px / 400 | Fechas, metadata, captions |
| `type-label` | 11px / 700 + uppercase | Section headers |
| `type-micro` | 11px / 700 | Sub-labels, micro-copy |

---

## Radius

| Token | Valor | Uso |
|---|---|---|
| `rounded-card` | 16px | Cards, modales, sections |
| `rounded-[22px]` | 22px | Cards grandes, hero |
| `rounded-input` | 16px | Inputs, textareas |
| `rounded-button` | 12px | Botones de acción |
| `rounded-full` | 9999px | Pills, chips, avatars |

NO usar: `rounded-2xl`, `rounded-xl`, `rounded-lg` para elementos de UI.

---

## Sombras

| Variable CSS | Uso |
|---|---|
| `shadow-module` (0 1px 6px rgba(0,0,0,0.07)) | surface-module |
| `shadow-sm` (0 1px 3px rgba(13,24,41,0.05)) | Elevación mínima |
| `shadow-md` (0 4px 12px rgba(13,24,41,0.08)) | Cards con más presencia |
| `shadow-lg` (0 8px 24px rgba(13,24,41,0.10)) | Modales, drawers |

---

## Iconos

- Siempre **Phosphor Icons**, peso `light` (weight="light")
- Tamaño en filas: 16–18px · En contenedor de categoría: 15px
- NUNCA emojis como iconos de interfaz

## Font

- Primaria: `DM Sans` · Fallback: `Geist Sans`
- Pesos habilitados: 400 / 500 / 700 / 800
