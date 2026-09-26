import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import ProjectsCatalog from "../../components/ProjectsCatalog";
import { getManagedProducts } from "../../lib/content-store";
import { getProjectCategories } from "../../lib/project-categories-store";
import { applyScope } from "../../lib/catalog";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Project packages and robot-car builds for teaching, automation, and prototyping from GENUM Solutions.",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  // U-47v4 (deep-check finding, same as /products): the WHOLE catalog used
  // to cross the server/client boundary — the RSC flight payload shipped
  // every 3D-model and electronics row to /projects hidden inside
  // ProjectsCatalog's props. Scope SERVER-SIDE (applyScope keeps Project
  // packages; the includeKits path re-adds Pre-packaged Kits client-side).
  const products = applyScope(await getManagedProducts(), "projects");
  const categories = await getProjectCategories();
  const categoryEntries = categories.map((c) => ({
    id: c.id,
    name: c.name,
    productCount: 0,
  }));
  return (
    <PageShell>
      <PageIntro
        eyebrow="Projects · packages & robot cars"
        title="Teaching, automation, and robot-car projects."
        body="Browse project packages and assembled robot-car builds, with components, sensors, and pricing together."
      />
      <div className="mx-auto max-w-7xl px-5 pb-2 lg:px-8">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-black text-white transition hover:bg-navy-dark"
        >
          Test & control on the IoT Controller
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <ProjectsCatalog products={products} categories={categoryEntries} includeKits />
    </PageShell>
  );
}
