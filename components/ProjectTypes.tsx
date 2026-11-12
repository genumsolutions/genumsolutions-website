import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PROJECT_TYPES, projectTypeProductIds } from "../lib/project-types";
import { cardClass } from "../lib/styles";

/**
 * Every build family the workshop actually has, one card each.
 *
 * Before this section, /projects only listed catalog rows: the obstacle,
 * path-follow, RF and Wi-Fi car projects existed in the repo and in the modes
 * table, but nothing on the page said so. Each card names the source folder, the
 * modes it covers, and — when the catalog has the row — links straight to the
 * package. A missing row reads "In the workshop" instead of pretending to be
 * for sale.
 */
export default function ProjectTypes({ productIds }: { productIds: string[] }) {
  // Ids only: /projects deliberately does not ship the whole catalog across the
  // RSC boundary, and a Set of ~100 short ids is what this section needs to
  // know whether a build can be bought. Rows scoped out of the projects list
  // (e.g. kit-package rows) still count as available.
  const available = new Set(productIds);

  return (
    <section className="mx-auto max-w-7xl px-5 pb-4 lg:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
          Project types in the workshop
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Every build family GENUM has source, firmware and a parts list for. Project packages below
          group them by application — Robo Car, Smart Home, Smart Farm, Smart City, Smart Dustbin
          and Aerial Drones.
        </p>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROJECT_TYPES.map((type) => {
          const product = projectTypeProductIds(type).find((id) => available.has(id));
          return (
            <article key={type.id} className={cardClass}>
              <p className="break-words text-[10px] font-black uppercase tracking-[0.18em] text-navy">
                {type.sourceFolder}
              </p>
              <h3 className="mt-2 break-words font-display text-base font-bold leading-snug text-ink">
                {type.name}
              </h3>
              <p className="mt-2 break-words text-sm leading-6 text-muted">{type.summary}</p>
              {type.modes.length > 0 && (
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {type.modes.map((mode) => (
                    <span
                      key={mode}
                      className="rounded-full bg-mist px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted"
                    >
                      {mode}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-3 text-xs font-bold">
                {product ? (
                  <Link
                    href={`/products/${product}`}
                    className="inline-flex items-center gap-1.5 text-navy hover:gap-2.5"
                  >
                    Open the package <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="text-muted">In the workshop — quote by scope</span>
                )}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
