"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FileText,
  Users,
  Settings as SettingsIcon,
} from "lucide-react";
import { tabActive, tabBase, tabInactive } from "../lib/styles";
import { isAdminRole } from "../lib/roles";
import type { Product } from "../lib/content-store";
import { TABS } from "./admin/admin-types";
import type { Tab } from "./admin/admin-types";
import AdminDashboard from "./admin/AdminDashboard";
import AdminActivity from "./admin/AdminActivity";
import AdminOrders from "./admin/AdminOrders";
import AdminFinance from "./admin/AdminFinance";
import AdminProducts from "./admin/AdminProducts";
import AdminProjectPackages from "./admin/AdminProjectPackages";
import AdminServices from "./admin/AdminServices";
import AdminJournal from "./admin/AdminJournal";
import AdminContent from "./admin/AdminContent";
import AdminUsers from "./admin/AdminUsers";
import AdminMessages from "./admin/AdminMessages";
import AdminSettings from "./admin/AdminSettings";

type Props = { initialProducts: Product[]; currentRole: "staff" | "admin" | "owner" };

const TAB_ICONS = {
  Dashboard: LayoutDashboard,
  Orders: ShoppingBag,
  Catalog: Package,
  Content: FileText,
  Users: Users,
  Settings: SettingsIcon,
} as const;

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
      case "Catalog":
        return (
          <>
            <AdminProducts
              products={products}
              onProductsChange={setProducts}
              setMessage={setMessage}
              canDelete={canDelete}
            />
            <AdminProjectPackages
              products={products}
              onProductsChange={setProducts}
              setMessage={setMessage}
              canDelete={canDelete}
            />
          </>
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
            <AdminMessages setMessage={setMessage} canDelete={canDelete} />
          </>
        );
      case "Settings":
        return <AdminSettings setMessage={setMessage} canDelete={canDelete} />;
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div
        role="tablist"
        aria-label="Admin sections"
        className="-mx-5 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-5 pb-1 lg:mx-0 lg:px-0"
      >
        {TABS.map((name, i) => {
          const Icon = TAB_ICONS[name];
          return (
            <button
              key={name}
              role="tab"
              id={`tab-${name.toLowerCase()}`}
              aria-selected={tab === name}
              aria-controls={`panel-${name.toLowerCase()}`}
              onClick={() => {
                setTab(name);
                setVisited((prev) => new Set(prev).add(i));
              }}
              className={`${tabBase} text-[13px] ${tab === name ? tabActive : tabInactive}`}
            >
              <Icon size={15} aria-hidden="true" />
              {name}
            </button>
          );
        })}
      </div>
      {message && (
        <p
          role="status"
          className="mt-4 border-l-4 border-navy bg-white px-4 py-3 text-sm font-bold text-ink"
        >
          {message}
        </p>
      )}{" "}
      {/* Swipeable track: 6 panels translate horizontally in sync.
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
          {TABS.map((name, i) => (
            <div
              key={name}
              role="tabpanel"
              id={`panel-${name.toLowerCase()}`}
              aria-labelledby={`tab-${name.toLowerCase()}`}
              aria-hidden={tabIndex !== i}
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
