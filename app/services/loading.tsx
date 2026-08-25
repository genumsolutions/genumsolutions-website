export default function ServicesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="h-4 w-40 animate-pulse rounded bg-line" />
      <div className="mt-3 h-10 w-80 animate-pulse rounded bg-line" />
      <div className="mt-3 h-4 w-96 animate-pulse rounded bg-line" />
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-t-2 border-ink bg-white p-6">
            <div className="h-3 w-24 animate-pulse rounded bg-line" />
            <div className="mt-10 h-7 w-40 animate-pulse rounded bg-line" />
            <div className="mt-3 h-4 w-20 animate-pulse rounded bg-line" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-line" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
