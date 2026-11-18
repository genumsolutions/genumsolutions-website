"use client";

import { useEffect, useState } from "react";
import {
  adminSectionPill,
  adminSectionPillActive,
  adminSectionPillInactive,
  adminSectionStrip,
  inputClass,
} from "../../lib/styles";
import AdminRows from "./AdminRows";
import type { RowItem } from "./AdminRows";
import { LoadingRow, PanelCard, SaveBar, editorCardTitle } from "./admin-helpers";

type Props = {
  setMessage: (msg: string) => void;
  canDelete: boolean;
};

// 2026-11-18: one scroll held four unrelated record types. Each now has its own
// window, mirroring the app's Settings → Home page sections.
const HOME_SECTIONS = ["Hero", "Training", "Pilot costs", "Curriculum"] as const;
type HomeSection = (typeof HOME_SECTIONS)[number];

const HOME_HINTS: Record<HomeSection, string> = {
  Hero: "The title and body at the top of the home page; both clients read this record.",
  Training: "Programs listed on the home page and the training pages.",
  "Pilot costs": "Running cost lines shown on the app home screen.",
  Curriculum: "Age-band skills shown on the app home screen.",
};

export default function AdminContent({ setMessage, canDelete }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [homeTitle, setHomeTitle] = useState("");
  const [homeBody, setHomeBody] = useState("");
  const [busy, setBusy] = useState(false);

  const [programs, setPrograms] = useState<RowItem[]>([]);
  const [pilots, setPilots] = useState<RowItem[]>([]);
  const [curricula, setCurricula] = useState<RowItem[]>([]);
  // 2026-11-18: one blanket catch used to hide which of the four sources failed,
  // and refreshing re-ran the same failing call for the same message.
  const [faults, setFaults] = useState<{ source: string; message?: string }[]>([]);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [section, setSection] = useState<HomeSection>("Hero");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/content");
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setFaults([
            {
              source: "Content",
              message: payload?.error ?? `HTTP ${response.status}`,
            },
          ]);
          return;
        }
        setHomeTitle(payload.homeTitle ?? "");
        setHomeBody(payload.homeBody ?? "");
        setContentLoaded(payload.contentLoaded !== false);
        setPrograms(payload.trainingPrograms ?? []);
        setPilots(payload.pilotCostLines ?? []);
        setCurricula(payload.curriculumHighlights ?? []);
        const reported: { source: string; message?: string }[] = Array.isArray(payload.faults)
          ? payload.faults
          : [];
        setFaults(reported);
        if (reported.length > 0) {
          setMessage(
            `Some content could not be loaded: ${reported.map((f) => f.source).join(", ")}.`
          );
        }
      } catch {
        if (!cancelled) {
          setFaults([{ source: "Content", message: "The server could not be reached." }]);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setMessage]);

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    // 2026-11-18: never save an empty hero over a hero we failed to read.
    if (!contentLoaded) {
      setMessage(
        "Home page content could not be loaded, so it cannot be saved over. Reload the panel once the source is reachable."
      );
      return;
    }
    if (!homeTitle.trim() || !homeBody.trim()) {
      setMessage("Homepage title and body are required.");
      return;
    }
    setBusy(true);
    // U-48: try/catch/finally. Previously `busy` was released on the error and
    // success branches only — a thrown fetch (offline) left the Save button
    // disabled on "Saving..." forever.
    try {
      const response = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeTitle: homeTitle.trim(), homeBody: homeBody.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error || "Could not save content.");
        return;
      }
      setMessage("Site content saved.");
    } catch {
      setMessage("Could not reach the server to save the content.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className={adminSectionStrip} role="group" aria-label="Home page sections">
        {HOME_SECTIONS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={section === name}
            onClick={() => setSection(name)}
            className={`${adminSectionPill} ${
              section === name ? adminSectionPillActive : adminSectionPillInactive
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{HOME_HINTS[section]}</p>
      {section === "Hero" ? (
        <PanelCard>
          <h2 className={editorCardTitle}>Homepage content</h2>
          {faults.length > 0 && (
            <div
              role="status"
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"
            >
              <strong className="block">
                {faults.length === 1
                  ? "One section could not be loaded."
                  : `${faults.length} sections could not be loaded.`}
              </strong>
              <ul className="mt-1 list-disc pl-4">
                {faults.map((fault) => (
                  <li key={fault.source}>
                    {fault.source}
                    {fault.message ? ` — ${fault.message}` : ""}
                  </li>
                ))}
              </ul>
              <span className="mt-1 block">
                Everything else loaded normally. Retry only after the source above is back.
              </span>
            </div>
          )}
          {!loaded ? (
            <LoadingRow className="mt-3" />
          ) : (
            <form onSubmit={save} className="mt-5 grid gap-4">
              <label className="min-w-0 text-sm font-bold">
                Homepage title
                <textarea
                  value={homeTitle}
                  onChange={(e) => setHomeTitle(e.target.value)}
                  rows={2}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <label className="min-w-0 text-sm font-bold">
                Homepage body
                <textarea
                  value={homeBody}
                  onChange={(e) => setHomeBody(e.target.value)}
                  rows={8}
                  className={`mt-2 w-full ${inputClass}`}
                />
              </label>
              <SaveBar>
                <button
                  type="submit"
                  disabled={busy || !contentLoaded}
                  className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save content"}
                </button>
              </SaveBar>
            </form>
          )}
        </PanelCard>
      ) : null}

      <div className="mt-4 grid gap-6">
        {section === "Training" ? (
          <AdminRows
            kind="training"
            rows={programs}
            onChange={setPrograms}
            caption="Training programs"
            hint="Windo training shows on the app home + website pages."
            canDelete={canDelete}
            setMessage={setMessage}
          />
        ) : null}
        {section === "Pilot costs" ? (
          <AdminRows
            kind="pilot"
            rows={pilots}
            onChange={setPilots}
            caption="Pilot cost lines"
            hint="Running costs shown on the app home screen."
            canDelete={canDelete}
            setMessage={setMessage}
          />
        ) : null}
        {section === "Curriculum" ? (
          <AdminRows
            kind="curriculum"
            rows={curricula}
            onChange={setCurricula}
            caption="Curriculum highlights"
            hint="Age-band skills for the app home screen."
            canDelete={canDelete}
            setMessage={setMessage}
          />
        ) : null}
      </div>
    </div>
  );
}
