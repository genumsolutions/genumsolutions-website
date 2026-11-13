import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bot, Cpu, Home, Plane, Sprout, Trash2, Wifi } from "lucide-react";
import ArticleCard from "../../components/ArticleCard";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import ServicesGrid from "../../components/ServicesGrid";
import { listServices } from "../../lib/services";
import {
  getCurriculumHighlights,
  getPilotCosts,
  getTrainingPrograms,
} from "../../lib/programs-store";

export const metadata: Metadata = {
  title: "Services & Training",
  description:
    "Web delivery, 3D printing, school STEM packages, teacher workshops, and training programs from GENUM Solutions.",
};

// The academy tracks used to live on a separate /academy page that repeated
// this page's training programmes and age-band curriculum. The unique part —
// the learning streams — now lives here, and /academy permanently redirects
// to #academy (see next.config.mjs), so one page owns the training story.
const streams = [
  {
    id: "robotics",
    name: "Robotics & robot cars",
    icon: Bot,
    body: "Chassis, motors, motor drivers, steering and PID — 2WD, 4WD, self-balancing and path-following builds.",
  },
  {
    id: "electronics",
    name: "Electronics & soldering",
    icon: Cpu,
    body: "Components, breadboards, sensors, power and safe soldering — the part every later stream depends on.",
  },
  {
    id: "iot",
    name: "IoT & automation",
    icon: Wifi,
    body: "ESP32 Wi-Fi, MQTT-style control, cloud dashboards and the Control Panel used to drive a build from a browser.",
  },
  {
    id: "home",
    name: "Smart home",
    icon: Home,
    body: "Relays, lights, door locks and sensors, plus the voice and app control that make them usable.",
  },
  {
    id: "farm",
    name: "Smart farm",
    icon: Sprout,
    body: "Soil moisture, irrigation pumps, greenhouses and the autonomy rules that save water.",
  },
  {
    id: "city",
    name: "Smart city & waste",
    icon: Trash2,
    body: "Street lighting, parking, air quality and the smart dustbin — the public-facing projects schools ask for.",
  },
  {
    id: "drones",
    name: "Aerial drones",
    icon: Plane,
    body: "Frames, ESCs, flight controllers, telemetry and safe first flights.",
  },
];

const processSteps = [
  ["01", "Share the outcome", "Tell us what you need to sell, print, teach, publish, or build."],
  [
    "02",
    "Shape the scope",
    "We recommend the right mix of content, materials, sessions, files, and delivery milestones.",
  ],
  [
    "03",
    "Review the quote",
    "You receive clear pricing in NPR, lead times, inclusions, and optional upgrades.",
  ],
  [
    "04",
    "Deliver and hand over",
    "We test, document, train, and leave you with a practical next step.",
  ],
];

// U-48: no force-dynamic — statically rendered, revalidated in the background
// (layout `revalidate = 300`). Service edits bust the cache via
// revalidateServices(); training/pilot/curriculum edits via revalidatePrograms().

