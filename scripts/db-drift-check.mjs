#!/usr/bin/env node
// =====================================================================
// db:drift — compare the LIVE Supabase database against supabase/schema.sql.
//
// Why this exists (2026-11-12): the project was moved to a new Supabase ref on
// 2026-11-07 and re-provisioned only partially. Six of the schema's 39 tables
// existed, `profiles.tier` was missing, and because both clients asked for
// `tier` in the same select as `role`, every staff/admin account resolved as a
// customer and signed-in users were shown the "create account" form. Nothing
// in the test suite noticed: tests/db-contract.test.ts only checks table names
// mentioned in source, not the deployed database.
//
// This script checks the deployed database itself, table by table and column by
// column, using PostgREST (no DB password needed). Missing table -> 404
// (PGRST205); missing column -> 400 (42703/PGRST204).
//
// Usage:
//   npm run db:drift                # exits 1 on any missing table/column
//   npm run db:drift -- --verbose   # also list every table that passed
//
// Credentials: reuses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (preferred, so RLS/grants can't hide a table) or the anon key from .env.local.
// =====================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match?.[1]) continue;
      const key = match[1];
      const value = (match[2] || "").replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // No .env.local: rely on the real environment (CI).
  }
}

// Split SQL on top-level semicolons only: skips comments, quoted strings and
// $$ function bodies (same rules the one-off provisioning run used).
function splitStatements(text) {
  const out = [];
  let i = 0;
  let start = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "-" && text[i + 1] === "-") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl + 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < text.length) {
        if (text[i] === quote) {
          if (text[i + 1] === quote) {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "$") {
      const tag = /^\$[a-zA-Z_]*\$/.exec(text.slice(i));
      if (tag) {
        const end = text.indexOf(tag[0], i + tag[0].length);
        i = end === -1 ? text.length : end + tag[0].length;
        continue;
      }
    }
    if (ch === ";") {
      out.push(text.slice(start, i));
      i++;
      start = i;
      continue;
    }
    i++;
  }
  out.push(text.slice(start));
  return out
    .map((s) => s.replace(/^\s*(?:--[^\n]*\n\s*)*/, "").trim())
    .filter((s) => s && !s.split("\n").every((line) => line.trim().startsWith("--")));
}

function withoutComments(text) {
  return text.replace(/--[^\n]*/g, "");
}

