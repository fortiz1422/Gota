-- Editing was exposed by the UI, but no UPDATE policy existed in production.
-- Keep RLS enabled, limit edits to the owner, and require owned funding accounts.
create policy transfers_update on public.transfers
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.accounts a
    where a.id = from_account_id and a.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.accounts a
    where a.id = to_account_id and a.user_id = (select auth.uid())
  )
);
