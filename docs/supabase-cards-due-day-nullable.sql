-- Entrega 1 — cards.due_day nullable, sin DEFAULT 10.
-- Aplicar SOLO en staging. No aplicar en producción sin OK explícito de Facundo.
-- No modifica filas de cards: no hay UPDATE ni DELETE. Los vencimientos ya guardados
-- quedan como están, sean reales o heredados del default viejo.
--
-- Reversible: ver el bloque DOWN al final. El DOWN no rellena NULL con 10.
-- Si ya existen due_day NULL, el DOWN no vuelve a poner NOT NULL.

-- UP
ALTER TABLE public.cards ALTER COLUMN due_day DROP NOT NULL;
ALTER TABLE public.cards ALTER COLUMN due_day DROP DEFAULT;

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS statement_answer text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS statement_resolved text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS statement_ask_after date;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS post_close_expenses text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_statement_answer_check'
  ) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_statement_answer_check
      CHECK (statement_answer IS NULL OR statement_answer IN ('yes', 'no', 'unknown'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_statement_resolved_check'
  ) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_statement_resolved_check
      CHECK (statement_resolved IS NULL OR statement_resolved IN ('paid'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_post_close_expenses_check'
  ) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_post_close_expenses_check
      CHECK (post_close_expenses IS NULL OR post_close_expenses IN ('none', 'done'));
  END IF;
END $$;

-- DOWN
-- ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_statement_answer_check;
-- ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_statement_resolved_check;
-- ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_post_close_expenses_check;
-- ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_answer;
-- ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_resolved;
-- ALTER TABLE public.cards DROP COLUMN IF EXISTS statement_ask_after;
-- ALTER TABLE public.cards DROP COLUMN IF EXISTS post_close_expenses;
-- ALTER TABLE public.cards ALTER COLUMN due_day SET DEFAULT 10;
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM public.cards WHERE due_day IS NULL) THEN
--     RAISE EXCEPTION 'due_day has NULLs; refusing to restore NOT NULL without rewriting card rows';
--   END IF;
--   ALTER TABLE public.cards ALTER COLUMN due_day SET NOT NULL;
-- END $$;
