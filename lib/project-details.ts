// =====================================================================
// project-details.ts — the three project-only detail blocks the admin
// console edits under Projects, and where they live.
//
// 2026-11-18 (owner): the Projects tab became hierarchical — Category,
// Pricing, Code details, 3D material details, Coding procedure. The
// first two already had homes:
//   • category  → products.project_category
//   • pricing   → project_pricing (one row per package)
// The last three are new *content* blocks. They now live in dedicated
// products columns (migration 20261118180000_project_details_columns.sql):
//
//   project_code_{language,repository,libraries,notes}
//   project_material_{printer,filament,layer_height,infill,print_time,notes}
//   project_procedure_{steps,notes}
//
// The original home — `import_meta.projectDetails` — is kept as the
// compatibility copy while both clients finish the rollout, and it is still
// what a pre-migration row only has:
//
//   import_meta = {
//     ...import provenance (sourceSite, creator, structuredSpecs, …),
//     projectDetails: {
//       code:      { language, repositoryUrl, libraries, notes },
//       material:  { printer, filament, layerHeight, infill, printTime, notes },
//       procedure: { steps: string[], notes },
//     },
//   }
//
// Rollout order (docs/PROJECT_DETAILS_COLUMNS.md): backfill → read the columns
// with a per-field JSON fallback (this file) → dual write → drop the JSON copy.
// The app keeps an identical copy of this module in
// mobile/src/config/projectDetails.ts; change both or neither.
// =====================================================================

import type { ProductImportMeta } from "./catalog";

export type ProjectCodeDetails = {
  /** Language / toolchain, e.g. "Arduino C++ (ESP32 core)". */
  language: string;
  /** Repository or firmware archive link. */
  repositoryUrl: string;
  /** Libraries / dependencies, one per line in the editor. */
  libraries: string;
  /** Free-form notes (pin mapping, flashing caveats…). */
  notes: string;
};

export type ProjectMaterialDetails = {
  printer: string;
  filament: string;
  layerHeight: string;
  infill: string;
  printTime: string;
  notes: string;
};

export type ProjectCodingProcedure = {
  /** Ordered programming/flashing steps. */
  steps: string[];
  notes: string;
};

export type ProjectDetails = {
  code: ProjectCodeDetails;
  material: ProjectMaterialDetails;
  procedure: ProjectCodingProcedure;
};

export const blankProjectDetails = (): ProjectDetails => ({
  code: { language: "", repositoryUrl: "", libraries: "", notes: "" },
  material: {
    printer: "",
    filament: "",
    layerHeight: "",
    infill: "",
    printTime: "",
    notes: "",
  },
  procedure: { steps: [], notes: "" },
});

const text = (value: unknown): string => (typeof value === "string" ? value : "");

const lines = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : [];

const bag = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * The products columns the migration adds, in schema order. Kept here (not in
 * content-store) so the reader, the writer and the migration agree on spelling.
 */
export const PROJECT_DETAIL_COLUMN_KEYS = [
  "project_code_language",
  "project_code_repository",
  "project_code_libraries",
  "project_code_notes",
  "project_material_printer",
  "project_material_filament",
  "project_material_layer_height",
  "project_material_infill",
  "project_material_print_time",
  "project_material_notes",
  "project_procedure_steps",
  "project_procedure_notes",
] as const;

/**
 * A products row as far as this module cares: any object that MAY carry the
 * columns above. Before the migration it carries none of them.
 */
export type ProjectDetailRow = Record<string, unknown> | undefined | null;

const columnText = (
  row: ProjectDetailRow,
  key: (typeof PROJECT_DETAIL_COLUMN_KEYS)[number],
  fallback: string
): string => {
  const value = row && typeof row === "object" ? row[key] : undefined;
  return typeof value === "string" && value !== "" ? value : fallback;
};

/**
 * Read projectDetails out of an importMeta bag, filling every gap.
 *
 * When a products row is passed as the second argument, each field takes the
 * column value if it has one and the JSON value otherwise. The fallback is
 * per field on purpose: a row whose columns were backfilled and then edited
 * on one surface can still carry a newer JSON copy for another field.
 */
