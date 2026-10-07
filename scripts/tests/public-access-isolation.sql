-- Run only in a verified Gota database. Synthetic fixtures always ROLLBACK.
-- Assumes docs/supabase-public-access-hardening.sql has been applied in this
-- transaction or in the deployment. Never selects another real user's records.
BEGIN;
INSERT INTO auth.users (id,aud,role,is_anonymous) VALUES
 ('b8010fa0-0000-4000-8000-000000000001','authenticated','authenticated',true),
 ('b8010fa0-0000-4000-8000-000000000002','authenticated','authenticated',true);
INSERT INTO public.monthly_income (user_id,month,amount_ars) VALUES
 ('b8010fa0-0000-4000-8000-000000000001','2026-10-01',1000),
 ('b8010fa0-0000-4000-8000-000000000002','2026-10-01',2000);
INSERT INTO public.expenses (user_id,amount,currency,category,description,payment_method,date) VALUES
 ('b8010fa0-0000-4000-8000-000000000001',101,'ARS','Otros','Synthetic isolation A','CASH','2026-10-06'),
 ('b8010fa0-0000-4000-8000-000000000002',202,'ARS','Otros','Synthetic isolation B','CASH','2026-10-06');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b8010fa0-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"b8010fa0-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',true);
DO $$
DECLARE own json; other json; row_count integer;
BEGIN
  IF NOT row_security_active('public.expenses') THEN RAISE EXCEPTION 'RLS not active'; END IF;
  own := public.get_dashboard_data('b8010fa0-0000-4000-8000-000000000001','2026-10-01','ARS');
  other := public.get_dashboard_data('b8010fa0-0000-4000-8000-000000000002','2026-10-01','ARS');
  IF (own->'saldo_vivo'->>'gastos_percibidos')::numeric <> 101 THEN RAISE EXCEPTION 'Own calculation changed'; END IF;
  IF (other->'saldo_vivo'->>'gastos_percibidos')::numeric <> 0 THEN RAISE EXCEPTION 'Cross-user dashboard leaked'; END IF;
  SELECT count(*) INTO row_count FROM public.detect_duplicate_expenses('b8010fa0-0000-4000-8000-000000000001',101,'Otros','2026-10-06');
  IF row_count <> 1 THEN RAISE EXCEPTION 'Own duplicate lookup failed'; END IF;
  SELECT count(*) INTO row_count FROM public.detect_duplicate_expenses('b8010fa0-0000-4000-8000-000000000002',202,'Otros','2026-10-06');
  IF row_count <> 0 THEN RAISE EXCEPTION 'Cross-user duplicate lookup leaked'; END IF;
  SELECT count(*) INTO row_count FROM public.user_active_cards WHERE user_id='b8010fa0-0000-4000-8000-000000000002';
  IF row_count <> 0 THEN RAISE EXCEPTION 'Cross-user legacy card view leaked'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon','public.get_dashboard_data(uuid,date,character varying)','EXECUTE') THEN RAISE EXCEPTION 'Public RPC still executable'; END IF;
  IF has_function_privilege('anon','public.detect_duplicate_expenses(uuid,numeric,character varying,date)','EXECUTE') THEN RAISE EXCEPTION 'Public duplicate lookup still executable'; END IF;
END $$;
ROLLBACK;
