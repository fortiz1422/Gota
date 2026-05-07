---
name: gota-redesign
description: >
  Aplicar el design system de Gota (Modo Fría vNext) a componentes UI.
  Activar SIEMPRE que se cree o modifique cualquier componente visual, se detecten
  colores hardcodeados, se use tipografía raw de Tailwind, o se necesite verificar
  consistencia visual. Cubre tokens, tipografía, radius, superficies, botones y
  patrones de composición.
allowed-tools: Read, Grep, Glob
---

# Gota — Design System Aplicado (Modo Fría vNext)

> Fuente de verdad: `app/globals.css` (tokens CSS reales) + `docs/design-system-final.md`
> Doc histórico — NO usar: `docs/gota-design-system.md` (tema dark Deep Ocean, valores obsoletos)

---

## 1. ANTES DE CODEAR

1. Si no tenés los tokens frescos en contexto, leer `app/globals.css`
2. Revisar este checklist ante cada componente nuevo:
   - [ ] Tipografía usa utilities `type-*` (no Tailwind raw)
   - [ ] Radius usa tokens del DS (no `rounded-xl`, `rounded-2xl`)
   - [ ] Colores usan clases de token (no hex hardcodeados, no opacidad arbitraria)
   - [ ] Iconos son Phosphor weight="light" (no emojis como UI)
   - [ ] Superficie correcta según contexto (ver sección 5)
   - [ ] Tema light — cero clases `dark:`, cero fondos oscuros

---

## 2. TOKENS DE COLOR

### Fondos y superficies

| Clase Tailwind | Valor | Cuándo usar |
|---|---|---|
| `bg-bg-primary` | #FFFFFF | Fondo de pantalla completa |
| `bg-bg-secondary` | #F8FBFD | Cards simples, sheets suaves |
| `bg-bg-tertiary` | #EEF4F8 | Inputs, shells internos |
| `surface-module` | blanco + shadow-module | Módulos elevados, bloques de métricas |
| `surface-glass` | azul traslúcido + blur(24px) | SmartInput, elementos glass prioritarios |
| `surface-glass-neutral` | blanco traslúcido + blur(24px) | Cards glass neutras (insights, testimonios) |

### Texto

| Clase | Valor | Uso |
|---|---|---|
| `text-text-primary` | #0D1829 | Texto principal, montos de egreso |
| `text-text-secondary` | #4A6070 | Texto secundario, descripciones |
| `text-text-tertiary` / `text-text-dim` | #90A4B0 | Captions, metadata, subtexto |
| `text-text-disabled` | #B8C9D4 | Elementos deshabilitados |

### Accents semánticos

| Clase | Valor | Uso |
|---|---|---|
| `text-primary` / `bg-primary` | #2178A8 | CTA, links, estados activos, navegación |
| `text-success` | #1A7A42 | Ingresos, estados positivos |
| `text-warning` | #B84A12 | Deseo, alertas suaves |
| `text-danger` | #A61E1E | Errores, alarmas reales |
| `text-data` | #1B7E9E | Transferencias, datos neutros |

### Versiones soft (fondos tintados)

Usar estos tokens en lugar de opacidades arbitrarias (`bg-primary/8`, `bg-primary/12`):

| Token | Equivalente incorrecto |
|---|---|
| `bg-primary-soft` | ~~`bg-primary/8`~~ ~~`bg-primary/12`~~ |
| `bg-success-soft` | ~~`bg-success/10`~~ |
| `bg-warning-soft` | ~~`bg-warning/10`~~ |
| `bg-danger-soft` / `bg-danger-light` | ~~`bg-danger/9`~~ |
| `bg-data-soft` | ~~`bg-data/10`~~ |

### Bordes

| Clase | Uso |
|---|---|
| `border-border-subtle` | Separadores internos, cards base |
| `border-border-strong` | Bordes fuertes, hovers |
| `bg-separator` / `bg-border-subtle` | Línea divisora (1px) |

---

