# Account balance reconciliation — draft MVP

This additive feature records balance observations separately from explanations. A gap is not classified as an expense or income: it can reflect an omitted own transfer, yield, an incorrect opening balance, or an actual cash movement. Only evidenced movements improve expense/income analytics.

## Financial representation

- One workspace per owner/account/currency, with integer minor-unit checkpoints, signed adjustments, resolution links, reversals, and a recoverable draft.
- Confirm records an observation only. Later keeps it unposted. Adjust posts only the remaining gap, after checking that the observed ledger has not changed.
- Native ledger + sum(adjustment amount − active linked effects) determines the operational balance. Manual closure stops explanation work and retains the money correction.
- A real expense or income and its compensating resolution are saved in the same SQL transaction. Previously recorded evidence can be explicitly linked. No amount-only matching or LLM closes a gap.
- Dates crossing months remain an interval until a real movement supplies its date. Unknown dates stay drafts. Same-day evidence requires an explicit before-confirmation assertion. Evidence at/before the last exact checkpoint is rejected conservatively.
- Checkpoints freeze known movement IDs; existing entries cannot be used to explain a gap they already influenced. New observations do not sum previously unposted gaps.
- Ledger mutation triggers use the same per-user advisory lock as existing expense ingestion. Financial edits/deletes of linked evidence require unlinking first. Accounts with a nonzero correction cannot be archived; account deletion is restricted to preserve reconciliation history.

## User flow

Account → confirm amount → discrepancy → resolve now / adjust / later. Resolution checks available expense or income evidence according to the gap sign, then collects the missing movement one question at a time. Borrador is persisted at each completed step and locally between steps, keyed by owner/account/currency/checkpoint. After a full explanation the task closes; partial explanation remains available through the bell. Save and Continue advances to the next due account while preserving the current draft; Save and Exit returns home. Visited account IDs bound each session to one pass. A matched zero-activity account can be confirmed and finished. Adjustment history includes amount, date, partial status and remaining amount; unlinking and reversing preview the balance impact.

Saturday and month-end evening reminders are derived when loading the existing bell, in Argentina time. They merge into one task per account/currency and do not require cron. The account entry supports ARS and USD. No Home banner or new dashboard is added.

## Rollout

All switches default off. The SQL in `docs/supabase-balance-reconciliation.sql` is prepared, not automatically applied.

1. Apply and verify the additive schema in an isolated staging database. Refresh generated types after schema adoption. The income-aware save RPC has ten arguments; if a previous nine-argument draft RPC was installed, resolve that overload explicitly before adoption (fresh-schema QA does not validate upgrades).
2. Set `BALANCE_RECONCILIATION_SCHEMA_READY=true` once the schema exists. This enables reading recognized corrections even if write rollout is later disabled. **Do not unset it to roll back after money corrections have been posted.**
3. Set server `BALANCE_RECONCILIATION_ENABLED=true` to enable routes and bell tasks, and build-time `NEXT_PUBLIC_BALANCE_RECONCILIATION_ENABLED=true` for the account entry. The existing Signals Center flag is also needed for bell presentation.
4. Verify authenticated browser flow and native PostgreSQL concurrent writes before activating a personal pilot.
5. Disable the write/UI switches to stop new actions. Retain schema and correction reads. Undo links and reverse adjustments explicitly when financial reversal is intended.

## Verification

`TZ=America/Argentina/Buenos_Aires npm test`, `npx tsc --noEmit`, scoped ESLint and `npx next build --webpack` cover the implementation. The existing suite assumes Argentina calendar dates in one movements test.

`node scripts/test-balance-reconciliation-sql.mjs <PGlite-module-or-existing-test-db-provider>` executes a disposable database test: ownership, RLS/ACL, optimistic version and ledger checks, strict idempotency, malformed-state rejection, atomic expense+snapshot, linked-evidence mutation guard, archive guard and reversal. PGlite is supplied externally, as for existing SQL tests; it is not an application dependency. Single-session PGlite does not demonstrate native multi-session advisory-lock behavior.

On 2026-10-08, Chromium exercised three fictitious accounts through the actual React components, API route, current-balance query, repository RPC and prepared SQL in disposable PGlite. Eight assertions passed across the complete session, draft save/return, income creation, zero balance, linked-evidence guards, correction and reversal. Fifteen screenshots were captured. Authentication and the PostgREST adapter were synthetic; this does not verify an authenticated staging session, native PostgreSQL concurrency or an installed iOS PWA. The reconciliation suite contains 58 passing tests.

## Deliberate limits and follow-up

- The UI supports expense and income evidence/reconstruction. Existing own-transfer evidence is accepted by the deterministic API, but transfer creation/selection remains absent from this screen.
- Credit-card purchases and card-payment evidence are not linked in this MVP. Existing commitments, installments and card accounting retain their classification.
- Candidate lists are capped at the latest 100 entries for each of expenses and income. No complete interval import or subset-sum matcher is claimed.
- Financial audit is append-only for browser roles; service-role writes must remain confined to validated commands. Snapshot JSON is the additive MVP representation, not a general ledger rewrite.
- Manual closure records an unexplained correction; it does not create a historical category or assign an unknown month. An explicit report treatment for unexplained balance corrections remains future work.
- No MP schedule is activated, no Web Push is sent, and no bank-statement parser or autonomous agent is added.
- No existing personal data is backfilled or rewritten. Production migration and activation remain separate rollout actions.
