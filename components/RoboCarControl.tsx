'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bluetooth,
  ChevronRight,
  Loader2,
  Radio,
  Wifi,
  X,
} from 'lucide-react'
import { ROBOCAR_MODES, type CarType, type RoboCarMode } from '../lib/robo-car-catalog'
import {
  createCarTransport,
  type CarTransport,
  type CarTelemetry,
  type TransportOptions,
} from '../lib/robo-car-transport'

// A car is "connectable over BLE/WiFi" on this page. Cars using Classic BT
// SPP or RF (like the ESP remote uses) cannot be driven from a browser, so we
// surface them with an explanatory note rather than pretend we can connect.
function canControlHere(mode: RoboCarMode) {
  return mode.transport.includes('ble') || mode.transport.includes('wifi')
}

export default function RoboCarControl() {
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wifiUrl, setWifiUrl] = useState('ws://192.168.4.1:81')
  const [active, setActive] = useState<CarType>('4wd4m')
  const [telemetry, setTelemetry] = useState<CarTelemetry>({})

  // Touch-control state.
  const [speed, setSpeed] = useState(170)
  const [servo, setServo] = useState(90)
  const [holdDir, setHoldDir] = useState<'F' | 'B' | 'L' | 'R' | 'S' | null>(null)
  const [pid, setPid] = useState({ kp: 12.0, ki: 3.0, kd: 1.0, out: 0, off: 0 })

  const transportRef = useRef<CarTransport | null>(null)
  const mode: RoboCarMode = ROBOCAR_MODES.find((m) => m.id === active) ?? ROBOCAR_MODES[0]!

  const options: TransportOptions = {
    onTelemetry: (t) => setTelemetry((prev) => ({ ...prev, ...t })),
    onStatus: (kind, message) => {
      if (kind === 'connected') setConnected(true)
      if (kind === 'disconnected') setConnected(false)
      if (kind === 'error') setError(message ?? 'Connection failed')
    },
  }

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      transportRef.current?.disconnect().catch(() => {})
      transportRef.current = null
    }
  }, [])

  const handleConnectWifi = async () => {
    setBusy(true)
    setError(null)
    try {
      const t = createCarTransport('websocket', { ...options, url: wifiUrl })
      await t.connect()
      transportRef.current = t
      setConnected(true)
      setStatus('WiFi car connected')
      await t.requestState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect over WiFi.')
    } finally {
      setBusy(false)
    }
  }

  const handleConnectBt = async () => {
    setBusy(true)
    setError(null)
    try {
      const t = createCarTransport('ble', options)
      await t.connect()
      transportRef.current = t
      setConnected(true)
      setStatus('Car connected over Bluetooth')
      await t.requestState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect over Bluetooth.')
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

  const send = useCallback(async (line: string) => {
    try {
      await transportRef.current?.sendLine(line)
    } catch {
      setError('Not connected - the car is not answering.')
    }
  }, [])

  const lock = !connected || !canControlHere(mode)

  const tapDir = (d: 'F' | 'B' | 'L' | 'R') => {
    setHoldDir(d)
    void send(d)
  }
  const releaseDir = () => {
    if (holdDir) void send('S')
    setHoldDir(null)
  }

  const applySpeed = (value: number) => {
    setSpeed(value)
    void send(`SPD${Math.round(value)}`)
  }
  const applyServo = (value: number) => {
    setServo(value)
    void send(`SERVO${Math.round(value)}`)
  }
  const applyPid = (key: 'kp' | 'ki' | 'kd' | 'out' | 'off', value: number) => {
    const next = { ...pid, [key]: value }
    setPid(next)
    void send(`CFG;Kp:${next.kp.toFixed(2)};Ki:${next.ki.toFixed(3)};Kd:${next.kd.toFixed(3)};OUT:${next.out.toFixed(0)};OFF:${next.off.toFixed(2)}`)
  }

  const selectMode = (m: RoboCarMode) => {
    setActive(m.id)
    if (connected) void send(m.token)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <div className="max-w-2xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-navy">Robo Car · Control</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink lg:text-4xl">Drive your robot car</h2>
        <p className="mt-3 text-sm leading-6 text-muted lg:text-base">
          Connect a car first, then pick its mode. Cars using Bluetooth Classic or
          RF are driven by the paired hand-held remote; this panel drives the
          BLE / WiFi cars from the browser.
        </p>
      </div>

      {/* Connect panel */}
      <section className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-card lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-accent' : 'bg-border'}`} />
            <p className="text-sm font-bold text-ink">
              {connected ? 'Connected to car' : 'Not connected'}
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

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Bluetooth size={16} className="text-navy" /> Bluetooth (BLE)
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Scan for a BLE-capable car. Works in Chrome on desktop or Android.
            </p>
            <button
              type="button"
              onClick={handleConnectBt}
              disabled={busy || connected}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-navy px-5 text-xs font-black text-white transition hover:bg-navy-dark disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />}
              {connected ? 'Connected' : 'Scan & connect'}
            </button>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Wifi size={16} className="text-navy" /> WiFi (WebSocket)
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={wifiUrl}
                onChange={(e) => setWifiUrl(e.target.value)}
                disabled={busy || connected}
                aria-label="Car WebSocket address"
                className="w-full min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
            <button
              type="button"
              onClick={handleConnectWifi}
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
      </section>

      {/* Car-type tabs */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Choose a car mode</h3>
          {!connected && (
            <span className="text-xs font-bold text-muted">Connect a device to unlock controls</span>
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ROBOCAR_MODES.map((m) => {
            const selected = m.id === active
            const unavailable = !canControlHere(m)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m)}
                aria-pressed={selected}
                className={`relative flex flex-col rounded-2xl border p-4 text-left transition ${
                  selected ? 'border-navy bg-white shadow-md' : 'border-line bg-white hover:border-navy'
                } ${unavailable ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{m.name}</span>
                  {selected && <ChevronRight size={16} className="text-navy" />}
                </div>
                <span className="mt-1 text-xs text-muted">{m.blurb}</span>
                {unavailable && (
                  <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold text-muted">
                    <Radio size={11} /> Uses hand-held remote
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Control panel */}
      <section className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-card lg:p-8">
        <div className={`transition ${lock ? 'pointer-events-none opacity-40' : ''}`}>
          {lock ? (
            <div className="mb-4 rounded-xl bg-sky px-4 py-3">
              <p className="text-sm font-bold text-navy">
                {connected ? 'This mode is driven by its hand-held remote.' : 'Connect a device to unlock controls.'}
              </p>
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                {mode.name} <span className="font-mono text-xs text-muted">· {mode.token}</span>
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted">
                {mode.sensors.map((s) => (
                  <span key={s} className="rounded-full bg-mist px-2 py-0.5 font-semibold">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Drive controls (tank / 2WD1M) */}
          {(mode.controls.includes('drive-tank') || mode.controls.includes('drive-2wd1m')) && (
            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-border">D-pad</p>
                <div className="mx-auto grid w-44 grid-cols-3 gap-2">
                  <span />
                  <DirBtn label="▲" onPress={() => tapDir('F')} onRelease={releaseDir} />
                  <span />
                  <DirBtn label="◀" onPress={() => tapDir('L')} onRelease={releaseDir} />
                  <DirBtn label="■ Stop" onPress={() => { void send('S'); setHoldDir(null) }} onRelease={() => { setHoldDir(null) }} />
                  <DirBtn label="▶" onPress={() => tapDir('R')} onRelease={releaseDir} />
                  <span />
                  <DirBtn label="▼" onPress={() => tapDir('B')} onRelease={releaseDir} />
                  <span />
                </div>
              </div>
              <div className="md:w-72">
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-border">Speed</p>
                    <span className="font-mono text-sm font-bold text-navy">{speed}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    step={5}
                    value={speed}
                    onChange={(e) => applySpeed(Number(e.target.value))}
                    className="mt-2 w-full accent-navy"
                  />
                </div>
                {mode.controls.includes('drive-2wd1m') && (
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-border">Steering (servo)</p>
                      <span className="font-mono text-sm font-bold text-navy">{servo}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={180}
                      step={5}
                      value={servo}
                      onChange={(e) => applyServo(Number(e.target.value))}
                      className="mt-2 w-full accent-navy"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PID / self-balancing */}
          {mode.controls.includes('pid-auto') && (
            <div className="grid gap-4 md:grid-cols-2">
              <PidSlider label="Kp" value={pid.kp} min={0} max={50} step={0.1} onChange={(v) => applyPid('kp', v)} />
              <PidSlider label="Ki" value={pid.ki} min={0} max={20} step={0.1} onChange={(v) => applyPid('ki', v)} />
              <PidSlider label="Kd" value={pid.kd} min={0} max={20} step={0.1} onChange={(v) => applyPid('kd', v)} />
              <PidSlider label="OUT" value={pid.out} min={0} max={255} step={1} onChange={(v) => applyPid('out', v)} />
              <PidSlider label="OFF" value={pid.off} min={-90} max={90} step={0.5} onChange={(v) => applyPid('off', v)} />
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-border">Live angle</p>
                <p className="mt-1 font-display text-3xl font-bold text-navy">
                  {telemetry.angle != null ? `${telemetry.angle.toFixed(1)}°` : '—'}
                </p>
                <p className="mt-1 text-xs text-muted">Telemetry from the car (TEL;ANGLE)</p>
              </div>
            </div>
          )}

          {/* Start/stop autonomous modes */}
          {(mode.controls.includes('start-stop') || mode.controls.includes('tuning')) && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => { void send('F'); setStatus(`${mode.name} running`) }}
                className="rounded-full bg-navy px-6 py-3 text-sm font-black text-white transition hover:bg-navy-dark"
              >
                Run
              </button>
              <button
                type="button"
                onClick={() => { void send('S'); setStatus(`${mode.name} stopped`) }}
                className="rounded-full border border-line bg-white px-6 py-3 text-sm font-black text-ink transition hover:border-navy hover:text-navy"
              >
                Stop
              </button>
              <p className="text-xs text-muted">
                {mode.controls.includes('tuning')
                  ? 'Threshold tuning arrives with sensor configuration.'
                  : 'The car runs its sensor routine until you press Stop.'}
              </p>
            </div>
          )}

          {/* Website client/server */}
          {mode.controls.includes('weblink') && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-ink">
                {mode.id === 'website-server' ? 'Open the car’s web page' : 'Car acts as a client'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {mode.id === 'website-server'
                  ? 'This car hosts its own control page. Open its IP in this browser to drive it.'
                  : 'This car connects to a browser/server. Put the car you want to reach here or in the app.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DirBtn({
  label,
  onPress,
  onRelease,
}: {
  label: string
  onPress: () => void
  onRelease: () => void
}) {
  return (
    <button
      type="button"
      onPointerDown={onPress}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      className="flex h-12 items-center justify-center rounded-xl border border-line bg-mist text-sm font-black text-ink transition active:bg-navy active:text-white"
    >
      {label}
    </button>
  )
}

function PidSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-border">{label}</p>
        <span className="font-mono text-sm font-bold text-navy">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-navy"
      />
    </div>
  )
}
