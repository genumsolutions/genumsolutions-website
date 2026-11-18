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
  projectDetailDrift,
  projectDetailViews,
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

describe("projectDetailViews (public project page)", () => {
  it("returns nothing for a package with no details", () => {
    expect(projectDetailViews(blankProjectDetails())).toEqual([]);
  });

  it("only includes blocks that have content", () => {
    const details = {
      ...blankProjectDetails(),
      code: { ...blankProjectDetails().code, language: "Arduino C++" },
    };
    expect(projectDetailViews(details).map((view) => view.key)).toEqual(["code"]);
  });

  it("drops blank rows and keeps the filled ones in display order", () => {
    const details = {
      ...blankProjectDetails(),
      material: {
        ...blankProjectDetails().material,
        printer: "Bambu Lab P1S",
        filament: "   ",
        layerHeight: "0.2 mm",
      },
    };
    expect(projectDetailViews(details)).toEqual([
      {
        key: "material",
        title: "3D printing",
        rows: [
          { label: "Printer", value: "Bambu Lab P1S" },
          { label: "Layer height", value: "0.2 mm" },
        ],
        steps: [],
        notes: "",
      },
    ]);
  });

  it("trims procedure steps and never renders blanks", () => {
    const details = {
      ...blankProjectDetails(),
      procedure: { steps: [" Open the sketch ", "  ", "Flash"], notes: "  " },
    };
    expect(projectDetailViews(details)).toEqual([
      {
        key: "procedure",
        title: "Coding procedure",
        rows: [],
        steps: ["Open the sketch", "Flash"],
        notes: "",
      },
    ]);
  });

  it("shows a block whose only content is a note", () => {
    const details = {
      ...blankProjectDetails(),
      code: { ...blankProjectDetails().code, notes: "Uses the ESP32 core" },
    };
    expect(projectDetailViews(details)).toEqual([
      expect.objectContaining({ key: "code", rows: [], notes: "Uses the ESP32 core" }),
    ]);
  });

  it("renders what the columns hold, not the stale JSON copy", () => {
    const details = readProjectDetails(
      { projectDetails: { code: { language: "JSON language" } } },
      { project_code_language: "Column language" }
    );
    expect(projectDetailViews(details)).toEqual([
      {
        key: "code",
        title: "Software and code",
        rows: [{ label: "Language", value: "Column language" }],
        steps: [],
        notes: "",
      },
    ]);
  });

  it("is safe on a package with no importMeta at all", () => {
    expect(projectDetailViews(readProjectDetails(undefined))).toEqual([]);
  });
});

describe("projectDetailDrift (rollout integrity check)", () => {
  it("reports nothing for a row without the columns", () => {
    expect(
      projectDetailDrift({ projectDetails: { code: { language: "JSON language" } } }, {})
    ).toEqual([]);
    expect(projectDetailDrift({}, null)).toEqual([]);
  });

  it("reports nothing when the two copies agree", () => {
    const details = {
      ...blankProjectDetails(),
      code: { ...blankProjectDetails().code, language: "Arduino C++" },
    };
    expect(
      projectDetailDrift(writeProjectDetails({}, details), projectDetailColumns(details))
    ).toEqual([]);
  });

  it("names the field and both values when the column is newer", () => {
    const details = {
      ...blankProjectDetails(),
      code: { ...blankProjectDetails().code, language: "Arduino C++" },
    };
    const drift = projectDetailDrift(
      { projectDetails: { code: { language: "Arduino C" } } },
      projectDetailColumns(details)
    );
    expect(drift).toEqual([
      { field: "code.language", label: "Code language", column: "Arduino C++", json: "Arduino C" },
    ]);
  });

  it("compares procedure steps positionally, not as a set", () => {
    const details = {
      ...blankProjectDetails(),
      procedure: { steps: ["Flash", "Wire"], notes: "" },
    };
    const drift = projectDetailDrift(
      { projectDetails: { procedure: { steps: ["Wire", "Flash"] } } },
      projectDetailColumns(details)
    );
    expect(drift).toEqual([
      {
        field: "procedure.steps",
        label: "Procedure steps",
        column: "Flash\nWire",
        json: "Wire\nFlash",
      },
    ]);
  });

  it("ignores an empty column even when the JSON copy has a value", () => {
    // Pre-backfill state: the column was never written, so there is nothing to
    // disagree with — reporting it would flag every legacy row.
    expect(
      projectDetailDrift(
        { projectDetails: { code: { language: "Arduino C++" } } },
        {
          project_code_language: "",
          project_procedure_steps: [],
        }
      )
    ).toEqual([]);
  });

  it("tolerates hostile column shapes", () => {
    expect(
      projectDetailDrift(
        {},
        {
          project_code_language: 42,
          project_procedure_steps: "not a list",
        }
      )
    ).toEqual([]);
  });
});
