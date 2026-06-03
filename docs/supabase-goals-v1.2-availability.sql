-- Goals v1.2 — availability + integridad incremental
-- Ejecutar después de goals v1 si la tabla ya existe en producción.

ALTER TABLE goal_contributions
  ADD COLUMN IF NOT EXISTS source_account_id UUID NULL REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS availability_effect VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS destination_kind VARCHAR(20) NULL;

ALTER TABLE goal_contributions
  DROP CONSTRAINT IF EXISTS goal_contributions_availability_effect_check,
  ADD CONSTRAINT goal_contributions_availability_effect_check
    CHECK (availability_effect IN ('none', 'committed_only', 'moved_out'));

ALTER TABLE goal_contributions
  DROP CONSTRAINT IF EXISTS goal_contributions_destination_kind_check,
  ADD CONSTRAINT goal_contributions_destination_kind_check
    CHECK (destination_kind IS NULL OR destination_kind IN ('same_account', 'tracked_account', 'external_pot', 'virtual_pot'));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_goal_contributions_transfer_linked_once
  ON goal_contributions(user_id, related_transfer_id)
  WHERE source_type = 'transfer_linked' AND related_transfer_id IS NOT NULL;
