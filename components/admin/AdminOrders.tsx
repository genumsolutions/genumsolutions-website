"use client";

import { useEffect, useState } from "react";
import { formatNPR } from "../../lib/catalog";
import { inputClass } from "../../lib/styles";
import type { OrderPage } from "./admin-types";
import { STATUSES, PAGE_SIZE } from "./admin-types";
import {
  EmptyState,
  LoadingRow,
  Pager,
  formatTimestamp,
  panelCard,
  panelHeader,
  panelRow,
} from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Orders tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const ORDER_SUBTABS = ["All", "Pending", "Paid", "Fulfilled", "Cancelled"] as const;
type OrderSubTab = (typeof ORDER_SUBTABS)[number];

type OrderRow = OrderPage["orders"][number];

export default function AdminOrders({ canDelete }: { canDelete: boolean }) {
  const [orderData, setOrderData] = useState<OrderPage>({
    orders: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [loaded, setLoaded] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [subTab, setSubTab] = useState<OrderSubTab>("All");
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrders(page: number) {
    setLoaded(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (orderQuery.trim()) params.set("q", orderQuery.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (subTab !== "All") params.set("subTab", subTab);
      const response = await fetch(`/api/admin/orders?${params}`);
      if (response.ok) setOrderData(await response.json());
    } finally {
      setLoaded(true);
    }
  }

  async function setOrderStatus(id: string, status: string) {
    const response = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (response.ok)
      setOrderData((current) => ({
        ...current,
        orders: current.orders.map((order) => (order.id === id ? { ...order, status } : order)),
      }));
  }

  async function deleteOrder(id: string) {
    if (
      !window.confirm(
        `Delete order #${id.slice(0, 8).toUpperCase()}? This also removes its finance transactions.`
      )
    )
      return;
    const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setOrderData((current) => ({
        ...current,
        orders: current.orders.filter((order) => order.id !== id),
        total: Math.max(0, current.total - 1),
      }));
    } else {
      const result = await response.json().catch(() => ({}));
      window.alert(result.error || "Could not delete the order.");
    }
  }

  const statusMap: Record<string, OrderSubTab> = {
    pending: "Pending",
    paid: "Paid",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };

  return (
    <section aria-label="Customer orders" className="mt-4 space-y-4">
      <div className={`${panelCard} ${panelHeader}`}>
        <h2 className="font-display text-xl font-bold">Customer orders</h2>

        {/* U-UI2 sub-tabs strip - sticky, one at a time */}
        <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
          <div
            role="tablist"
            aria-label="Order sub-tabs"
            className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ORDER_SUBTABS.map((sub: OrderSubTab, _: number) => (
              <button
                key={sub}
                role="tab"
                aria-selected={subTab === sub}
                aria-controls={`order-subpanel-${sub}`}
                tabIndex={subTab === sub ? 0 : -1}
                onClick={() => setSubTab(sub)}
                className={`${tabBase} text-[10px] ${subTab === sub ? tabActive : tabInactive}`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        <label className="ml-auto text-sm font-bold text-slate-500">
          Search buyer
          <input
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadOrders(1)}
            placeholder="email or name"
            aria-label="Search orders"
            className={`mt-1 w-full sm:ml-2 sm:mt-0 sm:w-48 ${inputClass}`}
          />
        </label>
        <label className="text-sm font-bold text-slate-500">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="ml-2 rounded-lg border border-line px-3 py-2 text-sm font-bold"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => void loadOrders(1)}
          className="rounded-lg bg-navy px-4 py-2.5 text-xs font-black text-white transition hover:bg-navy-dark"
        >
          Apply
        </button>
      </div>

      {!loaded ? (
        <LoadingRow />
      ) : orderData.orders.length === 0 ? (
        <EmptyState>No orders match this search yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {orderData.orders.map((order) => {
            const orderStatus = order.status?.toLowerCase() as keyof typeof statusMap;
            const matchesSubTab =
              subTab === "All" ? true : (statusMap[orderStatus] ?? "All") === subTab;

            return matchesSubTab ? (
              <li key={order.id} className={panelRow}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black">
                      #{order.id.slice(0, 8).toUpperCase()} · {formatNPR(order.totalNpr)}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                      {order.customerName} · {order.email}
                    </p>
                    <p className="break-words text-xs text-slate-400">{order.address}</p>
                    <p className="text-xs text-slate-400">
                      {order.provider} · {formatTimestamp(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={order.status}
                      onChange={(e) => setOrderStatus(order.id, e.target.value)}
                      aria-label={`Status for ${order.id.slice(0, 8)}`}
                      className="min-h-[36px] rounded-lg border border-line px-2.5 py-1 text-xs font-bold"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        setExpandedId((current) => (current === order.id ? undefined : order.id))
                      }
                      aria-expanded={expandedId === order.id}
                      className="min-h-[36px] rounded-lg border border-line px-3 py-1 text-xs font-bold text-navy transition hover:border-navy"
                    >
                      {expandedId === order.id ? "Hide" : "Details"}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deleteOrder(order.id)}
                        className="min-h-[36px] rounded-lg border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.name}`} className="truncate">
                      {item.quantity} × {item.name} ({formatNPR(item.price * item.quantity)})
                    </li>
                  ))}
                </ul>
                {expandedId === order.id && (
                  <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 border-t border-line pt-3 text-xs leading-5">
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Order id</dt>
                    <dd className="break-all text-slate-700">{order.id}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Buyer</dt>
                    <dd className="text-slate-700">
                      {order.customerName} · {order.email}
                    </dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Phone</dt>
                    <dd className="text-slate-700">
                      {(order as OrderRow & { phone?: string }).phone || "—"}
                    </dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Address</dt>
                    <dd className="break-words text-slate-700">{order.address || "—"}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Provider</dt>
                    <dd className="text-slate-700">
                      {order.provider}
                      {(order as OrderRow & { providerRef?: string }).providerRef
                        ? ` · ref ${(order as OrderRow & { providerRef?: string }).providerRef}`
                        : ""}
                    </dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Placed</dt>
                    <dd className="text-slate-700">{formatTimestamp(order.createdAt)}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Items</dt>
                    <dd className="text-slate-700">
                      <ul className="space-y-0.5">
                        {order.items.map((item) => (
                          <li key={`${order.id}-detail-${item.name}`}>
                            {item.quantity} × {item.name} @ {formatNPR(item.price)}
                          </li>
                        ))}
                      </ul>
                    </dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Total</dt>
                    <dd className="font-black text-ink">{formatNPR(order.totalNpr)}</dd>
                  </dl>
                )}
              </li>
            ) : null;
          })}
        </div>
      )}
      <Pager
        page={orderData.page}
        totalPages={orderData.totalPages}
        onPage={(page) => void loadOrders(page)}
      />
      <p className="text-xs text-slate-400">
        {orderData.total} total order{orderData.total === 1 ? "" : "s"}
      </p>
    </section>
  );
}
