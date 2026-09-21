// =====================================================================
// RoboticsFleet - the /tools fleet catalogue (unification W-5).
//
// Visually mirrors the app's Remote screen fleet experience: the 9 modes
// of the ESP32 remote firmware, their car specs, transport chips, control
// kinds, and the same ordering the physical mode button cycles. Purely
// descriptive - live control stays parked (D-1, lib/remote-control.ts);
// driving happens in the GENUM app (native) or each car's hosted page.
// Server component - no client JS shipped.
// =====================================================================

import { ROBOCAR_MODES } from '../lib/robo-car-catalog'
import type { ControlKind } from '../lib/robo-car-catalog'
import PageIntro from './PageIntro'

const CONTROL_LABELS: Record<ControlKind, string> = {
  'drive-tank': 'Tank drive (F/B/L/R + speed)',
  'drive-2wd1m': 'Speed + servo steering (TRIM supported)',
  'pid-auto': 'PID tuning + live balance telemetry',
  'start-stop': 'Run/stop + read-only telemetry',
  tuning: 'Threshold tuning',
  weblink: 'Points at the car-hosted page',
}

const TRANSPORT_LABELS: Record<string, string> = {
  ble: 'BLE',
  wifi: 'WiFi',
  'classic-bt': 'Classic BT (SPP)',
  rf: 'RF link',
}

export default function RoboticsFleet() {
  const modes = [...ROBOCAR_MODES].sort(
    (a, b) => a.deviceIndex - b.deviceIndex,
  )

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <PageIntro
        eyebrow="GENUM robot fleet · 9 modes"
        title="The fleet, mode by mode."
        body="Every mode the ESP32 remote and the GENUM app can drive, exactly as the car cycles them with its mode button. Pick a mode in the app and this is what it unlocks."
      />
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modes.map((mode) => (
          <li
            key={mode.id}
            className="flex flex-col rounded-2xl border border-line bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold leading-snug text-ink">
                {mode.name}
              </h3>
              <span
                className="shrink-0 rounded-full bg-sky px-3 py-1 text-[10px] font-bold text-navy"
                title="Position in the car's mode-button cycle"
              >
                MODE&nbsp;{mode.deviceIndex + 1}/9 · {mode.token}
              </span>
            </div>
            <p className="mt-3 flex-1 text-xs leading-5 text-slate-600">
              {mode.blurb}
            </p>
            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs leading-5">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-bold uppercase tracking-wide text-slate-500">
                  Car
                </dt>
                <dd className="text-slate-600">{mode.car}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-bold uppercase tracking-wide text-slate-500">
                  Drive
                </dt>
                <dd className="text-slate-600">{mode.wheel}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-bold uppercase tracking-wide text-slate-500">
                  Steering
                </dt>
                <dd className="text-slate-600">{mode.steering}</dd>
              </div>
              {mode.sensors.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-bold uppercase tracking-wide text-slate-500">
                    Sensors
                  </dt>
                  <dd className="text-slate-600">{mode.sensors.join(', ')}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-bold uppercase tracking-wide text-slate-500">
                  Controls
                </dt>
                <dd className="text-slate-600">
                  {mode.controls
                    .map((c) => CONTROL_LABELS[c] ?? c)
                    .join(' · ')}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {mode.transport.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line px-2.5 py-0.5 text-[10px] font-bold text-slate-600"
                >
                  {TRANSPORT_LABELS[t] ?? t}
                </span>
              ))}
              {mode.requiresConnection && (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
                  connect to drive
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs leading-5 text-muted">
        Live driving stays in the GENUM app (native Bluetooth/WiFi links) or each
        car&apos;s own hosted page — website remote control is paused by design
        (decision D-1).
      </p>
    </section>
  )
}
