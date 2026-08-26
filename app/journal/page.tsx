import type { Metadata } from 'next'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'

export const metadata: Metadata = {
  title: 'Journal',
  description: 'Tutorials, field notes, and industry observations for people building a more useful future.',
}

const posts = [
  { tag: 'Tutorial · Robotics', title: 'Your first ESP32 project: a calmer way to begin', text: 'A practical starting point for wiring, flashing, and debugging without the mystery.' },
  { tag: 'Field note · AI', title: 'Edge AI is useful when the decision needs to stay close', text: 'A grounded look at local inference, latency, privacy, and why not every sensor needs a cloud dashboard.' },
  { tag: 'Learning · Nepal', title: 'How to teach automation without making promises it cannot keep', text: 'A human-centered workshop format built around critical thinking, testing, and responsible use.' },
]

export default function JournalPage() {
  return (
    <PageShell>
      <PageIntro
        eyebrow="Journal · signals and practice"
        title="Notes from the workbench."
        body="Tutorials, field notes, and industry observations for people building a more useful future."
      />
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post.title} className="border-t-2 border-ink bg-white p-6">
              <p className="text-xs font-black uppercase tracking-widest text-navy">{post.tag}</p>
              <h2 className="mt-10 font-display text-2xl font-bold">{post.title}</h2>
              <p className="mt-3 leading-7 text-muted">{post.text}</p>
              <a className="mt-7 inline-block text-sm font-black text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark" href="/contact">Get in touch about this ↗</a>
            </article>
          ))}
        </div>

        <div className="mt-12 border-y border-line py-8">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Trend brief · August 2026</p>
          <h2 className="mt-3 font-display text-3xl font-bold">The useful future is more human than the hype cycle.</h2>
          <p className="mt-4 max-w-3xl leading-7 text-muted">
            The World Economic Forum points to technology change and skills gaps as major forces through 2030.
            The International Federation of Robotics emphasizes that robots automate tasks, while skills development
            and training help people capture the benefits. UNESCO&apos;s digital education guidance keeps human agency,
            critical thinking, and ethics at the center of AI learning. That is the standard we are building toward.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold">
            <a className="text-navy underline underline-offset-4 transition hover:text-navy-dark" href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/" target="_blank" rel="noreferrer">WEF Future of Jobs 2025 ↗</a>
            <a className="text-navy underline underline-offset-4 transition hover:text-navy-dark" href="https://ifr.org/ifr-press-releases/news/world-robotics-2025-report-asia-leads-global-robotics-growth" target="_blank" rel="noreferrer">IFR robotics research ↗</a>
            <a className="text-navy underline underline-offset-4 transition hover:text-navy-dark" href="https://www.unesco.org/en/digital-education" target="_blank" rel="noreferrer">UNESCO digital education ↗</a>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
