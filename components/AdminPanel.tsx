"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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

const ORDER_SECTIONS = ["Orders", "Finance"] as const;
type OrderSection = (typeof ORDER_SECTIONS)[number];
const CONTENT_SECTIONS = ["Services", "Journal", "Content"] as const;
type ContentSection = (typeof CONTENT_SECTIONS)[number];
const USER_SECTIONS = ["Users", "Messages", "Logs"] as const;
type UserSection = (typeof USER_SECTIONS)[number];

function AdminSectionTabs<T extends string>({
  group,
  label,
  tabs,
  active,
  onChange,
  panels,
}: {
  group: string;
  label: string;
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  panels: readonly { tab: T; content: ReactNode }[];
}) {
  return (
    <>
      <div className="sticky top-11 z-10 -mx-5 mt-4 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label={label}
          className="flex items-center gap-2 overflow-x-auto pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const selected = active === tab;
            const id = panelId(tab);
            return (
              <button
                key={tab}
                id={`${group}-tab-${id}`}
                role="tab"
                aria-selected={selected}
                aria-controls={`${group}-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tab)}
                className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border px-4 text-[11px] font-black uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                  selected
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-muted hover:border-navy hover:text-navy"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-w-0">
        {panels.map(({ tab, content }) => {
          const selected = active === tab;
          const id = panelId(tab);
          return (
            <div
              key={tab}
              id={`${group}-panel-${id}`}
              role="tabpanel"
              aria-labelledby={`${group}-tab-${id}`}
              hidden={!selected}
              {...({ inert: selected ? undefined : "" } as Record<string, string | undefined>)}
              className="min-w-0"
            >
              {content}
            </div>
          );
        })}
      </div>
    </>
  );
}

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
  const [ordersSection, setOrdersSection] = useState<OrderSection>("Orders");
  const [contentSection, setContentSection] = useState<ContentSection>("Services");
  const [userSection, setUserSection] = useState<UserSection>("Users");

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
            {/* 2026-11-13 (batch 4): money lives in Orders → Finance; the
                dashboard routes there instead of publishing the same tiles. */}
            <AdminDashboard onOpenOrders={() => setTab("Orders")} />
            <AdminActivity />
          </>
        );
      case "Orders":
        return (
          <AdminSectionTabs
            group="orders"
            label="Order sections"
            tabs={ORDER_SECTIONS}
            active={ordersSection}
            onChange={setOrdersSection}
            panels={[
              { tab: "Orders", content: <AdminOrders canDelete={canDelete} /> },
              { tab: "Finance", content: <AdminFinance /> },
            ]}
          />
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
          <AdminSectionTabs
            group="content"
            label="Content sections"
            tabs={CONTENT_SECTIONS}
            active={contentSection}
            onChange={setContentSection}
            panels={[
              {
                tab: "Services",
                content: <AdminServices setMessage={setMessage} canDelete={canDelete} />,
              },
              {
                tab: "Journal",
                content: <AdminJournal setMessage={setMessage} canDelete={canDelete} />,
              },
              {
                tab: "Content",
                content: <AdminContent setMessage={setMessage} canDelete={canDelete} />,
              },
            ]}
          />
        );
      case "Users":
        return (
          <AdminSectionTabs
            group="users"
            label="User administration sections"
            tabs={USER_SECTIONS}
            active={userSection}
            onChange={setUserSection}
            panels={[
              {
                tab: "Users",
                content: (
                  <AdminUsers
                    setMessage={setMessage}
                    canDelete={canDelete}
                    currentRole={currentRole}
                  />
                ),
              },
              {
                tab: "Messages",
                content: <AdminMessages setMessage={setMessage} canDelete={canDelete} />,
              },
              { tab: "Logs", content: <AdminLogsHub /> },
            ]}
          />
        );
      case "Settings":
        return <AdminSettings setMessage={setMessage} canDelete={canDelete} />;
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
      {/* 2026-11-14 (owner: "i dont like the split screen of the admin
          dashboards tabs contents"): ONE panel at a time, in normal document
          flow — the public site's mobile view, now used at every width.

          History: this used to be a filmstrip — all eight panels as
          `w-full shrink-0` siblings inside one flex row, moved with
          `translateX(-index * 100%)`. That had three failure modes:
            1. during the 300ms slide both panels are visible, side by side;
            2. the track's width is 8 × viewport, so any panel content wider
               than its 1/8 share (a wide table, a long unbroken URL) widened
               the track and the browser landed on half of two tabs — a real
               split screen, not an animation artefact;
            3. every panel inherited that oversized width, which is what made
               buttons and cards look stretched.
          Panels still stay mounted (per-tab state and in-flight loads
          survive), but inactive ones are `hidden` + `inert`: no display, no
          height, no focus, no width contribution. Nothing to slide, so there
          is nothing to split. */}
      <div className="min-w-0">
        {TABS.map((name: Tab, i: number) => (
          <div
            key={name}
            role="tabpanel"
            id={`panel-${panelId(name)}`}
            aria-labelledby={`tab-${panelId(name)}`}
            hidden={tabIndex !== i}
            {...({ inert: tabIndex === i ? undefined : "" } as Record<string, string | undefined>)}
            className="min-w-0"
          >
            {visited.has(i) ? renderPanel(name) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
