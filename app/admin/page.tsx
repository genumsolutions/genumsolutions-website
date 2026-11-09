import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { getCurrentAdmin, getCurrentUserRole } from "../../lib/admin";
import { getManagedProducts } from "../../lib/content-store";
import LogoutButton from "../../components/LogoutButton";

const AdminPanel = dynamicImport(() => import("../../components/AdminPanel"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-7xl px-5 py-12 text-sm text-muted">Loading admin…</div>
  ),
});

export const dynamic = "force-dynamic";
// U-48: robots.txt already disallows /admin, but disallow is only a hint to
// well-behaved crawlers — the noindex meta tag is the directive that actually
// keeps the dashboard out of the index (matches /account).
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const [admin, products, role] = await Promise.all([
    getCurrentAdmin(),
    getManagedProducts(),
    getCurrentUserRole(),
  ]);
  if (!admin || !role) redirect("/login");

  // U-UI1 (2026-11-09): the header now states three things in one glance — who
  // you are signed in as (role chip + email), which surface this is (eyebrow),
  // and what the console covers. Before it was a logo, a lone title and an
  // email pill, which read like a public page with tabs bolted on.
  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Staff";
  return (
    // U-42: no min-h-screen — the mist background ends with the content
    // instead of stretching to the viewport below short tabs.
    <main className="min-h-0 bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-3"
              aria-label="GENUM SOLUTIONS home"
            >
              <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line transition group-hover:ring-navy/40 sm:h-12 sm:w-12">
                <Image
                  src="/logo.png"
                  alt="GENUM SOLUTIONS stamp"
                  width={112}
                  height={112}
                  className="h-full w-full object-contain"
                  priority
                />
              </span>
              <span aria-hidden="true" className="hidden h-8 w-px bg-line sm:block" />
              <span className="leading-none">
                <strong className="block font-display text-base font-bold tracking-tight text-ink sm:text-lg">
                  GENUM
                </strong>
                <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.3em] text-navy sm:text-[10px]">
                  Solutions Pvt.&thinsp;Ltd.
                </span>
              </span>
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                  role === "staff" ? "border border-line bg-white text-navy" : "bg-navy text-white"
                }`}
                title={`Signed in as ${roleLabel}`}
              >
                {roleLabel}
              </span>
              <span
                className="hidden max-w-[16rem] truncate text-xs font-semibold text-muted md:block"
                title={admin.email}
              >
                {admin.email}
              </span>
              <LogoutButton className="shrink-0 rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-red-300 hover:text-red-600" />
            </div>
          </div>
          <div className="mt-6 max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-navy">
              Staff console
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight text-ink sm:text-[32px]">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              The storefront, the mobile app and every device share one Supabase project. Everything
              you change here is what they see on the next load.
            </p>
          </div>
        </div>
      </header>
      <AdminPanel initialProducts={products} currentRole={role} />
    </main>
  );
}
