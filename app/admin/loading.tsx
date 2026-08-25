export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div>
            <div className="h-4 w-32 animate-pulse rounded bg-line" />
            <div className="mt-2 h-8 w-48 animate-pulse rounded bg-line" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-full bg-line" />
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="flex gap-2 border-b border-line pb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-line" />
          ))}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-t-2 border-ink bg-white p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-line" />
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-line" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
