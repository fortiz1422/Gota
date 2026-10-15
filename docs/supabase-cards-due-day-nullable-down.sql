-- DOWN de docs/supabase-cards-due-day-nullable.sql
-- Revierte columnas nuevas y el default. No escribe due_day = 10 en filas existentes.
-- Si hay due_day NULL, aborta antes de restaurar NOT NULL.

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_statement_answer_check;
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_statement_resolved_check;
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_post_close_expenses_check;
ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_answer;
ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_resolved;
ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_ask_after;
ALTER TABLE public.cards DROP COLUMN IF EXISTS post_close_expenses;

ALTER TABLE public.cards ALTER COLUMN due_day SET DEFAULT 10;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cards WHERE due_day IS NULL) THEN
    RAISE EXCEPTION 'due_day has NULLs; refusing to restore NOT NULL without rewriting card rows';
  END IF;
  ALTER TABLE public.cards ALTER COLUMN due_day SET NOT NULL;
END $$;
