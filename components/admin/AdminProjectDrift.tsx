"use client";

import { useEffect, useState } from "react";
import type { ProjectDetailDrift } from "../../lib/project-details";
import { EmptyState, LoadingRow, PanelCard, panelTitle } from "./admin-helpers";

// =====================================================================
// AdminProjectDrift — visibility for the project-details dual-write rollout.
//
// While both the `project_*` columns and `import_meta.projectDetails` are
// written, an old app bundle edits only the JSON copy and the console reads
// the column, so the two can silently disagree. This panel lists exactly those
// packages. Before the migration it reports "columns not present" instead of
// showing every package as drifted.
//
// Read-only on purpose: there is no safe automatic winner, because either copy
// can be the newer one. Resolve by editing the package in a console, which
// rewrites both.
// =====================================================================

type DriftProduct = { id: string; name: string; drift: ProjectDetailDrift[] };

type Response = {
  columnsAvailable: boolean;
  packages: number;
  count: number;
  products: DriftProduct[];
  error?: string;
};

export default function AdminProjectDrift() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/project-detail-drift");
      const json = (await response.json().catch(() => null)) as Response | null;
      if (!response.ok || !json) {
        throw new Error(
          json?.error || `Could not check project details (HTTP ${response.status}).`
        );
      }
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not check project details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Project detail drift" className="space-y-4">
      <PanelCard>
        <h2 className={panelTitle}>Project detail copies</h2>
        <p className="mt-1 text-xs text-muted">
          Packages whose <code>project_*</code> columns disagree with the{" "}
          <code>import_meta.projectDetails</code> copy. Both are written during the rollout, so a
          mismatch means one side edited a package without the other. Fix by saving the package in a
          console — that rewrites both copies.
        </p>

        {loading ? (
          <LoadingRow className="mt-3" />
        ) : error ? (
          <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="ml-1 underline underline-offset-2"
            >
              Retry
            </button>
          </p>
        ) : !data?.columnsAvailable ? (
          <EmptyState className="mt-2">
            The project-detail columns do not exist yet, so every package reads and writes the JSON
            copy only — nothing can drift. This check becomes meaningful once the columns migration
            is applied (see docs/PROJECT_DETAILS_COLUMNS.md).
          </EmptyState>
        ) : data.products.length === 0 ? (
          <EmptyState className="mt-2">
            No drift across {data.packages} project package
            {data.packages === 1 ? "" : "s"}: both copies agree.
          </EmptyState>
        ) : (
          <>
            <p className="mt-3 text-sm font-bold text-ink">
              {data.count} package{data.count === 1 ? "" : "s"} with drift
            </p>
            <ul className="mt-2 space-y-2">
              {data.products.map((product) => (
                <li key={product.id} className="border border-line bg-white px-3 py-2">
                  <p className="text-sm font-medium text-ink">{product.name || product.id}</p>
                  <p className="font-mono text-[11px] text-muted">{product.id}</p>
                  <ul className="mt-1 space-y-1">
                    {product.drift.map((field) => (
                      <li key={field.field} className="text-xs leading-5">
                        <span className="font-bold text-ink">{field.label}</span>
                        <span className="text-muted">
                          {" "}
                          · column <span className="font-mono">{field.column || "—"}</span> · JSON{" "}
                          <span className="font-mono">{field.json || "—"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </PanelCard>
    </section>
  );
}
