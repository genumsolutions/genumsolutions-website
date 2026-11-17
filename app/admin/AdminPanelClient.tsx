"use client";

import dynamicImport from "next/dynamic";

// The admin console reads window/localStorage and must never server-render.
// Next 16 rejects `ssr: false` in a Server Component, so the dynamic import
// lives in this client module and the page imports it statically.
const AdminPanel = dynamicImport(() => import("../../components/AdminPanel"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-7xl px-5 py-12 text-sm text-muted">Loading admin…</div>
  ),
});

export default AdminPanel;
