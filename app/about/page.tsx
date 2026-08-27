import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'

export const metadata: Metadata = {
  title: 'About',
  description: 'GENUM Solutions brings a decade of telecom, IoT, embedded systems, and STEAM education experience from Kathmandu, Nepal.',
}

const competencies = [
  ['Microcontrollers', 'ESP32, Arduino, STM32, and ARM-based systems'],
  ['Cloud platforms', 'AWS, Azure, Google Cloud, Firebase, and IoT backends'],
  ['IoT networks', 'WiFi, Bluetooth, LoRaWAN, MQTT, CoAP, and Zigbee'],
  ['Embedded systems', 'Firmware, real-time systems, and hardware-software integration'],
  ['Programming', 'Python, C++, JavaScript, Java, and Embedded C'],
  ['STEAM education', 'Curriculum development, mentoring, and technical workshops'],
]

const whatWeDo = [
  { title: 'Products & components', body: 'Robotics kits, controllers, sensors, motors, and modules — sourced, tested, and ready to build with.', href: '/products', cta: 'Browse catalog' },
  { title: 'Projects & robot cars', body: 'Assembled robot-car builds and named project packages for teaching, automation, and prototyping.', href: '/projects', cta: 'See projects' },
  { title: 'Services & training', body: 'Web delivery, 3D printing, school STEM packages, teacher workshops, and curriculum programs.', href: '/services', cta: 'View services' },
  { title: 'Open tools', body: 'Free and open-source tools for makers, educators, and developers.', href: '/tools', cta: 'Explore tools' },
]

export default function AboutPage() {
  return (
    <PageShell>
      <PageIntro
        eyebrow="About GENUM"
        title="Engineering with a reason to exist."
        body="GENUM brings a decade of telecom, IoT, embedded systems, project delivery, and STEAM education experience into a company built for practical technology."
      />

      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="border-t-2 border-ink pt-4">
            <strong className="font-display text-2xl sm:text-3xl">25+</strong>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">projects completed</p>
          </div>
          <div className="border-t-2 border-ink pt-4">
            <strong className="font-display text-2xl sm:text-3xl">10+</strong>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">years in engineering</p>
          </div>
          <div className="border-t-2 border-ink pt-4">
            <strong className="font-display text-2xl sm:text-3xl">50+</strong>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">clients served</p>
          </div>
          <div className="border-t-2 border-ink pt-4">
            <strong className="font-display text-2xl sm:text-3xl">500+</strong>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">students trained</p>
          </div>
        </div>

        <div className="mt-12 grid gap-8 sm:mt-16 sm:gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">How we work</p>
            <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl lg:text-4xl">Make the complex useful.</h2>
          </div>
          <div>
            <p className="leading-8 text-slate-600">
              GENUM started with a fascination for how things communicate wirelessly and grew through telecom infrastructure,
              embedded systems, smart automation, cloud-connected devices, and technical education. The company now gives that
              experience a home: products people can build with, services that solve real problems, and training that leaves
              people more capable than when they arrived.
            </p>
            <p className="mt-5 leading-8 text-slate-600">
              Our working values are simple: innovation with evidence, collaboration with clear ownership,
              and continuous growth through testing and sharing.
            </p>
          </div>
        </div>
      </section>

      {/* ─── What We Do (cross-links) ─── */}
      <section className="border-y border-line bg-mist">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">What we do</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Our work in practice.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whatWeDo.map((item) => (
              <article key={item.title} className="flex flex-col rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-navy hover:shadow-lg">
                <h3 className="font-display text-lg font-bold leading-snug">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{item.body}</p>
                <Link href={item.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-navy transition hover:gap-2.5">
                  {item.cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Technical foundation ─── */}
      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Technical foundation</p>
        <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl lg:text-4xl">Capabilities we bring to every project.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competencies.map(([title, text]) => (
            <article key={title} className="border-l-2 border-gold bg-white p-5">
              <h3 className="font-display text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  )
}
