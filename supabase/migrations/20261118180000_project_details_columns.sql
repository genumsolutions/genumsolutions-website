-- Project detail columns.
--
-- 2026-11-18 (owner): the Projects tab is hierarchical — Category, Pricing,
-- Code details, 3D material details, Coding procedure. The last three began
-- life inside products.import_meta.projectDetails (see
-- lib/project-details.ts and the app's src/config/projectDetails.ts) because no
-- DDL access was available that day. import_meta is an import-provenance bag:
-- nothing validates it, no constraint can point at it, and a staff query cannot
-- filter on it without a JSON path. This migration promotes the blocks to real
-- columns so the data has a home with a shape.
--
-- Additive and idempotent, like 20261115180000_company_website_url.sql: safe to
-- re-run. It does NOT drop import_meta.projectDetails — the older writers keep
-- working, and the readers can fall back to the JSON copy while the fleet
-- converges. Removing the JSON copy is a separate, later migration.
--
-- Rolling this out (full steps in docs/PROJECT_DETAILS_COLUMNS.md):
--   1. Run this file itself — `npm run db:apply` only replays schema.sql and
--      would add the columns without the backfill below. Use
--      `psql "$SUPABASE_DB_URL" -f <this file>`, or paste it in the SQL Editor.
--   2. Deploy the reader that prefers a column and falls back to import_meta,
--      and the writer that writes both. Order matters: read-fallback first.
--   3. Verify with the queries at the bottom of the doc.
--   4. Only then stop writing the JSON copy.

-- ===== COLUMNS =====
-- Text defaults to '' rather than null so the admins can clear a field and the
-- app's blank-vs-missing distinction stays trivial. Steps are jsonb (an array
-- of strings) to match objectives/materials_required on this table.
alter table public.products
  add column if not exists project_code_language text not null default '',
  add column if not exists project_code_repository text not null default '',
  add column if not exists project_code_libraries text not null default '',
  add column if not exists project_code_notes text not null default '',
  add column if not exists project_material_printer text not null default '',
  add column if not exists project_material_filament text not null default '',
  add column if not exists project_material_layer_height text not null default '',
  add column if not exists project_material_infill text not null default '',
  add column if not exists project_material_print_time text not null default '',
  add column if not exists project_material_notes text not null default '',
  add column if not exists project_procedure_steps jsonb not null default '[]',
  add column if not exists project_procedure_notes text not null default '';

-- ===== BACKFILL =====
-- Only rows that actually carry the JSON block are touched. Every assignment is
-- "keep what the column already holds, else take the JSON value" — that is why
-- re-running is safe and why a column written by the new editor is never
-- clobbered by a stale import_meta copy.
update public.products
set
  project_code_language = coalesce(
    nullif(project_code_language, ''),
    import_meta #>> '{projectDetails,code,language}',
    ''
  ),
  project_code_repository = coalesce(
    nullif(project_code_repository, ''),
    import_meta #>> '{projectDetails,code,repositoryUrl}',
    ''
  ),
  project_code_libraries = coalesce(
    nullif(project_code_libraries, ''),
    import_meta #>> '{projectDetails,code,libraries}',
    ''
  ),
  project_code_notes = coalesce(
    nullif(project_code_notes, ''),
    import_meta #>> '{projectDetails,code,notes}',
    ''
  ),
  project_material_printer = coalesce(
    nullif(project_material_printer, ''),
    import_meta #>> '{projectDetails,material,printer}',
    ''
  ),
  project_material_filament = coalesce(
    nullif(project_material_filament, ''),
    import_meta #>> '{projectDetails,material,filament}',
    ''
  ),
  project_material_layer_height = coalesce(
    nullif(project_material_layer_height, ''),
    import_meta #>> '{projectDetails,material,layerHeight}',
    ''
  ),
  project_material_infill = coalesce(
    nullif(project_material_infill, ''),
    import_meta #>> '{projectDetails,material,infill}',
    ''
  ),
  project_material_print_time = coalesce(
    nullif(project_material_print_time, ''),
    import_meta #>> '{projectDetails,material,printTime}',
    ''
  ),
  project_material_notes = coalesce(
    nullif(project_material_notes, ''),
    import_meta #>> '{projectDetails,material,notes}',
    ''
  ),
  project_procedure_notes = coalesce(
    nullif(project_procedure_notes, ''),
    import_meta #>> '{projectDetails,procedure,notes}',
    ''
  ),
  -- steps: take the JSON array only when the column is still empty and the
  -- JSON value really is a non-empty array (a string or an object would fail
  -- the jsonb check constraint below).
  project_procedure_steps = case
    when jsonb_array_length(project_procedure_steps) > 0 then project_procedure_steps
    when jsonb_typeof(import_meta #> '{projectDetails,procedure,steps}') = 'array'
      then import_meta #> '{projectDetails,procedure,steps}'
    else project_procedure_steps
  end
where import_meta #> '{projectDetails}' is not null;

-- ===== GUARDS =====
-- The shape the readers assume: steps is always an array of strings. Written
-- after the backfill so a malformed legacy value cannot block the column adds.
alter table public.products
  drop constraint if exists products_project_procedure_steps_is_array;
alter table public.products
  add constraint products_project_procedure_steps_is_array
  check (jsonb_typeof(project_procedure_steps) = 'array');
