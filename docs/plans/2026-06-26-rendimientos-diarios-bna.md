# Rendimientos diarios reconciliables — Implementation Plan

> **For Hermes:** Use test-driven-development for pure logic and keep implementation incremental because the repo has unrelated dirty files.

**Goal:** Add the foundation for BNA-style daily remunerated-account yields: capped expected yield, CSV import of real daily credits, daily reconciliation rows, and monthly accumulator compatibility with the existing Home.

**Architecture:** Keep the existing `yield_accumulator` monthly surface for current dashboard/feed compatibility, but add daily rows (`yield_daily_entries`) as source detail. Account settings get provider/cap/check-in fields while `daily_yield_rate` remains the current TNA for backwards compatibility. Pure calculation/parser code lives in `lib/yield-daily.ts` and is covered by Vitest.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Vitest.

---

## Phase 1 — Pure domain logic

- Add `lib/yield-daily.ts` with:
  - capped daily yield calculation;
  - BNA CSV parser for `RENDIMIENTO DIARIO PESOS`;
  - expected-vs-actual reconciliation status;
  - monthly sum helper.
- Add `lib/yield-daily.test.ts` first and verify RED/GREEN.

## Phase 2 — Schema/types foundation

- Extend `accounts` with:
  - `daily_yield_provider`;
  - `daily_yield_cap_amount`;
  - `daily_yield_checkin_interval_days`;
  - `daily_yield_last_checkin_at`.
- Add `yield_daily_entries` table with one row per account/date.
- Add `statement_imports` and `statement_import_rows` for traceability.
- Update `types/database.ts` manually to match schema.

## Phase 3 — Engine compatibility

- Update `lib/yieldEngine.ts` to use the cap-aware helper.
- Keep writing `yield_accumulator` so existing dashboard/feed behavior continues working.

## Phase 4 — BNA CSV import endpoint

- Add `POST /api/yield-import/bna` accepting JSON `{ account_id, csv }`.
- Parse yield rows.
- Upsert `yield_daily_entries` as real imported rows.
- Upsert monthly `yield_accumulator` totals from actual imported daily rows.
- Return imported count, matched/difference counts, inferred TNA suggestion when possible.

## Phase 5 — Settings UI

- Extend `AccountBottomSheet` yield config with provider and cap amount.
- Copy should explain estimate-vs-real import.

## Verification

- `npm test -- lib/yield-daily.test.ts`
- targeted TypeScript check: `npx tsc --noEmit`
- if feasible after unrelated dirty files: `npm run lint`
