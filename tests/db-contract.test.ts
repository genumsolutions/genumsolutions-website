import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// =====================================================================
// Cross-repo database contract guard (website half).
//
// Both clients talk to ONE Supabase project, whose canonical shape is
// `supabase/schema.sql` plus `supabase/migrations/*.sql`. Every
// `supabase.from("...")` in app/, lib/ and components/ must name a table the
// schema defines — otherwise the page only fails at runtime in production.
//
// The app carries the same guard in `mobile/src/config/db-contract.test.ts`.
// =====================================================================

/** `create table [if not exists] [public.]name (` occurrences. */
function tablesIn(sql: string): string[] {
  const out: string[] = [];
  for (const match of sql.matchAll(
    /create table (?:if not exists )?(?:public\.)?(\w+)\s*\(/gi,
  )) {
    const table = match[1]?.toLowerCase();
    if (table) out.push(table);
  }
  return out;
}

/** Tables the site queries via `supabase.from("...")` / `db.from("...")`. */
function tablesUsed(): Map<string, string> {
  const used = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if ([".next", "node_modules", ".git"].includes(entry.name)) continue;
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name))
        continue;
      for (const match of readFileSync(path, "utf8").matchAll(
        /\.from\(\s*["'`](\w+)["'`]\s*\)/g,
      )) {
        const table = match[1]?.toLowerCase();
        if (table) used.set(table, path);
      }
    }
  };
  for (const dir of ["app", "lib", "components"])
    walk(resolve(__dirname, "..", dir));
  return used;
}

describe("database contract (website -> shared Supabase schema)", () => {
  it("only queries tables defined in schema.sql or a migration", () => {
    const used = tablesUsed();
    expect(used.size).toBeGreaterThan(10);

    const schemaPath = resolve(__dirname, "../supabase/schema.sql");
    const migrationsDir = resolve(__dirname, "../supabase/migrations");
    if (!existsSync(schemaPath)) return;

    const known = new Set(tablesIn(readFileSync(schemaPath, "utf8")));
    if (existsSync(migrationsDir))
      for (const file of readdirSync(migrationsDir))
        if (file.endsWith(".sql"))
          for (const table of tablesIn(
            readFileSync(join(migrationsDir, file), "utf8"),
          ))
            known.add(table);

    const unknown = [...used]
      .filter(([table]) => !known.has(table))
      .map(([table, path]) => `${table} (${path.split(/[\\/]/).pop()})`);
    expect(unknown).toEqual([]);
  });
});
