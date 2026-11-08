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

export async function GET(_request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [content, training, pilot, curriculum] = await Promise.all([
      getSiteContent(),
      getTrainingPrograms!,
      getPilotCostLines!,
      getCurriculumHighlights!,
    ]);
    return NextResponse.json({
      homeTitle: content.homeTitle,
      homeBody: content.homeBody,
      trainingPrograms: training,
      pilotCostLines: pilot,
      curriculumHighlights: curriculum,
    });
  } catch (error) {
    console.error("Admin content load failed", error);
    return NextResponse.json({ error: "Could not load site content." }, { status: 500 });
  }
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
