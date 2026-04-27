# HISTORICO - NO VIGENTE - Plan de Migracion a Light Mode

> Superado por `docs/design-system-final.md` v4.0 y `app/globals.css`.

# Gota — Plan de Migración a Light Mode
## Documento único de implementación

---

## Contexto del proyecto

Gota es una PWA de finanzas personales para el mercado argentino.  
**Stack:** Next.js App Router · Supabase · Tailwind v4 · TypeScript · Gemini Flash · Vercel

Este documento describe la migración completa del sistema visual actual (Dark / Deep Ocean) al nuevo sistema Light Mode "Fría". Es la única fuente de verdad para la implementación. No se deben asumir valores fuera de los definidos acá.

---

## Principios del nuevo sistema

- **Un solo modo:** Light únicamente. El dark mode queda deprecado.
- **Cardless en listas:** filas con separador de 1px, sin contenedores.
- **Glassmorphism sutil:** todas las superficies interactivas usan `rgba(255,255,255,0.38)` con blur. No blanco sólido.
- **Color con propósito:** el acento vive en acciones. El color de datos en métricas. Los semánticos en estados. Los íconos de categoría en su propio color.
- **Un solo botón primario por pantalla:** siempre en `accent`.
- **Íconos unificados:** solo Phosphor Icons, estilo Light, stroke 1.5px. Eliminar Lucide y cualquier otra librería al intervenir cada componente.

---

## 1. Tipografía

**Familia principal:** DM Sans  
**Import:** agregar en `app/layout.tsx` o equivalente global:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

**Escala de texto:**

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| hero | 42px | 800 | Saldo disponible |
| hero-muted | 32px | 500 | Decimales del hero |
| title | 24px | 700 | Títulos de pantalla |
| section-label | 10px | 700 | Labels de sección en CAPS |
| body-lg | 15px | 600 | Nombre de transacción |
| body | 13–14px | 500–600 | Texto general |
| meta | 11px | 500 | Categoría, fecha |
| micro | 9–10px | 600–700 | Badges, labels caps |

**Letter spacing:**
- Títulos hero: `-1.5px`
- Títulos de pantalla: `-0.5px`
- Labels CAPS: `0.09em`
- Montos: `-0.2px a -0.5px`

---

## 2. Colores — Tokens completos

### Fondos
```
bgPrimary:    #F0F4F8   — fondo de pantalla
bgSecondary:  #E6ECF2   — fondo de bottom sheets
bgTertiary:   #DCE3EA   — fondo externo / shell
```

### Superficies (Glassmorphism)
```
cardBg:       rgba(255,255,255,0.38)
cardBorder:   rgba(255,255,255,0.70)
backdropBlur: blur(16px)             — siempre con prefijo -webkit-
```

### Texto
```
textPrimary:  #0D1829   — texto principal, montos, títulos
textSecond:   #4A6070   — texto secundario, labels
textDim:      #90A4B0   — placeholders, metadata, CAPS labels
textMuted:    #B8C9D4   — decimales hero, elementos muy secundarios
```

### Acento — acciones UI
```
accent:       #2178A8
accentSoft:   rgba(33,120,168,0.09)
```

### Data — gráficos y métricas
```
data:         #1B7E9E
dataSoft:     rgba(27,126,158,0.10)
```

### Semánticos
```
green:        #1A7A42   — Necesidad, Saludable, ingresos
greenSoft:    rgba(26,122,66,0.10)

orange:       #B84A12   — Deseo, alertas suaves
orangeSoft:   rgba(184,74,18,0.10)

danger:       #A61E1E   — déficit, eliminar, errores
dangerSoft:   rgba(166,30,30,0.09)
```

### Bordes
```
border:       rgba(15,30,60,0.06)   — separadores de filas
borderMid:    rgba(15,30,60,0.10)   — bordes de inputs, toggles
```

---

## 3. Categorías — 20 íconos con color

**Librería:** `@phosphor-icons/react`  
**Estilo:** Light  
**Stroke:** 1.5px · strokeLinecap: round · strokeLinejoin: round

Cada categoría tiene un `color` (hex para el ícono) y un `colorSoft` (rgba al 10% para el fondo del contenedor).

