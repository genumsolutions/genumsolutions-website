import { NextResponse } from "next/server";
import { isStaffRequest } from "../../../../lib/admin";
import { getSiteContent, saveSiteContent } from "../../../../lib/content-store";
import { logActivity } from "../../../../lib/activity";
import {
  getTrainingPrograms,
  saveTrainingPrograms,
  getPilotCostLines,
  savePilotCostLines,
  getCurriculumHighlights,
  saveCurriculumHighlights,
} from "../../../../lib/settings-store";
import { revalidateContent } from "../../../../lib/revalidate";

/**
 * GET — one payload for the Content panel.
 *
 * 2026-11-18 (owner: "Homepage content. Failed to fetch site content… same
 * message on refresh"): this used to load four sources through one Promise.all
 * inside one try/catch, so a failure in ANY of them (a missing table, a missing
 * service-role key) returned a single blanket 500 — "Could not load site
 * content." — and refreshing retried the identical call. The panel could not
 * tell which part broke, and the good data was thrown away with the bad.
 *
 * Each source now settles independently: the page renders whatever loaded,
 * names the source that failed, and never blames the whole panel for one table.
 * `contentLoaded` is explicit so the form will not let staff save an empty hero
 * over a hero it never managed to read.
 */
export async function GET(_request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [content, training, pilot, curriculum] = await Promise.allSettled([
    getSiteContent(),
    getTrainingPrograms(),
    getPilotCostLines(),
    getCurriculumHighlights(),
  ]);

  const faults: { source: string; message: string }[] = [];
  const reasonOf = (result: PromiseSettledResult<unknown>) =>
    result.status === "rejected"
      ? result.reason instanceof Error
        ? result.reason.message
        : String(result.reason ?? "unknown error")
      : "";

  if (content.status === "rejected") {
    console.error("Admin content: site_content failed", content.reason);
    faults.push({ source: "Home page content", message: reasonOf(content) });
  }
  if (training.status === "rejected") {
    console.error("Admin content: training_programs failed", training.reason);
    faults.push({ source: "Training programs", message: reasonOf(training) });
  }
  if (pilot.status === "rejected") {
    console.error("Admin content: pilot_cost_lines failed", pilot.reason);
    faults.push({ source: "Pilot costs", message: reasonOf(pilot) });
  }
  if (curriculum.status === "rejected") {
    console.error("Admin content: curriculum_highlights failed", curriculum.reason);
    faults.push({ source: "Curriculum highlights", message: reasonOf(curriculum) });
  }

  const home = content.status === "fulfilled" ? content.value : null;

  return NextResponse.json({
    homeTitle: home?.homeTitle ?? "",
    homeBody: home?.homeBody ?? "",
    /** False when the hero could not be read — the form must not save over it. */
    contentLoaded: content.status === "fulfilled",
    trainingPrograms: training.status === "fulfilled" ? training.value : [],
    pilotCostLines: pilot.status === "fulfilled" ? pilot.value : [],
    curriculumHighlights: curriculum.status === "fulfilled" ? curriculum.value : [],
    faults,
  });
}

export async function PUT(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => null)) as {
      homeTitle?: string;
      homeBody?: string;
      trainingPrograms?: unknown[];
      pilotCostLines?: unknown[];
      curriculumHighlights?: unknown[];
    } | null;
    if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

    if (body.homeTitle !== undefined || body.homeBody !== undefined) {
      const title = typeof body.homeTitle === "string" ? body.homeTitle.trim() : "";
      const bodyText = typeof body.homeBody === "string" ? body.homeBody.trim() : "";
      if (!title || !bodyText)
        return NextResponse.json(
          { error: "Homepage title and body are required." },
          { status: 400 }
        );
      await saveSiteContent({ homeTitle: title, homeBody: bodyText });
      await logActivity({
        action: "content.saved",
        entityType: "site_content",
        entityId: "home",
        details: { homeTitle: title },
      });
    }

    if (body.trainingPrograms !== undefined) {
      const programs = sanitizeRows(body.trainingPrograms, "training");
      await saveTrainingPrograms(programs);
      await logActivity({
        action: "training.saved",
        entityType: "training_programs",
        details: { count: programs.length },
      });
    }

    if (body.pilotCostLines !== undefined) {
      const lines = sanitizeRows(body.pilotCostLines, "pilot");
      await savePilotCostLines(lines);
      await logActivity({
        action: "pilot.saved",
        entityType: "pilot_cost_lines",
        details: { count: lines.length },
      });
    }

    if (body.curriculumHighlights !== undefined) {
      const highlights = sanitizeRows(body.curriculumHighlights, "curriculum");
      await saveCurriculumHighlights(highlights);
      await logActivity({
        action: "curriculum.saved",
        entityType: "curriculum_highlights",
        details: { count: highlights.length },
      });
    }

    revalidateContent();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin content save failed", error);
    return NextResponse.json({ error: "Could not save site content." }, { status: 500 });
  }
}

function sanitizeRows(
  rows: unknown[],
  kind: "training" | "pilot" | "curriculum"
): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (r): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r)
    )
    .map((r) => sanitizeRow(r, kind));
}

function sanitizeRow(
  row: Record<string, unknown>,
  kind: "training" | "pilot" | "curriculum"
): Record<string, unknown> {
  const {
    id,
    title,
    audience,
    description,
    duration,
    outcome,
    item,
    cost,
    note,
    ageBand,
    items,
    active,
    sortOrder,
  } = row;

  const out: Record<string, unknown> = {};
  if (kind === "training") {
    out.id = toString(id, 64);
    out.title = toString(title, 200);
    out.audience = toString(audience, 200);
    out.description = toString(description, 4000);
    out.duration = toString(duration, 200);
    out.outcome = toString(outcome, 2000);
    out.active = active !== false;
    out.sortOrder = toInt(sortOrder, 0);
  } else if (kind === "pilot") {
    out.id = toString(id, 64);
    out.item = toString(item, 200);
    out.cost = toString(cost, 200);
    out.note = toString(note, 1000);
    out.active = active !== false;
    out.sortOrder = toInt(sortOrder, 0);
  } else {
    out.id = toString(id, 64);
    out.ageBand = toString(ageBand, 120);
    out.items = toStringArray(items);
    out.active = active !== false;
    out.sortOrder = toInt(sortOrder, 0);
  }
  return out;
}

function toString(value: unknown, max = 2000): string {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, max).trim();
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => toString(v, 200)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => toString(v, 200)).filter(Boolean);
    } catch {
      // not JSON
    }
    return [value.trim()];
  }
  return [];
}
