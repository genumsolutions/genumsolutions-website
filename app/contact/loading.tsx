export default function ContactLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="h-4 w-24 animate-pulse rounded bg-line" />
      <div className="mt-3 h-10 w-72 animate-pulse rounded bg-line" />
      <div className="mt-3 h-4 w-96 animate-pulse rounded bg-line" />
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-16 animate-pulse rounded bg-line" />
              <div className="mt-2 h-12 w-full animate-pulse rounded bg-line" />
            </div>
          ))}
          <div className="h-12 w-32 animate-pulse rounded bg-line" />
        </div>
        <div className="space-y-3">
          <div className="h-5 w-48 animate-pulse rounded bg-line" />
          <div className="h-4 w-full animate-pulse rounded bg-line" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
        </div>
      </div>
    </div>
  )
}
