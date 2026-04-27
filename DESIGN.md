# Gota Design - Resumen descriptivo, no fuente de verdad

> Fuente visual vigente: `docs/design-system-final.md` + `app/globals.css`.

# Gota Design

## UI Patterns And Component Structure

## Overall UI Direction

The frontend is clearly mobile-first and optimized for a single-column, thumb-friendly experience. Repeated design patterns across the app include:

- fixed bottom tab bar
- floating bottom input and action surfaces
- bottom sheets and modal drawers
- rounded "glass" cards with blur and semi-transparent white surfaces
- compact typography with a strong label/meta system
- one-primary-number hero sections

The app is not using a formal component kit like shadcn/ui. Instead, it has a custom visual language implemented directly in Tailwind classes and shared primitives.

## Key Structural Patterns

### 1. Dashboard-Led Navigation

Primary tabs:

- Home
- Movimientos
- Análisis

Settings and instruments are secondary destinations reached from the dashboard or explicit links rather than top-level tabs.

### 2. Bottom Sheet Modals

The main interaction pattern for create/edit flows is the shared `Modal` component. It renders as:

- bottom-aligned on mobile
- centered card on larger screens
- portal-based
- backdrop-dismissable
- scroll-locking

This pattern is used for income entry, transfers, subscriptions, instrument creation and management, recurring-income management, and card payment prompts.

### 3. Collapsible Settings Cards

Settings use `CollapsibleSection` as a repeated pattern:

- summary when collapsed
- detailed controls when expanded
- glass card appearance
- lightweight state handled inside the component

### 4. Mixed Server/Client Screen Composition

Pages usually:

- fetch initial data server-side for auth and first render
- hand off to client components for interactivity and mutation flows

## Design System And Conventions

## Visual Tokens

The design system is defined primarily in `app/globals.css` and mirrored in `lib/design-tokens.ts`.

Main conventions:

- light mode only
- cool blue/gray palette
- large rounded radii
- translucent white glass surfaces
- dark text with soft muted secondary labels
- blue as the primary action color
- green for positive money states
- orange for warnings and wants
- red for danger

## Typography

Fonts:

- `DM Sans` as primary UI font
- `Geist` as fallback/additional font variable

Utility scale includes named classes such as:

- `type-label`
- `type-meta`
- `type-body`
- `type-amount`
- `type-month`
- `type-title`
- `type-hero`

## Surface System

Three glass elevation utilities exist:

- `glass-1`: base pills and rows
- `glass-2`: cards and panels
- `glass-3`: floating elements like nav and sheets

Fallbacks for browsers without backdrop-filter are also present.

## Motion

Motion is used sparingly and functionally:

- skeleton shimmer
- modal/bottom-sheet slide-up
- hero number toggle transition
- progress-bar grow animation

There is explicit reduced-motion handling.

## Iconography

The UI relies heavily on Phosphor icons for product semantics:

- finance objects like cards, wallets, banks, trends
- navigation and action affordances
- category icons for expenses

## User Flows For Main Use Cases

### 1. First-Time Setup

1. User signs in with Google or anonymously.
2. If onboarding is incomplete, the user can enter the onboarding flow.
3. The app teaches the `Saldo Vivo` concept.
4. The user creates a primary account.
5. The user records initial balances.
6. The user can register a first expense through natural-language input.
7. `onboarding_completed` is stored and the user is sent to the dashboard.

### 2. Daily Expense Logging

1. User lands on the dashboard.
2. User types a natural-language expense into `SmartInput`.
3. `/api/parse-expense` calls Gemini and returns structured data.
4. `ParsePreview` lets the user confirm or adjust before save.
5. Expense is created through `/api/expenses`.
6. Dashboard and recent movements refresh.

### 3. Checking Real Available Money

1. User opens the home dashboard.
2. Hero shows `Saldo Vivo`.
3. User can switch to `Disponible Real`.
4. User can open detail sheets to inspect the number.
5. User can change month or visible currency.

### 4. Managing Monthly Operations

From the dashboard plus-button, the user can open lightweight sheets to add:

- an income
- a subscription
- installment purchases already in progress
- a transfer
- an instrument, if enabled

### 5. Reviewing Transaction Activity

1. User opens `Movimientos`.
2. The app shows a merged operational ledger.
3. User can filter by movement type and categories.
4. Movements are grouped by day.
5. The user can delete certain income and transfer items directly from the recent list.

### 6. Reviewing Spending Behavior

1. User opens `Análisis`.
2. The app starts in `Diario` mode with a generated hero headline and chips.
3. User can switch to `Análisis` mode for deeper behavioral views.
4. User can drill into `Fuga Silenciosa`, `Mapa de Hábitos`, and `Compromisos`.
5. User can export expenses to CSV.

### 7. Account And Card Setup

1. User opens Settings.
2. User changes default currency, manages accounts, manages cards, and toggles rollover.
3. Accounts are edited through a bottom sheet.
4. Cards expand inline for date/account configuration.

## Design Observations And Inconsistencies

- The visual system is cohesive and more mature than the operational hardening of the codebase.
- The app is designed around a mobile PWA mental model even though it is technically a web app.
- Some older flows still exist in code but are not clearly part of the current design language, especially the legacy monthly-income configuration components.
- Several strings in source files contain encoding issues; this is a quality risk because the product tone matters heavily in this UI.
