# HISTORICO - NO VIGENTE - Gota UI Review Fix Plan

> Plan de marzo con referencias visuales anteriores. Fuente visual vigente: `docs/design-system-final.md` + `app/globals.css`.

# Gota UI Review — Fix Plan
_Generated 2026-03-10_

---

## Overview

8 issues found across the 3 dashboard pages (Home, Analytics, Settings).
Grouped into two phases: **P0 functional fixes** and **P1 visual polish**.

---

## Phase 0 — Functional / Visible Breaks

### F1 · TabBar icons: Lucide → Phosphor

**File:** `components/navigation/TabBar.tsx`

Replace `Home`, `BarChart2`, `Settings` from `lucide-react` with Phosphor equivalents:
- `Home` → `House` (duotone)
- `BarChart2` → `ChartBar` (duotone)
- `Settings` → `Gear` (duotone)

Apply `icon-duotone` class or inline the same duotone style used elsewhere
(white stroke, primary fill at 15%). Active state should use `weight="duotone"`,
inactive state `weight="regular"` or `weight="light"`.

---

### F2 · SaldoVivo icons: Lucide → Phosphor

**File:** `components/dashboard/SaldoVivo.tsx`

- `Wallet` → `Wallet` from `@phosphor-icons/react` (duotone)
- `CreditCard` → `CreditCard` from `@phosphor-icons/react` (duotone)

These sit inside the pill icon circles. Apply the same `icon-duotone` treatment
or keep the current `text-text-label` coloring if duotone is too prominent at 13px.

---

### F3 · DashboardHeader chevron: Lucide → Phosphor

**File:** `components/dashboard/DashboardHeader.tsx`

- `ChevronDown` from `lucide-react` → `CaretDown` from `@phosphor-icons/react`
- Use `weight="bold"` or `weight="regular"`, size 16, `text-text-label`

---

### F4 · Settings bottom padding too short

**File:** `app/(dashboard)/settings/page.tsx`

Change:
```tsx
<div className="mx-auto max-w-md px-6 pt-safe pb-6">
```
To:
```tsx
<div className="mx-auto max-w-md px-6 pt-safe pb-tab-bar">
```

The current `pb-6` (24px) is shorter than the tab bar height (~64px + safe area),
causing the "Eliminar cuenta" button to be partially hidden.

---

## Phase 1 — Visual Polish

### P1 · Top3 section label color

**File:** `components/dashboard/Top3.tsx`

Change `text-text-secondary` → `text-text-label` on both the populated and
empty-state section headers. `text-text-secondary` (#bae6fd) is too bright;
all other section labels use `text-text-label` (#7B98B8).

```tsx
// Before
<p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
  Top Categorías
</p>

// After — also adopt the type scale
<p className="type-label text-text-label">Top Categorías</p>
```

---

### P2 · FiltroEstoico: add section label

**File:** `components/dashboard/FiltroEstoico.tsx`

Add a label above the percentage row so first-time users understand what the
battery bar represents. Suggested label: `"Necesidad vs Deseo"` or `"Tipo de gasto"`.

```tsx
// Add before the labels div
<p className="type-label text-text-label mb-2">Tipo de gasto</p>
```

---

### P3 · Delete button in Ultimos5: raw `×` → icon

**File:** `components/dashboard/Ultimos5.tsx`

Replace the `×` character button with a Phosphor icon:

```tsx
// Before
<button ...>×</button>

// After
import { X } from '@phosphor-icons/react'
<button ...>
  <X size={14} weight="bold" />
</button>
```

Adjust sizing/color to match current styling (`text-text-disabled`, hover `text-danger`).

---

### P4 · Settings title: adopt type scale

**File:** `components/settings/SettingsPreferences.tsx`

`text-[30px] font-black tracking-tight` has no equivalent in the type scale.
Two options:

**Option A** — Use `type-month` (22px/900): matches the same weight as the month
header on other pages; settings becomes consistent with home/analytics header size.

**Option B** — Add `type-title` to the design system:
```css
/* globals.css — between type-month and type-hero */
@utility type-title {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
}
```
Then use `type-title text-text-primary` in SettingsPreferences.

**Recommendation:** Option B — keeps the visual weight of the settings page
intentional while making it part of the system. Home/Analytics headers are
purposely smaller because they show the current month, not a static page title.

---

### P5 · Outer padding standardization

Currently:
- Home: `px-4` outer + `px-2` inner → 24px total from edge
- Analytics: `px-4` outer + `px-5` inner → 36px from edge (header) / 20px (content)
- Settings: `px-6` outer → 24px total

The home and settings total padding land at 24px; analytics content at 20px.
Standardize to **20px** (`px-5`) for content sections across all pages:

| Page | Change |
|---|---|
| Home | Inner sections: `px-2` → `px-4` (edge 32px total... wait, outer is px-4 = 16px, inner px-2 = 8px, total 24px ok) |
| Analytics | Content already at `px-5` (20px). DashboardHeader wrapper `px-4 pb-2` → consistent |
| Settings | `px-6` (24px) → `px-5` (20px) on outer container |

> Note: Home outer is `px-4`; individual sections add `px-2` giving ~24px. This is fine.
> The main fix is making the Analytics content and Settings outer edge match.

---

### P6 · "Ver todos →" raw arrow → icon (optional, low priority)

**File:** `components/dashboard/Ultimos5.tsx`

```tsx
// Before
Ver todos →

// After
import { ArrowRight } from '@phosphor-icons/react'
Ver todos <ArrowRight size={11} weight="bold" className="inline" />
```

Low priority — purely cosmetic.

---

## Non-goals (deferred)

- **Month nav UX unification** (bottom sheet vs arrows) — functional parity makes this a product decision, not a pure UI fix. Settings' inline `‹ ›` is appropriate since month is a secondary control there, not the primary page context.
- **Full glass elevation adoption** — `glass-1/2/3` are defined but barely used. Adopting them would require redesigning card surfaces; too large a scope.
- **Full type scale adoption** — replacing every `text-[13px]` across all components is a large diff with marginal visual impact. Focus on the label inconsistencies (P1, P2) instead.

---

## Execution order

```
F1 → F2 → F3  (all in one commit: "fix: migrate remaining Lucide icons to Phosphor")
F4            (one-liner commit: "fix: settings bottom padding clipped by tab bar")
P1 + P2       (one commit: "polish: section label color + FiltroEstoico label")
P3            (one commit: "polish: replace × delete button with X icon")
P4            (one commit: "polish: add type-title to scale, apply in settings")
P5            (one commit: "polish: standardize outer padding across pages")
P6            (optional, bundle with P5 or skip)
```

Total: ~5–6 focused commits, no architecture changes, no new dependencies.