export function readProjectDetails(
  meta: ProductImportMeta | Record<string, unknown> | undefined | null,
  columns?: ProjectDetailRow
): ProjectDetails {
  const details = bag(bag(meta).projectDetails);
  const code = bag(details.code);
  const material = bag(details.material);
  const procedure = bag(details.procedure);
  const columnSteps = columns?.project_procedure_steps;
  const jsonSteps = lines(procedure.steps);
  return {
    code: {
      language: columnText(columns, "project_code_language", text(code.language)),
      repositoryUrl: columnText(columns, "project_code_repository", text(code.repositoryUrl)),
      libraries: columnText(columns, "project_code_libraries", text(code.libraries)),
      notes: columnText(columns, "project_code_notes", text(code.notes)),
    },
    material: {
      printer: columnText(columns, "project_material_printer", text(material.printer)),
      filament: columnText(columns, "project_material_filament", text(material.filament)),
      layerHeight: columnText(columns, "project_material_layer_height", text(material.layerHeight)),
      infill: columnText(columns, "project_material_infill", text(material.infill)),
      printTime: columnText(columns, "project_material_print_time", text(material.printTime)),
      notes: columnText(columns, "project_material_notes", text(material.notes)),
    },
    procedure: {
      // An empty array in the column (the migration default) must not hide a
      // populated JSON copy, so only a non-empty array wins.
      steps: Array.isArray(columnSteps) && columnSteps.length > 0 ? lines(columnSteps) : jsonSteps,
      notes: columnText(columns, "project_procedure_notes", text(procedure.notes)),
    },
  };
}

/**
 * The columns to write for these details (snake_case, exactly the migration's
 * names). Empty strings and an empty steps array are written as-is: the columns
 * have NOT NULL defaults, and "cleared" has to be expressible.
 */
export function projectDetailColumns(details: ProjectDetails): Record<string, unknown> {
  return {
    project_code_language: details.code.language,
    project_code_repository: details.code.repositoryUrl,
    project_code_libraries: details.code.libraries,
    project_code_notes: details.code.notes,
    project_material_printer: details.material.printer,
    project_material_filament: details.material.filament,
    project_material_layer_height: details.material.layerHeight,
    project_material_infill: details.material.infill,
    project_material_print_time: details.material.printTime,
    project_material_notes: details.material.notes,
    project_procedure_steps: details.procedure.steps.filter((step) => step.trim()),
    project_procedure_notes: details.procedure.notes,
  };
}

/**
 * The public project page's view of the blocks: only what has content, in
 * display order, so a half-filled block never draws an empty heading.
 *
 * Kept here rather than in the component because "which fields are worth
 * showing" is a data question, and it is the same answer the app's project
 * screen needs if it ever grows a read-only view.
 */
export type ProjectDetailView = {
  key: "code" | "material" | "procedure";
  title: string;
  /** Label/value rows to render as a description list. */
  rows: { label: string; value: string }[];
  /** Ordered steps (procedure only). */
  steps: string[];
  /** Trailing paragraph, e.g. "Hold BOOT while flashing". */
  notes: string;
};

export function projectDetailViews(details: ProjectDetails): ProjectDetailView[] {
  const rowsFor = (entries: [string, string][]) =>
    entries.filter(([, value]) => value.trim() !== "").map(([label, value]) => ({ label, value }));

  const views: ProjectDetailView[] = [
    {
      key: "code",
      title: "Software and code",
      rows: rowsFor([
        ["Language", details.code.language],
        ["Repository", details.code.repositoryUrl],
        ["Libraries", details.code.libraries],
      ]),
      steps: [],
      notes: details.code.notes.trim(),
    },
    {
      key: "material",
      title: "3D printing",
      rows: rowsFor([
        ["Printer", details.material.printer],
        ["Filament", details.material.filament],
        ["Layer height", details.material.layerHeight],
        ["Infill", details.material.infill],
        ["Print time", details.material.printTime],
      ]),
      steps: [],
      notes: details.material.notes.trim(),
    },
    {
      key: "procedure",
      title: "Coding procedure",
      rows: [],
      steps: details.procedure.steps.map((step) => step.trim()).filter(Boolean),
      notes: details.procedure.notes.trim(),
    },
  ];

  return views.filter((view) => view.rows.length > 0 || view.steps.length > 0 || view.notes !== "");
}

/**
 * A field whose column and JSON copy disagree during the dual-write rollout.
 * `column` and `json` are both stringified for display (steps join on newline).
 */
export type ProjectDetailDrift = {
  field: string;
  label: string;
  column: string;
  json: string;
};

