'use client'

// =====================================================================
// CategoryControlPanel - the generic control panel for a selected project
// category on the /tools page.
//
// Robo Car reuses the full RoboCarControl deck. The other categories
// (home-automation, smart-farm, smart-city, drones) render this generic
// transport-driven panel:
//   - connect over Web Bluetooth / WiFi (or delegate to the native app)
//   - relay/switch toggles, sliders, and a live sensor readout
// All commands speak the same GENUM line protocol used by the robot cars,
// so the same transport engine drives every category.
// =====================================================================

import { useEffect, useRef, useState } from 'react'
import { Bluetooth, Loader2, Wifi, X } from 'lucide-react'
import type { ProjectCategory } from '../lib/project-catalog'
import {
  createCarTransport,
  NativeTransport,
  type CarTelemetry,
  type CarTransport,
  type TransportOptions,
} from '../lib/robo-car-transport'
import RoboCarControl from './RoboCarControl'

type Props = {
  category: ProjectCategory
}

export default function CategoryControlPanel({ category }: Props) {
  if (category.slug === 'robocar') {
    return <RoboCarControl />
  }
  return <GenericPanel category={category} />
}

function GenericPanel({ category }: { category: ProjectCategory }) {
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<CarTelemetry>({})
  const [toggles, setToggles] = useState<Record<number, boolean>>({})

  const transportRef = useRef<CarTransport | null>(null)

  const options: TransportOptions = {
    onTelemetry: (t) => setTelemetry((prev) => ({ ...prev, ...t })),
    onStatus: (kind, message) => {
      if (kind === 'connected') setConnected(true)
      if (kind === 'disconnected') setConnected(false)
      if (kind === 'error') setError(message ?? 'Connection failed')
    },
  }

  useEffect(() => {
    return () => {
      transportRef.current?.disconnect().catch(() => {})
      transportRef.current = null
    }
  }, [])

  const connectVia = async (transport: 'ble' | 'ws') => {
    setBusy(true)
    setError(null)
    try {
      const inApp = NativeTransport.available()
      const t = inApp
        ? createCarTransport('native', { ...options, transport: transport === 'ble' ? 'ble' : 'ws' })
        : createCarTransport(transport === 'ble' ? 'ble' : 'websocket', options)
      await t.connect()
      transportRef.current = t
      setConnected(true)
      setStatus(inApp ? 'Connected via app' : transport === 'ble' ? 'Connected over Bluetooth' : 'WiFi connected')
      await t.requestState().catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    await transportRef.current?.disconnect().catch(() => {})
    transportRef.current = null
    setConnected(false)
    setStatus(null)
  }

  const send = async (line: string) => {
    try {
      await transportRef.current?.sendLine(line)
    } catch {
      setError('Not connected - the device is not answering.')
    }
  }

  const relayCount = category.capabilities.includes('relay') ? 4 : 0
  const toggle = (i: number) => {
    const next = !toggles[i]
    setToggles((prev) => ({ ...prev, [i]: next }))
    // Relay i ON/OFF via the GENUM command protocol (digital output).
    void send(`OUT${i}:${next ? 1 : 0}`)
  }

  const sliderCap = category.capabilities.includes('slider')

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-accent' : 'bg-border'}`} />
          <p className="text-sm font-bold text-ink">
            {connected ? `Connected · ${category.name}` : 'Not connected'}
          </p>
        </div>
        {connected && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="text-sm font-bold text-gold underline decoration-gold decoration-2 underline-offset-4 transition hover:text-gold-dark"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Connect cards */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Bluetooth size={16} className="text-navy" /> Bluetooth
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {NativeTransport.available()
              ? 'Connect through the GENUM app.'
              : 'Connect over BLE. Works in Chrome on desktop or Android.'}
          </p>
          <button
            type="button"
            onClick={() => connectVia('ble')}
            disabled={busy || connected}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-navy px-5 text-xs font-black text-white transition hover:bg-navy-dark disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />}
            {connected ? 'Connected' : 'Connect'}
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Wifi size={16} className="text-navy" /> WiFi (WebSocket)
          </p>
          <button
            type="button"
            onClick={() => connectVia('ws')}
            disabled={busy || connected}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-navy px-5 text-xs font-black text-white transition hover:bg-navy-dark disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            {connected ? 'Connected' : 'Connect'}
          </button>
        </div>
      </div>

      {status && <p className="mt-3 text-xs font-medium text-emerald-700">{status}</p>}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <X size={15} className="mt-0.5 shrink-0 text-red-600" />
          <p className="flex-1 text-xs leading-5 text-red-600">{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="shrink-0 text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      <div className={`mt-6 grid gap-4 md:grid-cols-2 ${connected ? '' : 'opacity-50'}`}>
        {/* Relay / switch outputs */}
        {relayCount > 0 && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-border">
              {category.slug === 'smart-farm' ? 'Pumps / solenoids' : 'Outputs'}
            </p>
            <div className="mt-3 space-y-3">
              {Array.from({ length: relayCount }).map((_, i) => {
                const on = !!toggles[i]
                return (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">
                      {category.slug === 'smart-farm' ? `Relay ${i + 1}` : `Switch ${i + 1}`}
                    </p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={!connected}
                      onClick={() => toggle(i)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                        on ? 'bg-navy text-white' : 'bg-mist text-muted'
                      }`}
                    >
                      {on ? 'On' : 'Off'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Live sensor readout */}
        {category.capabilities.includes('sensor') && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-border">Live telemetry</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Speed</dt>
                <dd className="font-mono font-bold text-navy">{telemetry.speed ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Current mode</dt>
                <dd className="font-mono font-bold text-navy">{telemetry.mode ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Status</dt>
                <dd className="font-mono font-bold text-navy">{telemetry.status ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Angle</dt>
                <dd className="font-mono font-bold text-navy">
                  {telemetry.angle != null ? `${telemetry.angle.toFixed(1)}°` : '—'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-muted">
              Sensor readings from the connected device.
            </p>
          </div>
        )}

        {/* Slider (e.g. speed / threshold) */}
        {sliderCap && (
          <div className="md:col-span-2 rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-border">Set level</p>
            <input
              type="range"
              min={0}
              max={255}
              step={5}
              defaultValue={128}
              disabled={!connected}
              onChange={(e) => void send(`SPD${Math.round(Number(e.target.value))}`)}
              className="mt-3 w-full accent-navy"
            />
            <p className="mt-2 text-xs text-muted">
              Adjust the output level. Connect to enable.
            </p>
          </div>
        )}
      </div>

      {!connected && (
        <p className="mt-5 text-xs text-muted">
          Connect a device to unlock the {category.name.toLowerCase()} controls.
        </p>
      )}
    </section>
  )
}
