export default function AdminLoading() {
  // U-UI1 (2026-11-09): skeleton mirrors the real chrome — brand row, role pill,
  // eyebrow + title + subtitle, one-row tab strip, the tab hint line, then the
  // card grid — so the first paint does not jump when the console arrives.
  return (
    <main className="min-h-0 bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-line sm:h-12 sm:w-12" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-16 animate-pulse rounded bg-line" />
                <div className="h-2 w-24 animate-pulse rounded bg-line" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-14 animate-pulse rounded-full bg-line" />
              <div className="hidden h-4 w-40 animate-pulse rounded bg-line md:block" />
              <div className="h-9 w-20 animate-pulse rounded-lg bg-line" />
            </div>
          </div>
          <div className="mt-6 max-w-2xl space-y-2">
            <div className="h-2 w-24 animate-pulse rounded bg-line" />
            <div className="h-8 w-64 max-w-full animate-pulse rounded bg-line" />
            <div className="h-3 w-full animate-pulse rounded bg-line" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 pb-14 lg:px-8">
        <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-5 overflow-hidden pb-0.5 pt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="my-2 h-4 w-20 shrink-0 animate-pulse rounded bg-line" />
            ))}
          </div>
        </div>
        <div className="mt-4 h-3 w-72 max-w-full animate-pulse rounded bg-line" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-white p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-line" />
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-line" />
              <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-line" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
