-- Corrective: finish the car-label title-casing for self-balancing.
--
-- FOUND BY AUDIT (2026-10-01): migration 20261001130000 title-cased the `car`
-- column for seven modes but never touched 'self-balancing', so that one row
-- kept the old style. The result was a split-brain label:
--
--   database          "Self-balancing"   <- lowercase b
--   app catalogue     "Self-Balancing"   <- capital B (owner decision)
--   app test          expects "Self-Balancing"
--
-- The owner decision (2026-10-01) was "each word capitalised, spaces between
-- words", applied to all nine modes, and 20261001130000's own comment lists
-- the pre-state as including "Self-balancing" - so the omission was an
-- oversight in that migration, not a deliberate exception. This corrects the
-- DATABASE, not the app, so all three agree.
--
-- Why the database must be the side that moves: robo_car_modes is the
-- website-editable display catalogue and the app reads it DB-first. If the
-- app bundled copy were changed to match the stale row instead, the very next
-- online load would reintroduce the old label, and the app's own test would
-- fail. The row is the outlier.
--
-- Idempotent: a re-run is a no-op, because the guard only updates the row
-- when it does not already hold the corrected value.

update public.robo_car_modes
   set car = 'Self-Balancing'
 where id = 'self-balancing'
   and car is distinct from 'Self-Balancing';
