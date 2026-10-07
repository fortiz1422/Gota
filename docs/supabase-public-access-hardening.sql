-- Public-read hardening. Does not change financial records or calculation bodies.
-- Supabase project must be verified before applying. Transactional and repeatable.
BEGIN;
ALTER FUNCTION public.get_dashboard_data(uuid,date,character varying) SECURITY INVOKER;
ALTER FUNCTION public.get_dashboard_data(uuid,date,character varying) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_daily_expense_limit(uuid) SECURITY INVOKER;
ALTER FUNCTION public.check_daily_expense_limit(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.detect_duplicate_expenses(uuid,numeric,character varying,date) SECURITY INVOKER;
ALTER FUNCTION public.detect_duplicate_expenses(uuid,numeric,character varying,date) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_data(uuid,date,character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_daily_expense_limit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.detect_duplicate_expenses(uuid,numeric,character varying,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_data(uuid,date,character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_daily_expense_limit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_duplicate_expenses(uuid,numeric,character varying,date) TO authenticated, service_role;
-- The auth trigger needs its definer; browser roles never need to invoke it.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
ALTER VIEW public.user_active_cards SET (security_invoker = true);
COMMIT;
