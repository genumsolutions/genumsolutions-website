// =====================================================================
// programs-store.ts - DB-first reads for training programs, pilot cost
// lines, and curriculum highlights (shared tables, public-read RLS).
// Falls back to the bundled programs-data so pages never render empty.
// Returns the same shapes the pages consumed from the old static
// lib/programs.ts so rendering code did not need to change.
// =====================================================================
import { localCurriculumHighlights, localPilotCosts, localTrainingPrograms } from "./programs-data";
import { createServiceClient, supabaseConfigured } from "./supabase/server";

// U-48 ISR flip: unstable_noStore() removed from all three reads. / and
// /services render these, and every write path (app/api/admin/settings/route.ts
// — training programs, pilot cost lines, curriculum highlights) calls
// revalidatePrograms(), so edits land on the next request. Previously every
// public render hit the DB for these three tables.

export type TrainingProgram = {
  title: string;
  audience: string;
  description: string;
  duration: string;
  outcome: string;
};

export async function getTrainingPrograms(): Promise<TrainingProgram[]> {
  if (!supabaseConfigured()) {
    return localTrainingPrograms.map(({ title, audience, description, duration, outcome }) => ({
      title,
      audience,
      description,
      duration,
      outcome,
    }));
  }
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("training_programs")
      .select("title, audience, description, duration, outcome")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) {
      return localTrainingPrograms.map(({ title, audience, description, duration, outcome }) => ({
        title,
        audience,
        description,
        duration,
        outcome,
      }));
    }
    return data.map((row) => ({
      title: row.title,
      audience: row.audience ?? "",
      description: row.description ?? "",
      duration: row.duration ?? "",
      outcome: row.outcome ?? "",
    }));
  } catch (error) {
    console.error("Supabase training-programs read failed; using local data.", error);
    return localTrainingPrograms.map(({ title, audience, description, duration, outcome }) => ({
      title,
      audience,
      description,
      duration,
      outcome,
    }));
  }
}

export type PilotCostLine = { item: string; cost: string; note: string };

export async function getPilotCosts(): Promise<PilotCostLine[]> {
  if (!supabaseConfigured()) {
    return localPilotCosts.map(({ item, cost, note }) => ({ item, cost, note }));
  }
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("pilot_cost_lines")
      .select("item, cost, note")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) {
      return localPilotCosts.map(({ item, cost, note }) => ({ item, cost, note }));
    }
    return data.map((row) => ({ item: row.item, cost: row.cost ?? "", note: row.note ?? "" }));
  } catch (error) {
    console.error("Supabase pilot-cost read failed; using local data.", error);
    return localPilotCosts.map(({ item, cost, note }) => ({ item, cost, note }));
  }
}

export type CurriculumHighlight = { ageBand: string; items: string[] };

export async function getCurriculumHighlights(): Promise<CurriculumHighlight[]> {
  if (!supabaseConfigured()) {
    return localCurriculumHighlights.map(({ ageBand, items }) => ({ ageBand, items }));
  }
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("curriculum_highlights")
      .select("age_band, items")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) {
      return localCurriculumHighlights.map(({ ageBand, items }) => ({ ageBand, items }));
    }
    return data.map((row) => ({
      ageBand: row.age_band,
      items: Array.isArray(row.items) ? (row.items as string[]) : [],
    }));
  } catch (error) {
    console.error("Supabase curriculum read failed; using local data.", error);
    return localCurriculumHighlights.map(({ ageBand, items }) => ({ ageBand, items }));
  }
}
