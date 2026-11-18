// tests/project-details.test.ts — the project-detail blocks after the
// 2026-11-18 columns migration.
//
// The blocks used to live only in import_meta.projectDetails. The migration
// adds products.project_* columns; both are written during the rollout and the
// reader prefers the column per field. These tests pin that merge rule and the
// payload shape, because a wrong key here is a 42703 on every product save.
import { describe, expect, it } from "vitest";
import {
  PROJECT_DETAIL_COLUMN_KEYS,
  blankProjectDetails,
  projectDetailColumns,
  readProjectDetails,
  writeProjectDetails,
} from "../lib/project-details";

describe("readProjectDetails with the new columns", () => {
  it("prefers a column value over the JSON copy for the same field", () => {
    const details = readProjectDetails(
      { projectDetails: { code: { language: "JSON language" } } },
      { project_code_language: "Column language" }
    );
    expect(details.code.language).toBe("Column language");
  });

  it("falls back per field, not per block", () => {
    const details = readProjectDetails(
      {
        projectDetails: {
          code: { language: "JSON language", notes: "JSON notes" },
          material: { printer: "JSON printer" },
        },
      },
      {
        project_code_language: "Column language",
        // Empty strings are what rows that were never backfilled with a value
        // carry, so they must not win over the JSON copy.
        project_code_notes: "",
        project_material_printer: "Column printer",
      }
    );
    expect(details.code).toEqual({
      language: "Column language",
      repositoryUrl: "",
      libraries: "",
      notes: "JSON notes",
    });
    expect(details.material.printer).toBe("Column printer");
  });

  it("takes procedure steps from the columns only when they are non-empty", () => {
    const json = { projectDetails: { procedure: { steps: ["JSON step"], notes: "" } } };
    expect(
      readProjectDetails(json, { project_procedure_steps: ["Column step"] }).procedure.steps
    ).toEqual(["Column step"]);
    // The migration's '[]' default must not erase a populated JSON copy.
    expect(readProjectDetails(json, { project_procedure_steps: [] }).procedure.steps).toEqual([
      "JSON step",
    ]);
  });

  it("behaves exactly as before when the row has no columns", () => {
    const meta = { projectDetails: { code: { language: "Arduino C++" } } };
    expect(readProjectDetails(meta, {})).toEqual(readProjectDetails(meta));
  });
});

describe("projectDetailColumns", () => {
  it("writes every column the migration defines, blanks included", () => {
    const details = {
      ...blankProjectDetails(),
      code: { ...blankProjectDetails().code, language: "Arduino C++" },
      procedure: { steps: ["Flash", "  "], notes: "Hold BOOT" },
    };
    const columns = projectDetailColumns(details);

    expect(Object.keys(columns).sort()).toEqual([...PROJECT_DETAIL_COLUMN_KEYS].sort());
    expect(columns.project_code_language).toBe("Arduino C++");
    // Clearing a field in the console has to clear the column too.
    expect(columns.project_code_notes).toBe("");
    expect(columns.project_procedure_steps).toEqual(["Flash"]);
    expect(columns.project_procedure_notes).toBe("Hold BOOT");
  });

  it("round-trips through readProjectDetails", () => {
    const details = {
      ...blankProjectDetails(),
      material: { ...blankProjectDetails().material, printer: "P1S" },
      procedure: { steps: ["Flash"], notes: "" },
    };
    expect(readProjectDetails({}, projectDetailColumns(details))).toEqual(details);
  });

  it("matches what writeProjectDetails stores in the JSON copy", () => {
    const details = {
      ...blankProjectDetails(),
      code: { ...blankProjectDetails().code, language: "Arduino C++" },
    };
    const written = writeProjectDetails({ sourceSite: "makerworld" }, details);
    expect(written.sourceSite).toBe("makerworld");
    expect(readProjectDetails(written)).toEqual(details);
  });
});
