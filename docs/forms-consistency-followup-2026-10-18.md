# Form consistency follow-up

The card editor had a white navigation area and bottom strip around a different canvas. Some forms also pinned their submit action independently of the fields. This follow-up makes opted-in form surfaces own their canvas and browser chrome, puts submit after the fields where the proposal uses a content action, and keeps Budget's fixed action.

## Scope

- Income and transfer create/edit, account create/edit, Settings subscription create/edit, and goal create/edit use content actions. Card submit remains inside its form after the last question; Archive is a separate secondary action above the form.
- Card list and editor use the R surface. Nested surfaces restore the parent's canvas and theme color, then restore the original document colors when closed.
- Blue form headers share the existing primary/deep tokens. Opted-in legacy blue forms fill the mobile viewport and respect its safe area.
- Large amount inputs fit their complete formatted value. Budget rows wrap when needed. Parsing and financial calculations remain in their existing callers.
- Pending saves block dismissal. Form controls gain explicit accessible names; account deletion has a visible field and keyboard focus; viewport zoom is enabled.
- Goal detail places Edit next to its name and the amount above progress.

## Validation and limits

Use the regression suite plus `e2e/forms/consistency.spec.ts` at 320, 390, 768 and 1440 px. API fixtures use synthetic data; they verify payloads, errors, duplicate-save prevention, dismissal, content action placement, nested canvas restoration and amount visibility. Development fixture routes remain unavailable in production.

Browser captures verify Chromium layouts. They do not establish physical iPhone Safari/standalone PWA safe-area or keyboard behavior. Full-site AA compliance and pixel identity to all original mockups are not claimed. The existing font system and native date/select controls remain.

## Release

No schema or data migration. Rollback is a revert of this follow-up to `ccb9ce343b091f5191638b8246c6b73b3e031f24`. Recheck card editing, the ten content action forms, Budget and legacy amount forms on a physical iPhone after deployment. Screenshots are kept outside the public repository.
