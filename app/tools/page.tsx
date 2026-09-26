import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import IotRemote from "../../components/IotRemote";
import RoboticsFleet from "../../components/RoboticsFleet";
import OpenTools from "../../components/OpenTools";
import { getManagedProducts } from "../../lib/content-store";
import { applyScope } from "../../lib/catalog";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "Free and open-source tools for designing, simulating, programming, and documenting robotics and fabrication work. Includes the Control Panel.",
};

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  // U-46: the tools page now also shows the REAL parts you can drive with
  // these tools — the in-stock Electronic Products catalog (same DB as the
  // storefront), so makers can jump from tool to part without leaving.
  const stock = await getManagedProducts()
    .then((products) =>
      applyScope(products, "components")
        .filter((p) => p.active !== false && p.stock > 0)
        .slice(0, 8)
    )
    .catch(() => []);

  return (
    <PageShell>
      <PageIntro
        eyebrow="Tools · open source"
        title="Useful tools for the next build."
        body="A practical directory for designing, simulating, programming, and documenting robotics and fabrication work."
      />
      {/* IoT & Remote Controller section - embedded in tools page */}
      <IotRemote />

      {/* Fleet catalogue - mirrors the app's Remote screen fleet (W-5);
          descriptive only, live control stays parked (D-1) */}
      <RoboticsFleet />

      {/* OpenTools - third-party tools */}
      <OpenTools />

      {/* U-46: parts strip — bridge from tools to the live components store */}
      {stock.length > 0 && (
        <section className="border-t border-line bg-mist py-10 lg:py-14">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                  In stock now
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Parts you can build with today.
                </h2>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark"
              >
                Full catalog <ArrowRightIcon />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {stock.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="rounded-full border border-line bg-white px-4 py-2 text-xs font-black text-ink transition hover:border-navy hover:text-navy"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </PageShell>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