### Alimentación — familia verde
| Categoría | Ícono Phosphor | color | colorSoft |
|---|---|---|---|
| Supermercado | `ShoppingCart` | `#1A7A42` | `rgba(26,122,66,0.10)` |
| Alimentos | `Basket` | `#1A7A42` | `rgba(26,122,66,0.10)` |
| Restaurante | `ForkKnife` | `#2D8B5A` | `rgba(45,139,90,0.10)` |
| Delivery | `Motorcycle` | `#2D8B5A` | `rgba(45,139,90,0.10)` |
| Kiosco y Varios | `Storefront` | `#3D9668` | `rgba(61,150,104,0.10)` |

### Hogar — familia azul
| Categoría | Ícono Phosphor | color | colorSoft |
|---|---|---|---|
| Casa/Mantenimiento | `Wrench` | `#2178A8` | `rgba(33,120,168,0.10)` |
| Muebles y Hogar | `Armchair` | `#2178A8` | `rgba(33,120,168,0.10)` |
| Servicios del Hogar | `Lightning` | `#1B7E9E` | `rgba(27,126,158,0.10)` |

### Transporte — familia naranja
| Categoría | Ícono Phosphor | color | colorSoft |
|---|---|---|---|
| Auto/Combustible | `GasPump` | `#B84A12` | `rgba(184,74,18,0.10)` |
| Auto/Mantenimiento | `Gear` | `#B84A12` | `rgba(184,74,18,0.10)` |
| Transporte | `Bus` | `#C4601A` | `rgba(196,96,26,0.10)` |

### Salud — familia teal
| Categoría | Ícono Phosphor | color | colorSoft |
|---|---|---|---|
| Salud | `Heart` | `#1B7E9E` | `rgba(27,126,158,0.10)` |
| Farmacia | `Pill` | `#0E8A7A` | `rgba(14,138,122,0.10)` |

### Personal — familia violeta
| Categoría | Ícono Phosphor | color | colorSoft |
|---|---|---|---|
| Educación | `BookOpen` | `#6D3DB5` | `rgba(109,61,181,0.10)` |
| Ropa e Indumentaria | `TShirt` | `#7D4EC0` | `rgba(125,78,192,0.10)` |
| Cuidado Personal | `Sparkle` | `#8B60C8` | `rgba(139,96,200,0.10)` |
| Regalos | `Gift` | `#A0367A` | `rgba(160,54,122,0.10)` |

### Finanzas — familia neutral/roja
| Categoría | Ícono Phosphor | color | colorSoft |
|---|---|---|---|
| Transf. Familiares | `Users` | `#4A6070` | `rgba(74,96,112,0.10)` |
| Otros | `Tag` | `#4A6070` | `rgba(74,96,112,0.10)` |
| Pago de Tarjetas | `CreditCard` | `#A61E1E` | `rgba(166,30,30,0.10)` |

---

## 4. Componentes — Especificaciones exactas

### Surface / Card (glassmorphism)
```css
background: rgba(255,255,255,0.38);
border: 1px solid rgba(255,255,255,0.70);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
```

### Border radius
```
pill:      999px   — nav, inputs, chips, SmartInput
card:       18px   — insight cards, sheets
item:    12–14px   — pills percibidos/tarjeta, campos de form
icon:       10px   — íconos de categoría en movimientos
icon-sm:   8–9px   — íconos pequeños
screen:     48px   — shell de pantalla completa
```

### Separador de lista
```css
border-bottom: 1px solid rgba(15,30,60,0.06);
padding-top: 13px;
padding-bottom: 13px;
```

### Ícono de categoría en lista
```css
width: 36px; height: 36px;
border-radius: 10px;
background: [colorSoft de la categoría];
/* ícono Phosphor Light en [color de la categoría] */
```

### Badge semántico
```css
padding: 2px 8px;
border-radius: 999px;
font-size: 10–11px;
font-weight: 600;
background: [colorSoft];
color: [color];
```

### Labels CAPS de sección
```css
font-size: 10px;
font-weight: 700;
letter-spacing: 0.09em;
color: #90A4B0; /* textDim */
margin-bottom: 10px;
```

### Botón primario (CTA)
```css
width: 100%;
padding: 15px;
background: #2178A8; /* accent */
border: none;
border-radius: 14px;
color: #ffffff;
font-size: 15px;
font-weight: 700;
```

### Toggle segmentado (ARS/USD · Necesidad/Deseo · Diario/Análisis)
```css
/* Contenedor */
display: flex;
background: rgba(255,255,255,0.50);
border: 1px solid rgba(255,255,255,0.70);
border-radius: 12px;
padding: 4px;
gap: 4px;

/* Tab activo */
background: [accent o color semántico];
color: #ffffff;
border-radius: 9px;
padding: 8–10px;
font-weight: 600;

/* Tab inactivo */
background: transparent;
color: #4A6070; /* textSecond */
```

