export default function AboutLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="h-4 w-32 animate-pulse rounded bg-line" />
      <div className="mt-3 h-10 w-96 animate-pulse rounded bg-line" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-line" />
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-t-2 border-ink pt-4">
            <div className="h-8 w-16 animate-pulse rounded bg-line" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-line" />
          </div>
        ))}
      </div>
      <div className="mt-12 grid gap-8 sm:mt-16 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-line" />
          <div className="h-8 w-64 animate-pulse rounded bg-line" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-line" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
        </div>
      </div>
    </div>
  )
}
