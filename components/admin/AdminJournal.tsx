"use client";

import { useEffect, useState } from "react";
import type { JournalItem } from "./admin-types";
import { EmptyState, PanelCard, panelListSection, panelId, panelTitle } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Journal tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const JOURNAL_SUBTABS = ["Posts", "Categories", "Tags"] as const;
type JournalSubTab = (typeof JOURNAL_SUBTABS)[number];

export default function AdminJournal({
  setMessage,
  canDelete,
}: {
  setMessage: (msg: string) => void;
  canDelete: boolean;
}) {
  const [posts, setPosts] = useState<JournalItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [subTab, setSubTab] = useState<JournalSubTab>("Posts");

  useEffect(() => {
    void fetch("/api/admin/journal")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => setMessage("Could not load journal data."))
      .finally(() => setLoaded(true));
  }, [setMessage]);
  // TypeScript suppression: canDelete prop received from parent but not used in this version
  void canDelete;

  return (
    <section aria-label="Journal administration" className="mt-4">
      {/* U-UI2 sub-tabs strip - sticky, one at a time */}
      <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Journal sub-tabs"
          className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {JOURNAL_SUBTABS.map((sub: JournalSubTab, _: number) => (
            <button
              key={sub}
              role="tab"
              aria-selected={subTab === sub}
              aria-controls={`journal-subpanel-${panelId(sub)}`}
              tabIndex={subTab === sub ? 0 : -1}
              onClick={() => setSubTab(sub)}
              className={`${tabBase} text-[10px] ${subTab === sub ? tabActive : tabInactive}`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1fr_1.3fr]">
        {subTab === "Posts" && (
          <section aria-label="Journal post list" className={panelListSection}>
            <PanelCard>
              <h2 className={panelTitle}>Journal posts ({posts.length})</h2>
              <p className="text-sm text-slate-500">
                Published posts appear on /journal and in the native app Journal screen. Editing
                here updates the DB - both clients render the latest copy.
              </p>
              {loaded ? (
                <div className="mt-3 divide-y divide-line">
                  {posts.map((p) => (
                    <div key={p.id} className="items-center">
                      <div>
                        <span className="block">
                          <strong>{p.title}</strong> <span className="text-slate-400">{p.tag}</span>
                        </span>
                        {!p.active && (
                          <span className="ml-2 text-[10px] font-black uppercase text-red-500">
                            hidden
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>No journal posts yet.</EmptyState>
              )}
            </PanelCard>
          </section>
        )}

        {subTab === "Categories" && (
          <PanelCard>
            <h2 className={panelTitle}>Journal Categories</h2>
            <p className="text-sm text-slate-500">Journal categories sub-tab content</p>
          </PanelCard>
        )}

        {subTab === "Tags" && (
          <PanelCard>
            <h2 className={panelTitle}>Journal Tags</h2>
            <p className="text-sm text-slate-500">Journal tags sub-tab content</p>
          </PanelCard>
        )}
      </div>
    </section>
  );
}
