import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Cpu, Home, Plane, Sprout, Trash2, Wifi } from "lucide-react";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import { getCurriculumHighlights, getTrainingPrograms } from "../../lib/programs-store";
import { cardClass } from "../../lib/styles";

export const metadata: Metadata = {
  title: "Robotic Academy",
  description:
    "GENUM's robotics academy: age-band tracks, teacher and school programmes, and the lab projects learners build — robot cars, smart home, farm, city, dustbin and drones.",
};

// The academy's own categories. Each stream is a lab track: a learner can pick
// one and build through it, and each one maps to a project category the catalog
// and the Control Panel already know about.
const streams = [
  {
    id: "robotics",
    name: "Robotics & robot cars",
    icon: Bot,
    body: "Chassis, motors, motor drivers, steering and PID — 2WD, 4WD, self-balancing and path-following builds.",
    category: "Robo Car",
  },
  {
    id: "electronics",
    name: "Electronics & soldering",
    icon: Cpu,
    body: "Components, breadboards, sensors, power and safe soldering — the part every later stream depends on.",
    category: null,
  },
  {
    id: "iot",
    name: "IoT & automation",
    icon: Wifi,
    body: "ESP32 Wi-Fi, MQTT-style control, cloud dashboards and the Control Panel used to drive a build from a browser.",
    category: "Remote Controller",
  },
  {
    id: "home",
    name: "Smart home",
    icon: Home,
    body: "Relays, lights, door locks and sensors, plus the voice and app control that make them usable.",
    category: "Smart Home",
  },
  {
    id: "farm",
    name: "Smart farm",
    icon: Sprout,
    body: "Soil moisture, irrigation pumps, greenhouses and the autonomy rules that save water.",
    category: "Smart Farm",
  },
  {
    id: "city",
    name: "Smart city & waste",
    icon: Trash2,
    body: "Street lighting, parking, air quality and the smart dustbin — the public-facing projects schools ask for.",
    category: "Smart City",
  },
  {
    id: "drones",
    name: "Aerial drones",
    icon: Plane,
    body: "Frames, ESCs, flight controllers, telemetry and safe first flights.",
    category: "Aerial Drones",
  },
];

// The academy also runs on top of the training programs and age-band
// curriculum that already live in the shared Supabase tables (the app's home
// screen reads the same rows), so this page never invents a second copy.

export default async function AcademyPage() {
  const [programs, curriculum] = await Promise.all([
    getTrainingPrograms(),
    getCurriculumHighlights(),
  ]);

  return (
    <PageShell>
      <PageIntro
        eyebrow="Robotic Academy · Kathmandu"
        title="A robotics academy organised by track, age band and lab."
        body="Seven learning streams, age-banded curriculum and school programmes — each one backed by a real kit, a real project in the workshop, and a Control Panel window learners can drive."
      />

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Learning streams</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          Each stream is a lab track with its own hardware list. The last column links to the
          projects page filtered by that application.
        </p>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map((stream) => {
            const Icon = stream.icon;
            return (
              <article key={stream.id} className={cardClass}>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mist text-navy">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <h3 className="mt-3 break-words font-display text-base font-bold text-ink">
                  {stream.name}
                </h3>
                <p className="mt-2 break-words text-sm leading-6 text-muted">{stream.body}</p>
                {stream.category && (
                  <p className="mt-3">
                    <Link
                      href="/projects"
                      className="inline-flex items-center gap-1.5 text-xs font-black text-navy hover:gap-2.5"
                    >
                      {stream.category} projects <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {curriculum.length > 0 && (
        <section className="border-t border-line bg-white">
          <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
              Tracks by age band
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              What a learner can build at each stage. Edited in the admin dashboard under Content,
              and shown in the app on the same day.
            </p>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {curriculum.map((band) => (
                <article key={band.ageBand} className={cardClass}>
                  <p className="break-words text-[10px] font-black uppercase tracking-[0.18em] text-navy">
                    {band.ageBand}
                  </p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
                    {band.items.map((item) => (
                      <li key={item} className="break-words">
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {programs.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Programmes</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            School packages, teacher enablement and lab deployments.
          </p>
          <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
            {programs.map((program) => (
              <article key={program.title} className={cardClass}>
                <h3 className="break-words font-display text-base font-bold text-ink">
                  {program.title}
                </h3>
                <p className="mt-1 break-words text-xs font-bold uppercase tracking-wide text-muted">
                  {program.audience}
                </p>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  {program.description}
                </p>
                <dl className="mt-3 grid gap-1 text-xs text-muted">
                  <div className="break-words">
                    <dt className="inline font-bold text-ink">Duration: </dt>
                    <dd className="inline">{program.duration}</dd>
                  </div>
                  <div className="break-words">
                    <dt className="inline font-bold text-ink">Outcome: </dt>
                    <dd className="inline">{program.outcome}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-line bg-mist">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="max-w-xl text-sm leading-6 text-muted">
            Want a track for your school, club or team? Tell us the age band and the outcome you
            need, and we will scope the kits, sessions and teacher notes.
          </p>
          <Link
            href="/contact"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark"
          >
            Plan an academy track <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
