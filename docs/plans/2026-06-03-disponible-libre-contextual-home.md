# Disponible libre contextual en Home Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Mantener Home simple para usuarios que todavía no usan metas comprometidas y hacer que `Disponible libre` aparezca solo como una lectura contextual cuando ya existe una diferencia real con `Disponible real`.

**Architecture:** No agregar un tercer KPI fijo ni un switcher visible por default en la card de Home. Mantener la card actual como `Disponible real`; cuando `comprometido en metas > 0`, mostrar una señal/CTA liviana que invite a ver `Disponible libre`. El sheet se vuelve contextual: puede abrir enfocado en `real` o `libre`, pero siempre muestra el breakdown completo.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, React Query.

---

## Task 1: Introducir modo contextual del sheet

**Objective:** Permitir que el detalle de disponible abra enfocado en `real` o `libre`.

**Files:**
- Modify: `components/dashboard/DisponibleRealSheet.tsx`
- Modify: `components/dashboard/DashboardShell.tsx`

**Implementation notes:**
- agregar prop `initialMode?: 'real' | 'libre'`
- mostrar título/subcopy y énfasis visual según modo activo
- mantener siempre el breakdown completo para no perder contexto
- no convertir el sheet en un flow complejo; sólo cambiar foco visual y copy

---

## Task 2: Simplificar la card de Home cuando no hay metas comprometidas

**Objective:** Volver al estado base de dos niveles (`Saldo Vivo` + `Disponible real`) sin ruido adicional.

**Files:**
- Modify: `components/dashboard/DashboardShell.tsx`

**Implementation notes:**
- si `committedGoalsDisplayValue <= 0`, ocultar la línea `Libre hoy`
- dejar sólo label, subcopy breve y monto principal
- preservar tap para abrir sheet en modo `real`

---

## Task 3: Señal contextual cuando sí hay metas comprometidas

**Objective:** Hacer visible `Disponible libre` sin sumar un tercer KPI fijo.

**Files:**
- Modify: `components/dashboard/DashboardShell.tsx`

**Implementation notes:**
- si `committedGoalsDisplayValue > 0`, mostrar una línea secundaria/CTA discreta
- copy recomendado: `Tenés X comprometidos en metas · Ver libre`
- hacer clickable la señal para abrir el mismo sheet en modo `libre`
- no mostrar simultáneamente dos montos grandes en la card

---

## Task 4: Refinar el relato del sheet

**Objective:** Que el usuario entienda mejor qué está viendo al entrar desde `real` o `libre`.

**Files:**
- Modify: `components/dashboard/DisponibleRealSheet.tsx`

**Implementation notes:**
- modo `real`: headline y bloque resaltado en `Disponible real`
- modo `libre`: headline y bloque resaltado en `Disponible libre`
- si `comprometidoMetas = 0`, mantener copy clara de que hoy ambos coinciden
- reforzar explicación: tarjetas = obligación ya causada, metas = decisión de ahorro dentro de caja

---

## Task 5: Verificación real

**Objective:** Confirmar que la UX queda más limpia y que no se rompe el flujo actual.

**Files:**
- No code required unless verification finds issues

**Run:**
- `PATH=/usr/local/bin:$PATH npm test`
- `PATH=/usr/local/bin:$PATH npx eslint components/dashboard/DashboardShell.tsx components/dashboard/DisponibleRealSheet.tsx`
- `PATH=/usr/local/bin:$PATH npm run build`

---

## Verification checklist

- [ ] Si no hay metas comprometidas, Home no muestra `Libre hoy`.
- [ ] Si hay metas comprometidas, Home muestra una señal discreta hacia `Disponible libre`.
- [ ] El monto principal de la card sigue siendo uno solo.
- [ ] Tap principal abre sheet en modo `real`.
- [ ] CTA de `Ver libre` abre sheet en modo `libre`.
- [ ] El sheet mantiene breakdown completo pero cambia foco/copy según modo.
- [ ] Tests, lint de archivos tocados y build pasan con Node 20.
