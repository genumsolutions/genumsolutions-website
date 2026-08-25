import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-mist px-5">
      <section className="text-center">
        <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">404 · Off the bench</p>
        <h1 className="mt-3 font-display text-5xl font-bold">That page went missing.</h1>
        <p className="mt-4 text-muted">Try the shop or head back to the workshop.</p>
        <Link href="/products" className="mt-7 inline-block rounded-full bg-cobalt px-5 py-3 text-sm font-black text-white transition hover:bg-cobalt-dark">
          Browse products
        </Link>
      </section>
    </main>
  )
}
