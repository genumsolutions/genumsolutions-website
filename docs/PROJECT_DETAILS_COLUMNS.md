# Project detail columns (promoting `import_meta.projectDetails`)

Status: **migration written, not applied.** Until it is applied, both clients keep
reading and writing the JSON block and nothing here changes behaviour.

## Why this exists

On 2026-11-18 the admin Projects tab became hierarchical: **Catalog · Categories ·
Pricing · Software & features · 3D materials · Coding procedure**. Pricing already
had a table (`project_pricing`, one row per package). The other three new blocks —
code details, 3D material details, coding procedure — had no home and no DDL access
was available, so they were written into `products.import_meta` under
`projectDetails`:

```
import_meta = {
  ...import provenance (sourceSite, creator, structuredSpecs, …),
  projectDetails: {
    code:      { language, repositoryUrl, libraries, notes },
    material:  { printer, filament, layerHeight, infill, printTime, notes },
    procedure: { steps: string[], notes },
  },
}
```

That worked because both clients write `import_meta` whole (`productToRow` in
`lib/content-store.ts` here and in `mobile/src/services/adminService.ts` in the
app), so the shape round-tripped with no schema change. The cost is real, though:
`import_meta` is import provenance, so nothing validates it, no constraint can
guard it, staff cannot filter on it without a JSON path, and a bad write from an
import is indistinguishable from an edit in the console.

`supabase/migrations/20261118180000_project_details_columns.sql` gives the three
blocks real columns.

## The columns

| Column                          | Type  | Default | Source in the JSON block |
| ------------------------------- | ----- | ------- | ------------------------ |
| `project_code_language`         | text  | `''`    | `code.language`          |
| `project_code_repository`       | text  | `''`    | `code.repositoryUrl`     |
| `project_code_libraries`        | text  | `''`    | `code.libraries`         |
| `project_code_notes`            | text  | `''`    | `code.notes`             |
| `project_material_printer`      | text  | `''`    | `material.printer`       |
| `project_material_filament`     | text  | `''`    | `material.filament`      |
| `project_material_layer_height` | text  | `''`    | `material.layerHeight`   |
| `project_material_infill`       | text  | `''`    | `material.infill`        |
| `project_material_print_time`   | text  | `''`    | `material.printTime`     |
| `project_material_notes`        | text  | `''`    | `material.notes`         |
| `project_procedure_steps`       | jsonb | `'[]'`  | `procedure.steps`        |
| `project_procedure_notes`       | text  | `''`    | `procedure.notes`        |

Text columns default to `''` rather than null so "cleared by staff" and "never
set" stay the same thing — the same rule the rest of `products` follows. Steps are
jsonb (an array of strings) to match `objectives` / `materials_required`, with a
`products_project_procedure_steps_is_array` check constraint so the readers can
assume an array.

The migration is additive and idempotent (`add column if not exists`, and every
backfill assignment is "keep the column if it already has a value"). It does **not**
delete `import_meta.projectDetails`.

## Applying it

1. Run the migration. `npm run db:apply` only applies `supabase/schema.sql` —
   it does **not** walk `supabase/migrations/`, so it adds the columns but
   performs no backfill. To get the backfill, run the migration file itself with
   a connection string (`SUPABASE_DB_URL` in `.env.local`):

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20261118180000_project_details_columns.sql
   ```

   or paste the file into the Supabase SQL Editor. Either way it is safe to run
   twice, and `npm run db:apply` afterwards is a no-op for these columns.

   Note: `npm run db:drift` compares the live database against `schema.sql`, and
   `schema.sql` already carries the columns, so **drift now reports them as
   missing until this migration runs**. That is the intended signal, not a
   regression — do not "fix" it by removing the lines from `schema.sql`.

2. Deploy the **reader first**: prefer a column when it has a value, fall back to
   `import_meta.projectDetails`, and fall back again to the blank shape. Both
   clients already share that fallback logic shape in one module each, so this is
   a change to two files, not to any screen.
3. Deploy the **writer**: write the columns _and_ keep writing the JSON copy for
   one release, so an older client (or an old OTA bundle still in the field) does
   not lose data it cannot see.
4. Verify (below), then remove the JSON write and finally the JSON copy.

### Code touch points

The block is read and written through one module per client, by design, so the
swap is contained:

| Client  | Module (reader/writer)                | Row mapping                                                                    | UI consumers                                |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| Website | `lib/project-details.ts`              | `lib/content-store.ts` (`rowToProduct`, `productToRow`)                        | `components/admin/AdminProjectPackages.tsx` |
| App     | `mobile/src/config/projectDetails.ts` | `mobile/src/services/adminService.ts`, `mobile/src/services/productService.ts` | `mobile/src/screens/AdminScreen.tsx`        |

Nothing outside those modules knows where the data lives. `readProjectDetails`
and `writeProjectDetails` keep their signatures; only their input changes from the
`importMeta` bag to the product row, plus a fallback read of the bag.

## Verification

After step 1 (backfill only), in the SQL Editor:

```sql
-- 1. Rows that carried the JSON block but got no columns: expect 0.
select count(*) from public.products
where import_meta #> '{projectDetails}' is not null
  and project_code_language = ''
  and project_material_printer = ''
  and project_procedure_notes = ''
  and jsonb_array_length(project_procedure_steps) = 0;

-- 2. Spot-check a known package against its JSON copy: the two should match.
select id, name,
       project_code_language, import_meta #>> '{projectDetails,code,language}' as json_language,
       project_material_printer, import_meta #>> '{projectDetails,material,printer}' as json_printer,
       jsonb_array_length(project_procedure_steps) as steps,
       jsonb_array_length(coalesce(import_meta #> '{projectDetails,procedure,steps}', '[]')) as json_steps
from public.products
where import_meta #> '{projectDetails}' is not null
order by updated_at desc
limit 10;

-- 3. Re-running the migration must not change anything (idempotence).
```

After the reader/writer swap, the admin check is: edit a package's Code details /
3D materials / Coding procedure in **both** consoles, reload, and confirm the
values survive a round trip and appear in the other client — that is the only real
proof the two writers agree.

## Rollback

The columns are additive, so the safe rollback needs no data restore:

```sql
alter table public.products drop constraint if exists products_project_procedure_steps_is_array;
alter table public.products
  drop column if exists project_code_language,
  drop column if exists project_code_repository,
  drop column if exists project_code_libraries,
  drop column if exists project_code_notes,
  drop column if exists project_material_printer,
  drop column if exists project_material_filament,
  drop column if exists project_material_layer_height,
  drop column if exists project_material_infill,
  drop column if exists project_material_print_time,
  drop column if exists project_material_notes,
  drop column if exists project_procedure_steps,
  drop column if exists project_procedure_notes;
```

Only do that while the clients still read `import_meta.projectDetails` — which is
the current state. Once the readers prefer columns, dropping them silently blanks
those six blocks in the console, so roll the code back first.

## Notes

- `schema.sql` carries the same column adds so a fresh database converges without
  needing the backfill (there are no legacy rows to translate). The backfill lives
  in the migration only.
- The old reader/writer modules still describe the JSON layout in their header
  comments; update those comments in the same commit as the code swap, not before.
