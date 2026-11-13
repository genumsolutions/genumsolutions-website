import { PROJECT_TYPES } from "../lib/project-types";

/**
 * Compact index of every build family the workshop has source, firmware and a
 * parts list for.
 *
 * It used to be a second grid of cards, each republishing a summary and a link
 * to a package that then appeared AGAIN in the catalogue below — the owner
 * flagged that as duplicate data on the projects page. The catalogue is now the
 * only place a project is sold; this section only answers "what can the
 * workshop build?" in one compact block, so a family with no package yet is
 * still visible without pretending to be a listing.
 */
export default function ProjectTypes() {
  return (
    <section className="mx-auto max-w-7xl px-5 lg:px-8" aria-labelledby="build-families-heading">
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="build-families-heading"
            className="font-display text-lg font-bold text-ink sm:text-xl"
          >
            Build families in the workshop
          </h2>
          <p className="text-xs font-bold text-muted">
            {PROJECT_TYPES.length} families · packages listed below
          </p>
        </div>
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECT_TYPES.map((type) => (
            <li key={type.id} className="min-w-0 border-t border-line pt-2">
              <span className="block break-words text-sm font-bold leading-snug text-ink">
                {type.name}
              </span>
              <span className="mt-0.5 block break-words text-[11px] font-medium leading-5 text-muted">
                {type.modes.length > 0 ? type.modes.join(" · ") : type.sourceFolder}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-5 text-muted">
          Family without a package here? It is built to scope — send the requirement and we quote
          the parts, firmware and build time together.
        </p>
      </div>
    </section>
  );
}
