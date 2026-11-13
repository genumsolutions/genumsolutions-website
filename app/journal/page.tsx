import type { Metadata } from "next";
import Link from "next/link";
import ArticleCard from "../../components/ArticleCard";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import { getJournalPosts } from "../../lib/journal-store";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Tutorials, field notes, and industry observations for people building a more useful future.",
};

// Journal content lives in the `journal_posts` table (DB-first, admin-editable)
// with the bundled posts as fallback - both the website and the app render the
// same latest posts.
// U-48: no force-dynamic — statically rendered, revalidated in the background
// (layout `revalidate = 300`). Journal edits bust the cache via
// revalidateJournal() from every journal write path.

export default async function JournalPage() {
  const posts = await getJournalPosts();
  return (
    <PageShell>
      <PageIntro
        eyebrow="Journal · signals and practice"
        title="Notes from the workbench."
        body="Tutorials, field notes, and industry observations for people building a more useful future."
      />
      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        {/* The grid used to open straight under the page intro with no label,
            and every card carried the same "Get in touch about this" link
            because there is no per-post page to open. One heading, one CTA. */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              Latest entries
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              What we published recently.
            </h2>
          </div>
          {posts.length > 0 && (
            <p className="text-sm font-bold text-muted">
              {posts.length} note{posts.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {posts.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-muted">
            The journal is between entries.{" "}
            <Link
              href="/contact"
              className="font-bold text-navy underline decoration-gold decoration-2 underline-offset-4"
            >
              Ask what we are working on
            </Link>{" "}
            and we will send the notes behind it.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <ArticleCard
                key={post.id}
                variant="rounded"
                tag={post.tag}
                title={post.title}
                description={post.text}
              />
            ))}
          </div>
        )}

        {posts.length > 0 && (
          <p className="mt-6 text-sm leading-6 text-muted">
            Want the full write-up, the files, or a session on one of these topics?{" "}
            <Link
              href="/contact"
              className="font-bold text-navy underline decoration-gold decoration-2 underline-offset-4"
            >
              Ask us about it
            </Link>
            .
          </p>
        )}

        <div className="mt-10 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
            Trend brief · August 2026
          </p>
          <h2 className="mt-3 font-display text-xl font-bold sm:text-2xl lg:text-3xl">
            The useful future is more human than the hype cycle.
          </h2>
          <p className="mt-4 max-w-3xl leading-7 text-muted">
            The World Economic Forum points to technology change and skills gaps as major forces
            through 2030. The International Federation of Robotics emphasizes that robots automate
            tasks, while skills development and training help people capture the benefits.
            UNESCO&apos;s digital education guidance keeps human agency, critical thinking, and
            ethics at the center of AI learning. That is the standard we are building toward.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold">
            <a
              className="text-navy underline underline-offset-4 transition hover:text-navy-dark"
              href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/"
              target="_blank"
              rel="noreferrer"
            >
              WEF Future of Jobs 2025 ↗
            </a>
            <a
              className="text-navy underline underline-offset-4 transition hover:text-navy-dark"
              href="https://ifr.org/ifr-press-releases/news/world-robotics-2025-report-asia-leads-global-robotics-growth"
              target="_blank"
              rel="noreferrer"
            >
              IFR robotics research ↗
            </a>
            <a
              className="text-navy underline underline-offset-4 transition hover:text-navy-dark"
              href="https://www.unesco.org/en/digital-education"
              target="_blank"
              rel="noreferrer"
            >
              UNESCO digital education ↗
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