export default async function ServicesPage() {
  const services = await listServices();
  // Training / pilot-cost / curriculum content comes from the DB (shared
  // tables, same source the native app reads) with bundled fallback.
  const [trainingPrograms, pilotCosts, stemProjectHighlights] = await Promise.all([
    getTrainingPrograms(),
    getPilotCosts(),
    getCurriculumHighlights(),
  ]);
  // The total used to be typed into this file, so it kept claiming NPR 8,40,000
  // after an admin edited a pilot line. Add the rows up only while every cost is
  // a plain NPR amount; otherwise say the total is quoted per proposal rather
  // than print a number the table contradicts.
  const pilotAmounts = pilotCosts.map(({ cost }) =>
    /^NPR [\d,]+$/.test(cost.trim()) ? Number(cost.replace(/[^\d]/g, "")) : NaN
  );
  const pilotTotal =
    pilotAmounts.length > 0 && pilotAmounts.every((amount) => amount > 0)
      ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
          pilotAmounts.reduce((sum, amount) => sum + amount, 0)
        )
      : null;
  return (
    <PageShell>
      <PageIntro
        eyebrow="Services · training · fabrication"
        title="Useful support from first idea to finished result."
        body="GENUM combines web delivery, robotics education, 3D and 2D printing, school packages, training programs, and design support for students, schools, institutions, hobbyists, and businesses."
      />

      {/* ─── Services ─── */}
      <section id="services" className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[.24em] text-navy">What we offer</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Services you can book.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Every service carries its price so you can compare before asking for a quote. Filter the
          grid by category to narrow it down.
        </p>
        <ServicesGrid services={services} />

        {/* One panel instead of a full-width rule: the next section already draws
            a top border, so the old border-y left a double line on the page. */}
        <div className="mt-10 grid gap-6 rounded-2xl border border-line bg-mist p-5 sm:p-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">How it works</p>
            <h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
              Clear scope before commitment.
            </h3>
            <p className="mt-4 leading-7 text-slate-600">
              For websites, print jobs, workshops, and lab projects, we separate the deliverables,
              materials, schedule, and handover so the next step is easy to approve.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {processSteps.map(([number, title, text]) => (
              <div key={number} className="border-l-2 border-gold pl-4">
                <p className="text-xs font-black text-navy">
                  {number} · {title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Learning Streams ─── */}
      <section id="academy" className="border-t border-line">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
            Robotic Academy · Kathmandu
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Learning streams
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {streams.length} lab tracks, each backed by a real kit, a real project in the workshop,
            and a Control Panel window learners can drive.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {streams.map((stream) => {
              const Icon = stream.icon;
              return (
                <article key={stream.id} className="rounded-2xl border border-line bg-white p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mist text-navy">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 break-words font-display text-base font-bold text-ink">
                    {stream.name}
                  </h3>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-600">{stream.body}</p>
                </article>
              );
            })}
          </div>
          <Link
            href="/projects"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark"
          >
            See the projects each track builds
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ─── Training Programs ─── */}
      <section id="training" className="border-y border-line bg-mist">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
            Training programs
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Programs that build careers.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            GENUM&apos;s source curriculum combines 100+ age-banded STEM projects with modular
            robotics, teacher enablement, and measurable pilot support.
          </p>
          {trainingPrograms.length === 0 && (
            <p className="mt-8 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600">
              The current program schedule is being refreshed.{" "}
              <Link
                href="/contact"
                className="font-bold text-navy underline decoration-gold decoration-2 underline-offset-4"
              >
                Ask for dates and the outline
              </Link>{" "}
              and we will send what is running next.
            </p>
          )}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {trainingPrograms.map((program) => (
              <ArticleCard
                key={program.title}
                variant="rounded"
                title={program.title}
                description={program.description}
              >
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gold">
                    {program.audience}
                  </p>
                  <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-navy">
                    {program.duration}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  <strong className="text-ink">Outcome:</strong> {program.outcome}
                </p>
              </ArticleCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── School Packages & Pilot Costs ─── */}
      <section id="pilots" className="mx-auto max-w-7xl px-5 pb-14 pt-10 sm:pt-14 lg:px-8">
        {/* The section used to open inside its left column, so "Illustrative
            pilot costing" was an h2 competing with "STEM Project Highlights"
            as a peer. One heading owns the section; the columns carry h3s. */}
        <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
          School packages · pilot costing
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          A transparent starting point for a school proposal.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          The source proposal models a three-classroom pilot with 30 kits. These figures are
          illustrative, shown in NPR for planning, and confirmed after scope, taxes, delivery, and
          local procurement review.
        </p>

        <div className="mt-8 grid gap-8 sm:gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold tracking-tight text-ink">
              Illustrative pilot costing
            </h3>
            <p className="mt-4 font-display text-2xl font-bold text-navy sm:text-3xl">
              {pilotTotal ? (
                <>
                  NPR {pilotTotal}{" "}
                  <span className="font-sans text-sm font-normal text-slate-500">
                    illustrative total
                  </span>
                </>
              ) : (
                <span className="font-sans text-base font-bold text-slate-500">
                  Priced per proposal
                </span>
              )}
            </p>
            {pilotCosts.length === 0 && (
              <p className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600">
                Line-item costing is prepared with each proposal — request one and we will list
                kits, logistics and training separately.
              </p>
            )}
            {pilotCosts.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[320px] sm:min-w-[400px] text-left text-sm">
                  <caption className="sr-only">
                    Illustrative three-classroom pilot cost breakdown in NPR
                  </caption>
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wider text-slate-400">
                      <th scope="col" className="py-2 pr-4 font-bold">
                        Line item
                      </th>
                      <th scope="col" className="py-2 font-bold">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pilotCosts.map(({ item, cost, note }) => (
                      <tr key={item} className="border-b border-line last:border-b-0">
                        <th scope="row" className="py-3 pr-4 align-top font-semibold text-ink">
                          {item}
                          <span className="block text-xs font-normal leading-5 text-slate-500">
                            {note}
                          </span>
                        </th>
                        <td className="py-3 align-top font-display font-bold">{cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold tracking-tight text-ink">
              STEM project highlights
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Age-banded project examples from our 100+ project curriculum catalog.
            </p>
            {stemProjectHighlights.length === 0 && (
              <p className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600">
                Age-band examples are being updated. Ask for the curriculum outline and we will send
                the current project list.
              </p>
            )}
            {stemProjectHighlights.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stemProjectHighlights.map(({ ageBand, items }) => (
                  <div key={ageBand} className="rounded-2xl border border-line bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-gold">
                      {ageBand}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-600">
                      {items.map((project) => (
                        <li key={project}>{project}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark"
              >
                Request a school proposal
              </Link>
              <Link
                href="/products"
                className="inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-black text-ink transition hover:border-navy hover:text-navy"
              >
                Browse products
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
