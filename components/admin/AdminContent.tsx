"use client";

import { useEffect, useState } from "react";
import { inputClass } from "../../lib/styles";
import AdminRows from "./AdminRows";
import type { RowItem } from "./AdminRows";
import { LoadingRow, PanelCard, SaveBar, editorCardTitle } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../../lib/styles";

type Props = {
  setMessage: (msg: string) => void;
  canDelete: boolean;
};

export default function AdminContent({ setMessage, canDelete }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [homeTitle, setHomeTitle] = useState("");
  const [homeBody, setHomeBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [subTab, setSubTab] = useState("Services");

  const [programs, setPrograms] = useState<RowItem[]>([]);
  const [pilots, setPilots] = useState<RowItem[]>([]);
  const [curricula, setCurricula] = useState<RowItem[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/content").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([content, settings]) => {
        setHomeTitle(content.homeTitle || "");
        setHomeBody(content.homeBody || "");
        setPrograms(settings.trainingPrograms ?? []);
        setPilots(settings.pilotCostLines ?? []);
        setCurricula(settings.curriculumHighlights ?? []);
      })
      .catch(() => setMessage("Could not load site content."))
      .finally(() => setLoaded(true));
  }, [setMessage]);

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
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
      {/* U-UI2 sub-tabs strip - sticky, one at a time */}
      <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Content sub-tabs"
          className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {"Services Journal Content".split(" ").map((sub: string, _: number) => (
            <button
              key={sub}
              role="tab"
              aria-selected={subTab === sub}
              aria-controls={`content-subpanel-${sub}`}
              tabIndex={subTab === sub ? 0 : -1}
              onClick={() => setSubTab(sub as "Services" | "Journal" | "Content")}
              className={`${tabBase} text-[10px] ${subTab === sub ? tabActive : tabInactive}`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <PanelCard>
        <h2 className={editorCardTitle}>Homepage content</h2>
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
                disabled={busy}
                className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save content"}
              </button>
            </SaveBar>
          </form>
        )}
      </PanelCard>

      {/* Sub-tab content replaces main panel, no split screen */}
      {subTab === "Services" && (
        <div className="mt-6 grid gap-6">
          <AdminRows
            kind="training"
            rows={programs}
            onChange={setPrograms}
            caption="Training programs"
            hint="Windo training shows on the app home + website pages."
            canDelete={canDelete}
            setMessage={setMessage}
          />
          <AdminRows
            kind="pilot"
            rows={pilots}
            onChange={setPilots}
            caption="Pilot cost lines"
            hint="Running costs shown on the app home screen."
            canDelete={canDelete}
            setMessage={setMessage}
          />
          <AdminRows
            kind="curriculum"
            rows={curricula}
            onChange={setCurricula}
            caption="Curriculum highlights"
            hint="Age-band skills for the app home screen."
            canDelete={canDelete}
            setMessage={setMessage}
          />
        </div>
      )}

      {subTab === "Journal" && (
        <div className="mt-6 grid gap-6">
          <p className="text-sm text-slate-500">Journal sub-tab content</p>
        </div>
      )}

      {subTab === "Content" && (
        <div className="mt-6 grid gap-6">
          <p className="text-sm text-slate-500">Content sub-tab content</p>
        </div>
      )}
    </div>
  );
}