### Chips de selección (cuentas, categorías)
```css
/* Inactivo */
padding: 7px 14px;
border-radius: 999px;
background: #FFFFFF;
border: 1px solid rgba(15,30,60,0.10);
color: #4A6070;
font-size: 13px;
font-weight: 500;

/* Activo */
background: #2178A8; /* accent */
color: #ffffff;
border: none;
font-weight: 600;
```

### Campo de formulario
```css
background: #FFFFFF;
border: 1px solid rgba(15,30,60,0.10);
border-radius: 12px;
padding: 13px 14px;
font-size: 14px;
color: #0D1829;
```

---

## 5. Nav

```css
/* Contenedor */
background: rgba(255,255,255,0.38);
border: 1px solid rgba(255,255,255,0.70);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border-radius: 999px;
padding: 6px;
margin: 0 16px 28px;

/* Tab activo */
background: #0D1829; /* textPrimary */
color: #ffffff;
padding: 8px 20px;
border-radius: 999px;
font-size: 13px;
font-weight: 600;
gap: 6px; /* entre ícono y label */

/* Tab inactivo */
color: #90A4B0; /* textDim */
padding: 8px;
```

---

## 6. SmartInput

```css
/* Contenedor */
background: rgba(255,255,255,0.38);
border: 1px solid rgba(255,255,255,0.70);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border-radius: 999px;
padding: 11px 10px 11px 18px;
box-shadow: 0 4px 20px rgba(15,30,60,0.07);
margin: 0 16px 10px;

/* Botón enviar — inactivo */
width: 34px; height: 34px;
border-radius: 50%;
background: rgba(15,30,60,0.06);

/* Botón enviar — activo (hay texto) */
background: #2178A8; /* accent */
```

---

## 7. Bottom Sheets

```css
/* Contenedor */
background: #E6ECF2; /* bgSecondary */
border-radius: 28px 28px 0 0;
box-shadow: 0 -8px 40px rgba(0,0,0,0.14);

/* Handle */
width: 36px; height: 4px;
border-radius: 99px;
background: rgba(15,30,60,0.15);
margin: 10px auto 4px;
```

### Sheet "¿Qué querés agregar?"
- Título `18px / 700`
- Separador `1px` bajo el título
- Filas cardless: ícono `40x40 / borderRadius 12px / colorSoft` + título `15px/600` + descripción `12px / textDim` + chevron

### Sheet "Confirmar gasto"
1. Campo monto: glassmorphism con toggle ARS/USD interno a la derecha
2. Chips de cuenta scrollables: activo en `accent`
3. Dropdown categoría: campo blanco con chevron
4. Campo fecha: campo blanco con ícono calendario
5. Toggle Necesidad/Deseo: verde `#1A7A42` / naranja `#B84A12`
6. CTA "Guardar gasto": botón primario `accent` full-width
7. "Cancelar": texto suelto en `textDim`, sin botón

---

## 8. Pantallas — Especificación por pantalla

### Home
| Elemento | Especificación |
|---|---|
| Header | título mes `24px/700` + chevron + botón `+` glassmorphism circular `34px` |
| Hero label | `DISPONIBLE` en CAPS label |
| Saldo | `42px/800` en `textPrimary`, decimales `32px/500` en `textMuted` |
| Pills Percibidos/Tarjeta | glassmorphism, `borderRadius: 14px`, label `9px/700/textDim`, valor `17px/700` |
| Barra N/D | `height: 4px`, verde/naranja, gap `2px` en `bgPrimary`, counts en `textDim` |
| Lista movimientos | cardless, separadores, ícono `36x36/borderRadius 10px` coloreado |
| Ver todos | `12px/600` en `accent` con chevron |
| SmartInput | glassmorphism pill |
| Nav | glassmorphism pill, "Home" activo |

### Analytics — Vista Diario
| Elemento | Especificación |
|---|---|
| Toggle Diario/Análisis | glassmorphism pill, tab activo `textPrimary` |
| Card Fuga Silenciosa | glassmorphism `18px`, número naranja `26px/800`, dots decorativos |
| Card Mapa de Hábitos | glassmorphism `18px`, mini grilla 7col × 2 semanas, número días en `data` |
| Card Compromisos | glassmorphism `18px`, donut `48px`, total `20px/800`, badge Saludable |
| Export CSV | fila centrada, ícono download en `textDim` |