type DriftField = {
  field: string;
  label: string;
  column: (typeof PROJECT_DETAIL_COLUMN_KEYS)[number];
  /** The JSON side's value for the same field. */
  fromJson: (details: ProjectDetails) => string | string[];
  steps?: boolean;
};

const DRIFT_FIELDS: DriftField[] = [
  {
    field: "code.language",
    label: "Code language",
    column: "project_code_language",
    fromJson: (d) => d.code.language,
  },
  {
    field: "code.repositoryUrl",
    label: "Code repository",
    column: "project_code_repository",
    fromJson: (d) => d.code.repositoryUrl,
  },
  {
    field: "code.libraries",
    label: "Code libraries",
    column: "project_code_libraries",
    fromJson: (d) => d.code.libraries,
  },
  {
    field: "code.notes",
    label: "Code notes",
    column: "project_code_notes",
    fromJson: (d) => d.code.notes,
  },
  {
    field: "material.printer",
    label: "Printer",
    column: "project_material_printer",
    fromJson: (d) => d.material.printer,
  },
  {
    field: "material.filament",
    label: "Filament",
    column: "project_material_filament",
    fromJson: (d) => d.material.filament,
  },
  {
    field: "material.layerHeight",
    label: "Layer height",
    column: "project_material_layer_height",
    fromJson: (d) => d.material.layerHeight,
  },
  {
    field: "material.infill",
    label: "Infill",
    column: "project_material_infill",
    fromJson: (d) => d.material.infill,
  },
  {
    field: "material.printTime",
    label: "Print time",
    column: "project_material_print_time",
    fromJson: (d) => d.material.printTime,
  },
  {
    field: "material.notes",
    label: "Material notes",
    column: "project_material_notes",
    fromJson: (d) => d.material.notes,
  },
  {
    field: "procedure.steps",
    label: "Procedure steps",
    column: "project_procedure_steps",
    fromJson: (d) => d.procedure.steps,
    steps: true,
  },
  {
    field: "procedure.notes",
    label: "Procedure notes",
    column: "project_procedure_notes",
    fromJson: (d) => d.procedure.notes,
  },
];

/**
 * Compare a products row's columns with its `import_meta.projectDetails` copy.
 *
 * During the dual-write rollout the two copies can drift — an old app bundle
 * writes only JSON, a fresh console writes both — and the reader prefers the
 * column, so a stale JSON copy is invisible rather than harmless. Reports only
 * fields where the column has a value AND differs from the JSON copy: an empty
 * column just means "this row was never migrated", which is the normal state
 * before the backfill runs.
 *
 * Returns [] for a row with no columns, which is what makes this safe to call
 * before the migration is applied.
 */
export function projectDetailDrift(
  meta: ProductImportMeta | Record<string, unknown> | undefined | null,
  row: ProjectDetailRow
): ProjectDetailDrift[] {
  if (!row || typeof row !== "object") return [];
  const json = readProjectDetails(meta);
  const drift: ProjectDetailDrift[] = [];

  for (const field of DRIFT_FIELDS) {
    const raw = row[field.column];
    let columnValue: string;
    if (field.steps) {
      const steps = Array.isArray(raw)
        ? raw.filter((step): step is string => typeof step === "string" && step.trim() !== "")
        : [];
      if (steps.length === 0) continue;
      columnValue = steps.join("\n");
    } else {
      if (typeof raw !== "string" || raw === "") continue;
      columnValue = raw;
    }

    const jsonValue = field.fromJson(json);
    const jsonText = Array.isArray(jsonValue) ? jsonValue.join("\n") : jsonValue;
    if (columnValue !== jsonText) {
      drift.push({ field: field.field, label: field.label, column: columnValue, json: jsonText });
    }
  }

  return drift;
}

/**
 * Write projectDetails back into an importMeta bag. Returns a NEW bag so the
 * caller can `setProduct({ ...product, importMeta: writeProjectDetails(...) })`
 * without mutating the product being edited. Import provenance keys are kept.
 */
export function writeProjectDetails(
  meta: ProductImportMeta | Record<string, unknown> | undefined | null,
  details: ProjectDetails
): ProductImportMeta {
  return {
    ...bag(meta),
    projectDetails: {
      code: { ...details.code },
      material: { ...details.material },
      procedure: {
        steps: details.procedure.steps.filter((step) => step.trim()),
        notes: details.procedure.notes,
      },
    },
  } as ProductImportMeta;
}