## 3. TIPOGRAFÍA — UTILITIES `type-*` OBLIGATORIAS

**Regla principal:** NUNCA usar Tailwind tipográfico raw (`text-sm font-medium`, `text-2xl font-bold`, `text-xs`, etc.) para texto de interfaz. Siempre usar las utilities del design system.

| Utility | Tamaño / Peso | Cuándo usar |
|---|---|---|
| `type-hero` | 40px / 800 | Saldo principal (SaldoVivo hero) |
| `type-title` | 22px / 800 | Títulos de pantalla, headers principales |
| `type-amount` | 22px / 800 | Montos secundarios, totales |
| `type-amount-sm` | 19px / 700 | Montos en listas, contextos comprimidos |
| `type-body-lg` | 16px / 700 | Body enfatizado, nombre en filas |
| `type-body` | 15px / 500 | Body estándar, inputs, descripciones, filas |
| `type-meta` | 12px / 400 | Fechas, categorías, metadata, captions |
| `type-label` | 11px / 700 + uppercase | Section headers (ÚLTIMOS MOVIMIENTOS) |
| `type-micro` | 11px / 700 | Sub-labels, micro-copy |

**Ejemplos de corrección:**

```tsx
// ❌ Incorrecto
<h2 className="text-2xl font-semibold text-text-primary">Título</h2>
<p className="text-sm text-text-secondary">Body</p>
<p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">LABEL</p>
<span className="text-xs text-text-secondary">Meta</span>

// ✅ Correcto
<h2 className="type-title text-text-primary">Título</h2>
<p className="type-body text-text-secondary">Body</p>
<p className="type-label text-text-dim">LABEL</p>
<span className="type-meta text-text-tertiary">Meta</span>
```

---

## 4. RADIUS — TOKENS, NO TAILWIND GENÉRICO

| Token | Valor | Clase Tailwind | Uso |
|---|---|---|---|
| `radius-card` | 16px | `rounded-card` | Cards, modales, sections estándar |
| `radius-card-lg` | 22px | `rounded-[22px]` | Cards grandes, hero cards |
| `radius-input` | 16px | `rounded-input` | Inputs, textareas, selects |
| `radius-button` | 12px | `rounded-button` | Botones de acción |
| `radius-pill` | 9999px | `rounded-full` | Pills, chips, tags, avatars |

**Regla:** `rounded-2xl` (24px), `rounded-xl` (12px), `rounded-lg` (8px) son valores Tailwind genéricos que no pertenecen al DS. Usar los tokens de arriba.

---

## 5. SUPERFICIES — CUÁNDO USAR CADA UNA

| Contexto | Superficie correcta |
|---|---|
| Card de lectura, módulo de métricas | `surface-module` + `rounded-card` |
| Card glass SmartInput, elemento flotante principal | `surface-glass` + `rounded-card` |
| Card glass neutra (insight, testimonio, callout) | `surface-glass-neutral` + `rounded-card` |
| Card simple sin glass | `bg-bg-secondary border border-border-subtle rounded-card` |
| Pantalla completa | `bg-bg-primary` |
| Bottom sheet / modal drawer | `bg-bg-primary rounded-t-[22px]` |
| Input / select | `bg-bg-tertiary rounded-input border border-border-subtle` |

---

## 6. BOTONES

### CTA Principal (full-width, mobile)

```tsx
<button
  onClick={onNext}
  className="w-full rounded-button bg-primary py-4 type-body-lg text-white transition-transform active:scale-95"
>
  Continuar
</button>
```

- `rounded-button` (12px) — NO `rounded-full`
- `text-white` — NO `text-bg-primary`
- `type-body-lg` para el label

### CTA Secundario / Ghost

```tsx
<button
  onClick={onSkip}
  className="w-full py-3 type-body text-text-tertiary transition-colors active:text-text-secondary"
>
  Omitir
</button>
```

### Botón destructivo

