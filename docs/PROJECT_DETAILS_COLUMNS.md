# Project detail columns (promoting `import_meta.projectDetails`)

Status: **migration written, code swap shipped (reader + dual write), migration
not applied.** No database credentials exist in this environment, so the apply is
still the one outstanding step — see [Applying it](#applying-it). Until it runs,
the probe described below reports the columns missing and every save keeps using
the JSON copy exactly as before.

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

2. ~~Deploy the reader~~ — **done** (this commit on the website; app `aecd33f`). Each field
   takes the column when it has a value and `import_meta.projectDetails`
   otherwise; an empty steps column (the migration's `'[]'` default) does not
   hide a populated JSON copy. The fallback is per field, not per block, so a
   row edited on one surface while the other still writes JSON stays correct.
3. ~~Deploy the writer~~ — **done, behind a capability probe.** Saves write the
   columns _and_ keep writing the JSON copy, so an older client (or an old OTA
   bundle still in the field) does not lose data it cannot see.
4. Verify (below), then remove the JSON write and finally the JSON copy.

### The write gate

A write that names a column the database does not have fails with `42703` and
takes the **whole product save** with it — including the fields that have nothing
_to do with project details_. So neither client writes the columns
unconditionally:

```
select project_code_language from products limit 1
```

is run **once per process** (`projectDetailColumnsAvailable()`, in
`lib/content-store.ts` / `mobile/src/services/adminService.ts`), the answer is
cached, and an error counts as "not there". That makes the same deployed build
safe before and after the migration: before it, saves silently use the JSON copy;
after it, the same save starts writing both. The probe is memoised for the life
of the process, so a server instance already running when the migration executes
keeps writing JSON-only until it restarts — harmless, because the reader accepts
either.

Tests pinning this: `tests/project-details.test.ts` and
`tests/product-column-write.test.ts` (website), `src/config/projectDetails.test.ts`
and `src/services/adminService.test.ts` (app).

### What renders publicly

The three blocks are visible on the public project page
(`components/ProductDetailPro.tsx` → "Project information"), built by
`projectDetailViews` in `lib/project-details.ts`: only blocks with content are
drawn, blank rows are dropped, and procedure steps render as an ordered list.
Because it reads the merged product, it is correct on both sides of the
migration.

### Code touch points

The block is read and written through one module per client, by design, so the
swap is contained:

| Client  | Module (reader/writer)                | Row mapping                                                                    | UI consumers                                |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| Website | `lib/project-details.ts`              | `lib/content-store.ts` (`rowToProduct`, `productToRow`)                        | `components/admin/AdminProjectPackages.tsx` |
| App     | `mobile/src/config/projectDetails.ts` | `mobile/src/services/adminService.ts`, `mobile/src/services/productService.ts` | `mobile/src/screens/AdminScreen.tsx`        |

Nothing outside those modules knows where the data lives. `readProjectDetails`
takes an optional second argument (the products row) and `productToRow` takes an
optional `{ projectColumns }`; the admin screens were not changed beyond reading
the merged value off the product. On the website `rowToProduct` writes the merged
blocks back into `importMeta`, so the editor keeps seeing one shape and the next
save dual-writes without knowing about the columns.

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

The in-console companion to these queries is **Users → Diagnostics → Data
checks** (`components/admin/AdminProjectDrift.tsx` +
`app/api/admin/project-detail-drift/route.ts`). It compares every project
package's columns with its JSON copy and lists the fields that disagree — which
is precisely the state an older app bundle produces. Before the migration it
reports that the columns are absent, and it never treats an empty column as
drift (`lib/project-details.ts` → `projectDetailDrift`). Run it after the
backfill, then again before dropping the JSON copy; zero drift is the go-ahead.

One check worth doing right after the apply, before trusting the console: save a
package from each client and confirm the `project_*` columns changed (not just
`import_meta`). If they did not, the probe cached a "missing" answer before the
migration ran — restart that process.

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
- Both reader/writer module headers were updated with the swap; they now point
  here for the rollout order.
