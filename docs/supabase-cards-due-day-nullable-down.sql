-- DOWN de docs/supabase-cards-due-day-nullable.sql
-- Una sola transacción. El control de due_day NULL corre antes de cualquier cambio:
-- si hay nulos, el error aborta y no se borra nada ni se repone el default.
-- No escribe due_day = 10 en filas existentes.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cards WHERE due_day IS NULL) THEN
    RAISE EXCEPTION 'due_day has NULLs; refusing to restore NOT NULL without rewriting card rows';
  END IF;
END $$;

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_statement_answer_check;
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_statement_resolved_check;
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_post_close_expenses_check;
ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_answer;
ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_resolved;
ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_ask_after;
ALTER TABLE public.cards DROP COLUMN IF EXISTS post_close_expenses;

ALTER TABLE public.cards ALTER COLUMN due_day SET DEFAULT 10;
ALTER TABLE public.cards ALTER COLUMN due_day SET NOT NULL;

COMMIT;
