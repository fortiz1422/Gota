-- Entrega 1 — cards.due_day nullable, sin DEFAULT 10.
-- Aplicar SOLO en staging. No aplicar en producción sin OK explícito de Facundo.
-- No modifica filas de cards: no hay UPDATE ni DELETE. Los vencimientos ya guardados
-- quedan como están, sean reales o heredados del default viejo.
--
-- Reversible: docs/supabase-cards-due-day-nullable-down.sql
-- El DOWN no rellena NULL con 10. Si hay due_day NULL, aborta antes de
-- cualquier cambio y no deja el esquema a medias.

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

-- DOWN ejecutable: docs/supabase-cards-due-day-nullable-down.sql
-- BEGIN; control de NULL; recién ahí DROP de columnas, SET DEFAULT 10 y SET NOT NULL; COMMIT.