```tsx
<button className="rounded-button bg-danger py-3 px-6 type-body-lg text-white active:scale-95">
  Eliminar
</button>
```

### Item de selección (list choice)

```tsx
<button
  onClick={() => setSelected(value)}
  className={`w-full flex items-center gap-3 rounded-card border px-4 py-3.5 text-left transition-colors ${
    selected === value
      ? 'border-primary bg-primary-soft text-text-primary'
      : 'border-border-subtle bg-bg-secondary text-text-secondary'
  }`}
>
  {/* Phosphor icon, NO emoji */}
  <Icon size={18} weight="light" className={selected === value ? 'text-primary' : 'text-text-tertiary'} />
  <span className="type-body">{label}</span>
</button>
```

---

## 7. ICONOS

- **Siempre Phosphor Icons**, peso `light` (weight="light")
- **NUNCA emojis como iconos de interfaz** — solo emojis decorativos en onboarding si es explícitamente marketing/copy
- Tamaño estándar en filas: `size={16}` o `size={18}`
- Tamaño en contenedor de categoría: `size={15}`

### Contenedor de categoría

```tsx
<div
  className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center"
  style={{ background: 'rgba(33,120,168,0.07)' }} // usar color semántico al 7%
>
  <PhosphorIcon size={15} weight="light" className="text-primary" />
</div>
```

---

## 8. PATRONES DE COMPOSICIÓN

### Section header

```tsx
<p className="type-label text-text-dim mb-3">ÚLTIMOS MOVIMIENTOS</p>
```

### Separador de lista

```tsx
<div className="h-px bg-separator" />
```

### Fila de lista (gasto / movimiento)

```tsx
<div className="flex items-center gap-3 py-3 border-b border-border-subtle last:border-0">
  {/* Icono */}
  <div className="h-8 w-8 rounded-full bg-primary-soft flex-shrink-0 flex items-center justify-center">
    <Icon size={15} weight="light" className="text-primary" />
  </div>
  {/* Texto */}
  <div className="flex-1 min-w-0">
    <p className="type-body text-text-primary truncate">{descripcion}</p>
    <p className="type-meta text-text-tertiary">{fecha} · {categoria}</p>
  </div>
  {/* Monto */}
  <span className="type-body-lg text-text-primary">-${monto}</span>
</div>
```

### Card de métrica (surface-module)

```tsx
<div className="surface-module rounded-card p-4">
  <p className="type-label text-text-dim mb-3">TÍTULO SECCIÓN</p>
  {/* contenido */}
</div>
```

### Pill / chip de estado

```tsx
// Pill de categoría
<span className="rounded-full bg-primary-soft px-2.5 py-0.5 type-meta text-primary">
  Alimentación
</span>

// Pill de estado semántico
<span className="rounded-full bg-success-soft px-2.5 py-0.5 type-meta text-success">
  Necesidad
</span>
```

### Input estándar

```tsx
<input
  className="w-full rounded-input bg-bg-tertiary border border-border-subtle px-4 py-3 type-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
  placeholder="..."
/>
```

---

## 9. REGLAS ABSOLUTAS (prohibiciones)

| Prohibido | Correcto |
|---|---|
| Hex hardcodeados (`#2178A8`, `rgba(...)`) | Clases de token CSS |
| `bg-primary/8`, `/12`, `/20` | `bg-primary-soft` |
| `rounded-2xl`, `rounded-xl` en cards | `rounded-card`, `rounded-[22px]` |
| `rounded-full` en botones CTA | `rounded-button` |
| `text-sm font-bold`, `text-2xl font-semibold` | `type-body-lg`, `type-title` |
| `text-[10px] uppercase tracking-widest` | `type-label` |
| `text-bg-primary` como color de texto | `text-white` |
| Emojis como iconos de UI (`📅`, `🎯`) | Phosphor Icons weight="light" |
| Clases `dark:` o fondos oscuros | Tema light only |
| Referenciar `docs/gota-design-system.md` | `docs/design-system-final.md` + `app/globals.css` |
