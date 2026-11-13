"use client";

import { useEffect, useState } from "react";
import { tabActive, tabBase, tabInactive } from "../lib/styles";
import { isAdminRole } from "../lib/roles";
import type { Product } from "../lib/content-store";
import type { LucideIcon as LucideIconType } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingBag,
  Cpu,
  Box,
  Package,
  FileText,
  Users,
  Settings as SettingsIcon,
} from "lucide-react";
import { TAB_HINTS, TABS, type Tab } from "./admin/admin-types";
import AdminDashboard from "./admin/AdminDashboard";
import AdminActivity from "./admin/AdminActivity";
import AdminOrders from "./admin/AdminOrders";
import AdminFinance from "./admin/AdminFinance";
import AdminProducts from "./admin/AdminProducts";
import AdminPrint from "./admin/AdminPrint";
import AdminProjectPackages from "./admin/AdminProjectPackages";
import AdminServices from "./admin/AdminServices";
import AdminJournal from "./admin/AdminJournal";
import AdminContent from "./admin/AdminContent";
import AdminUsers from "./admin/AdminUsers";
import AdminMessages from "./admin/AdminMessages";
import AdminSettings from "./admin/AdminSettings";
import AdminLogsHub from "./admin/AdminLogsHub";

type Props = {
  initialProducts: Product[];
  currentRole: "staff" | "admin" | "owner";
};

// U-44: tab ids must be URL/DOM-safe — "Electronic Products" → "electronic-products".
const panelId = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

type TabIconMap = {
  [K in Tab]: LucideIconType;
};

const TAB_ICONS: TabIconMap = {
  Dashboard: LayoutDashboard,
  Orders: ShoppingBag,
  "Electronic Products": Cpu,
  "3D Products": Box,
  Projects: Package,
  Content: FileText,
  Users: Users,
  Settings: SettingsIcon,
};

export default function AdminPanel({ initialProducts, currentRole }: Props) {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [products, setProducts] = useState(initialProducts);
  const [message, setMessage] = useState("");
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));

  const canDelete = isAdminRole(currentRole);
  const tabIndex = TABS.indexOf(tab);

  useEffect(() => {
    setVisited((prev) => {
      const next = new Set(prev);
      next.add(tabIndex);
      if (tabIndex > 0) next.add(tabIndex - 1);
      if (tabIndex < TABS.length - 1) next.add(tabIndex + 1);
      return next;
    });
  }, [tabIndex]);

  function renderPanel(t: Tab) {
    switch (t) {
      case "Dashboard":
        return (
          <>
            <AdminDashboard />
            <AdminActivity />
          </>
        );
      case "Orders":
        return (
          <>
            <AdminOrders canDelete={canDelete} />
            <AdminFinance />
          </>
        );
      case "Electronic Products":
        return (
          <AdminProducts
            kind="electronic"
            products={products}
            onProductsChange={setProducts}
            setMessage={setMessage}
            canDelete={canDelete}
          />
        );
      case "3D Products":
        // 2026-11-13: the tab now owns the whole print studio (catalog,
        // categories, pricing, promotions, gallery, quote requests). The tab
        // strip itself is unchanged, so the app parity tests still pass.
        return (
          <AdminPrint
            products={products}
            onProductsChange={setProducts}
            setMessage={setMessage}
            canDelete={canDelete}
          />
        );
      case "Projects":
        return (
          <AdminProjectPackages
            products={products}
            onProductsChange={setProducts}
            setMessage={setMessage}
            canDelete={canDelete}
          />
        );
      case "Content":
        return (
          <>
            <AdminServices setMessage={setMessage} canDelete={canDelete} />
            <AdminJournal setMessage={setMessage} canDelete={canDelete} />
            <AdminContent setMessage={setMessage} canDelete={canDelete} />
          </>
        );
      case "Users":
        return (
          <>
            <AdminUsers setMessage={setMessage} canDelete={canDelete} currentRole={currentRole} />
            <AdminLogsHub />
          </>
        );
      case "Settings":
        return (
          <>
            <AdminSettings setMessage={setMessage} canDelete={canDelete} />
            <AdminMessages setMessage={setMessage} canDelete={canDelete} />
          </>
        );
    }
  }

  // U-UI1 (2026-11-09): the strip is now ONE sticky row that scrolls
  // horizontally instead of wrapping onto three lines on a phone. That matches
  // the app's tab strip (one row, horizontal scroll, same active treatment) and
  // keeps the current section visible while you scroll a long panel.
  function moveTo(index: number) {
    const next = TABS[index];
    if (!next) return;
    setTab(next);
    setVisited((prev) => new Set(prev).add(index));
    document.getElementById(`tab-${panelId(next)}`)?.focus();
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pb-14 lg:px-8">
      <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Admin sections"
          className="flex items-center gap-5 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const step = event.key === "ArrowRight" ? 1 : -1;
            moveTo((tabIndex + step + TABS.length) % TABS.length);
          }}
        >
          {TABS.map((name: Tab, i: number) => {
            const Icon = TAB_ICONS[name] ?? LayoutDashboard;
            return (
              <button
                key={name}
                role="tab"
                id={`tab-${panelId(name)}`}
                aria-selected={tab === name}
                aria-controls={`panel-${panelId(name)}`}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => {
                  setTab(name);
                  setVisited((prev) => new Set(prev).add(i));
                }}
                className={`${tabBase} text-[12px] ${tab === name ? tabActive : tabInactive}`}
              >
                <Icon size={14} aria-hidden="true" />
                {name}
              </button>
            );
          })}
        </div>
      </div>
      {/* What this tab is for, in the same words the app uses (TAB_HINTS). */}
      <p className="mt-4 text-xs leading-5 text-muted">{TAB_HINTS[tab]}</p>
      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-line border-l-4 border-l-navy bg-white px-4 py-3 text-sm font-bold text-ink"
        >
          {message}
        </p>
      )}
      {/* Swipeable track: panels translate horizontally in sync.
          U-42 (2026-09-26), REVISED after owner regression report: the
          inactive panels get `h-0 overflow-hidden`, NOT `hidden` —
          display:none removes a panel from the flex row, which changes the
          row's width math and breaks the percentage translateX (tabs landed
          blank). Zero-height keeps every panel in the flex row at w-full
          (translate offsets stay exact) while contributing NO height, so
          the track height = the ACTIVE tab's content only — no dead space
          from taller neighbours. Panel DOM stays mounted for state survival. */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${tabIndex * 100}%)` }}
        >
          {TABS.map((name: Tab, i: number) => (
            <div
              key={name}
              role="tabpanel"
              id={`panel-${panelId(name)}`}
              aria-labelledby={`tab-${panelId(name)}`}
              aria-hidden={tabIndex !== i}
              // Inactive panels stay mounted (state survives) but are zero-
              // height, so their controls were still reachable by Tab. `inert`
              // removes them from focus order and the a11y tree for real.
              {...({ inert: tabIndex === i ? undefined : "" } as Record<
                string,
                string | undefined
              >)}
              className={`w-full shrink-0 ${tabIndex === i ? "" : "h-0 overflow-hidden"}`}
            >
              {visited.has(i) ? renderPanel(name) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
