export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-12 lg:px-8 lg:py-16" aria-hidden="true">
      <div className="h-9 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="h-48 animate-pulse bg-slate-200" />
            <div className="space-y-3 p-5">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
