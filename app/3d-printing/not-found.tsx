import Link from 'next/link'

export default function PrintingNotFound() {
  return <main className="grid min-h-screen place-items-center bg-mist px-5"><section className="text-center"><h1 className="font-display text-4xl font-bold">Printing route unavailable.</h1><Link href="/" className="mt-5 inline-block text-sm font-bold text-cobalt underline underline-offset-4">Back to GENUM ↗</Link></section></main>
}
