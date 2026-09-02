export default function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="grid-paper border-b border-line">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-[-.04em] text-ink sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:mt-5 sm:text-lg">{body}</p>
        </div>
      </div>
    </section>
  )
}