### Analytics — Vista Análisis
| Elemento | Especificación |
|---|---|
| Titular narrativo | `22px/800`, número déficit en `danger` |
| Chips de insight | scrollable horizontal, glassmorphism pill |
| Rows de categoría | cardless, ícono coloreado, barra `3px` proporcional, badge tipo en texto color |
| Tap-to-expand | panel blanco `borderRadius 12px` con promedio + % del mes |
| Ver todas | pill glassmorphism centrado |

### Drill-down Fuga Silenciosa
| Elemento | Especificación |
|---|---|
| Header | back button glassmorphism `32px` circular + título `20px/700` |
| Hero card | glassmorphism `18px`, emoji centrado, total naranja `38px/800`, umbral Q1 |
| Lista por categoría | cardless, ícono coloreado, barra proporcional `3px`, promedio en `textDim` |

### Drill-down Compromisos
| Elemento | Especificación |
|---|---|
| Header | back button glassmorphism + título |
| Donut hero | `80px`, stroke `8px`, porcentaje `16px/800` interno, cardless |
| Total | `32px/800 textPrimary` + descripción + badge Saludable |
| Disclaimer | glassmorphism `borderRadius 12px`, `11px / textDim` |
| Rows tarjeta | ícono CreditCard coloreado `36x36`, nombre + cierre/días, monto, tap-to-expand |
| Expand tarjeta | panel blanco: % ingreso + % total comprometido + mini barra |

---

## 9. Espaciado

| Uso | Valor |
|---|---|
| Padding horizontal de pantalla | `22px` |
| Gap entre cards | `8–10px` |
| Padding interno de card | `15–16px` |
| Separación entre secciones | `22–24px` |
| Padding bottom nav | `28px` |
| Row padding top/bottom en listas | `13–14px` |

---

## 10. Sombras

| Uso | Valor |
|---|---|
| Shell de pantalla | `0 28px 70px rgba(0,0,0,0.18)` |
| SmartInput | `0 4px 20px rgba(15,30,60,0.07)` |
| Nav | `0 2px 10px rgba(15,30,60,0.05)` |
| Bottom sheet | `0 -8px 40px rgba(0,0,0,0.14)` |

---

## 11. Plan de migración — sesiones

### Sesión 0 — Auditoría y setup (hacer antes de tocar código)
1. Instalar `@phosphor-icons/react` si no está
2. Agregar DM Sans al layout global
3. Crear archivo de tokens `lib/design-tokens.ts` con todos los valores de este doc
4. Listar todos los componentes existentes con colores hardcodeados del sistema Dark
5. Identificar archivos CSS/Tailwind con tokens del Deep Ocean para deprecar
6. Verificar columna `closing_day` en tabla `user_active_cards` de Supabase

### Sesión 1 — Tokens y globals
1. Reemplazar tokens de color globales (CSS vars o Tailwind config) por el nuevo sistema
2. Actualizar fuente global a DM Sans
3. Actualizar color de fondo de `<body>` y layout raíz a `bgPrimary`

### Sesión 2 — Nav + SmartInput
Componentes más transversales — al migrarlos el cambio se siente en toda la app.

### Sesión 3 — Home
Migrar en orden: hero → pills → barra N/D → lista movimientos

### Sesión 4 — Analytics Vista Diario (3 cards)

### Sesión 5 — Analytics Vista Análisis (lista de categorías)

### Sesión 6 — Drill-down Fuga Silenciosa

### Sesión 7 — Drill-down Compromisos

### Sesión 8 — Bottom Sheets
- ¿Qué querés agregar?
- Confirmar gasto
- Registrar ingreso
- Nueva suscripción
- Cuotas en curso

### Sesión 9 — Config (a especificar)

---

## 12. Reglas de trabajo con Claude Code

1. **Diffs antes de aplicar** — mostrar el diff completo antes de modificar cualquier archivo
2. **No reformatear código no tocado** — solo las líneas necesarias
3. **Cambios estrictamente acotados** — un componente por sesión
4. **Sin valores fuera de tokens** — ningún color hardcodeado fuera de `design-tokens.ts`
5. **Phosphor únicamente** — eliminar imports de Lucide y otras librerías al intervenir cada componente
6. **Webkit siempre** — `backdropFilter` + `WebkitBackdropFilter` juntos
7. **Preguntar antes de asumir** — si algo no está en este doc, consultar antes de decidir