// Index of the ")" matching the "(" at `open`, respecting quotes and nesting.
function matchingParen(text, open) {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < text.length) {
        if (text[i] === quote) {
          if (text[i + 1] === quote) {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

// Split a column list on top-level commas (type args contain commas too).
function splitColumns(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < body.length) {
        if (body[i] === quote) {
          if (body[i + 1] === quote) {
            i += 2;
            continue;
          }
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

/** @returns {Map<string, Set<string>>} table -> expected column names */
function parseSchema(sql) {
  const tables = new Map();
  const ensure = (name) => {
    if (!tables.has(name)) tables.set(name, new Set());
    return tables.get(name);
  };

  for (const raw of splitStatements(sql)) {
    const stmt = withoutComments(raw).trim();

    const created =
      /^create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?[A-Za-z_][\w$]*"?)\s*\(/i.exec(
        stmt
      );
    if (created) {
      const name = created[1].replace(/"/g, "");
      const open = stmt.indexOf("(", created.index + created[0].length - 1);
      const close = matchingParen(stmt, open);
      if (close === -1) continue;
      const columns = ensure(name);
      for (const entry of splitColumns(stmt.slice(open + 1, close))) {
        const first = /^\s*("?[A-Za-z_][\w$]*"?)/.exec(entry);
        if (!first) continue;
        const token = first[1].replace(/"/g, "");
        if (/^(constraint|primary|unique|check|foreign|exclude|like)$/i.test(token)) continue;
        columns.add(token);
      }
      continue;
    }

    const altered =
      /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?("?[A-Za-z_][\w$]*"?)\s+([\s\S]+)$/i.exec(
        stmt
      );
    if (altered) {
      const name = altered[1].replace(/"/g, "");
      for (const added of altered[2].matchAll(
        /add\s+column\s+(?:if\s+not\s+exists\s+)?("?[A-Za-z_][\w$]*"?)/gi
      )) {
        ensure(name).add(added[1].replace(/"/g, ""));
      }
    }
  }
  return tables;
}

async function main() {
  loadEnvFile();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(
    /\/+$/,
    ""
  );
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  const key = serviceKey || anonKey;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY / anon key.\n" +
        "Add them to .env.local (or the environment) and retry."
    );
    process.exit(2);
  }

  const schemaPath = join(process.cwd(), "supabase", "schema.sql");
  const expected = parseSchema(readFileSync(schemaPath, "utf8"));
  const ref = new URL(url).host.split(".")[0];
  const verbose = process.argv.includes("--verbose");

  console.log(
    `Schema drift check — ${ref} vs supabase/schema.sql\n` +
      `Expecting ${expected.size} tables, ${[...expected.values()].reduce((n, c) => n + c.size, 0)} columns ` +
      `(auth: ${serviceKey ? "service role" : "anon key"})\n`
  );

  const missingTables = [];
  const missingColumns = [];
  const unreadable = [];
  const problems = [];

  for (const [table, columns] of [...expected.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const select = [...columns].map((c) => `"${c}"`).join(",");
    const endpoint = `${url}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(
      select
    )}&limit=0`;

    let res;
    try {
      res = await fetch(endpoint, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
    } catch (err) {
      problems.push(`${table}: network error (${err?.message || err})`);
      continue;
    }

    if (res.ok) {
      if (verbose) console.log(`  ok  ${table} (${columns.size} columns)`);
      continue;
    }

    const body = await res.text();
    const missingColumn = /column\s+(?:[\w"]+\.)?("?[\w$]+"?)\s+does not exist/i.exec(body);
    const pgrstColumn = /Could not find the '([\w$]+)' column/i.exec(body);

    if (missingColumn || pgrstColumn) {
      const column = (missingColumn?.[1] || pgrstColumn?.[1] || "").replace(/"/g, "");
      missingColumns.push(`${table}.${column}`);
      continue;
    }
    if (res.status === 404 || /PGRST205/.test(body)) {
      missingTables.push(table);
      continue;
    }
    // 401/403 = table exists but this key cannot read it (e.g. device_relay_tokens
    // revokes anon/authenticated). Not drift, but the columns can't be checked.
    if (res.status === 401 || res.status === 403 || /42501/.test(body)) {
      unreadable.push(table);
      continue;
    }
    problems.push(`${table}: HTTP ${res.status} ${body.replace(/\s+/g, " ").slice(0, 180)}`);
  }

  for (const column of missingColumns) {
    const [table] = column.split(".");
    console.log(`  MISSING COLUMN  ${column}   (${table})`);
  }
  for (const table of missingTables) console.log(`  MISSING TABLE   ${table}`);
  for (const table of unreadable) console.log(`  unreadable      ${table} (columns not checked)`);
  for (const problem of problems) console.log(`  ERROR           ${problem}`);

  const failed = missingTables.length + missingColumns.length + problems.length;
  if (failed) {
    console.log(
      `\nDRIFT: ${missingTables.length} missing table(s), ${missingColumns.length} missing column(s), ` +
        `${problems.length} error(s). Apply supabase/schema.sql (npm run db:apply, or see ` +
        `TRACKS/DB-PROVISIONING.md).`
    );
    process.exit(1);
  }

  console.log(
    `\nOK: all ${expected.size} tables present` +
      (missingColumns.length ? "" : " with every schema.sql column") +
      (unreadable.length ? ` (${unreadable.length} unreadable table(s) skipped)` : "") +
      "."
  );
}

export { parseSchema, splitStatements };

// Only run when executed directly, so tests can import the parser.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(`Drift check failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}
