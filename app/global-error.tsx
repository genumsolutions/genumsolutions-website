'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f6f8fc', color: '#101b3d' }}>
        <main role="alert" className="grid min-h-screen place-items-center px-5 text-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-[#173eaa]">Something broke on our side</p>
            <h1 className="mt-3 font-display text-5xl font-bold">500 — Workshop hiccup.</h1>
            <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">
              An unexpected error interrupted this page. Our engineers have been paged. Try again, or head back to safety.
            </p>
            {error?.digest && <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={reset}
                className="rounded-full bg-navy px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark"
              >
                Try again
              </button>
              <a
                href="/"
                className="rounded-full border border-line bg-white px-6 py-3.5 text-sm font-black text-ink transition hover:border-navy hover:text-navy"
              >
                Back to home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
