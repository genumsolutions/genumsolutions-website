'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bluetooth,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Wifi,
  X,
} from 'lucide-react'
import {
  nextDeviceMode,
  resolveCarType,
  ROBOCAR_MODES,
  type CarType,
  type RoboCarMode,
} from '../lib/robo-car-catalog'
import {
  createCarTransport,
  NativeTransport,
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

// Map a normalized left-joystick position to a direction letter, mirroring the
// physical remote's 4-way stick -> F/B/L/R mapping.
function joyToDirection(x: number, y: number): 'F' | 'B' | 'L' | 'R' | 'S' {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ax < 0.25 && ay < 0.25) return 'S'
  if (ay >= ax) return y < 0 ? 'F' : 'B'
  return x < 0 ? 'L' : 'R'
}

export default function RoboCarControl() {
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wifiUrl, setWifiUrl] = useState('ws://192.168.4.1:81')
  const [active, setActive] = useState<CarType>('4wd4m')
  const [telemetry, setTelemetry] = useState<CarTelemetry>({})

  // Remote-style state.
  const [speed, setSpeed] = useState(170)
  const [servo, setServo] = useState(90)
  const [pid, setPid] = useState({ kp: 12.0, ki: 3.0, kd: 1.0, out: 0, off: 0 })
  const [driveStatus, setDriveStatus] = useState('Stop')

  const transportRef = useRef<CarTransport | null>(null)
  const holdDirRef = useRef<'F' | 'B' | 'L' | 'R' | 'S' | null>(null)
  const lastAckedModeRef = useRef<string | null>(null)
  const mode: RoboCarMode = ROBOCAR_MODES.find((m) => m.id === active) ?? ROBOCAR_MODES[0]!

  const options: TransportOptions = {
    onTelemetry: (t) => {
      setTelemetry((prev) => ({ ...prev, ...t }))
      // The car is the source of truth for the current mode (reported via
      // STATE;MODE=...). Mirror it into the UI so the app stays in sync with
      // the device's physical mode button.
      if (t.mode) {
        const reportedMode = t.mode
        const isSelfAck = lastAckedModeRef.current !== null && lastAckedModeRef.current === reportedMode
        if (isSelfAck) lastAckedModeRef.current = null
        setActive((prevActive) => {
          const current = resolveCarType(prevActive)
          const incoming = resolveCarType(reportedMode)
          if (
            !isSelfAck &&
            incoming &&
            (!current || incoming.deviceIndex !== current.deviceIndex)
          ) {
            return incoming.id
          }
          return prevActive
        })
      }
      if (t.status) setDriveStatus(t.status)
    },
    onStatus: (kind, message) => {
      if (kind === 'connected') {
        setConnected(true)
        transportRef.current?.requestState().catch(() => {})
      }
      if (kind === 'disconnected') setConnected(false)
      if (kind === 'error') setError(message ?? 'Connection failed')
    },
  }

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      holdDirRef.current = null
      transportRef.current?.disconnect().catch(() => {})
      transportRef.current = null
    }
  }, [])

  // Safety: if control is lost (disconnect, or switching to a mode that can't
  // be driven from here) while a direction is held, always send a hard stop.
  const lock = !connected || !canControlHere(mode)
  useEffect(() => {
    if (lock && holdDirRef.current) {
      holdDirRef.current = null
      setDriveStatus('Stop')
      transportRef.current?.sendLine('S').catch(() => {})
    }
  }, [lock])

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
      // Inside the GENUM app, delegate to the native shell (BLE via
      // react-native-ble-plx / WiFi via its own socket) instead of Web
      // Bluetooth, which does not work in an embedded Android WebView.
      const inApp = NativeTransport.available()
      const t = inApp
        ? createCarTransport('native', { ...options, url: wifiUrl, transport: 'ble' })
        : createCarTransport('ble', options)
      await t.connect()
      transportRef.current = t
      setConnected(true)
      setStatus(NativeTransport.available() ? 'Car connected via app' : 'Car connected over Bluetooth')
      await t.requestState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect over Bluetooth.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    holdDirRef.current = null
    setDriveStatus('Stop')
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

  const applyDir = (d: 'F' | 'B' | 'L' | 'R' | 'S') => {
    if (d === 'S') {
      if (holdDirRef.current) {
        holdDirRef.current = null
        setDriveStatus('Stop')
        void send('S')
      }
      return
    }
    holdDirRef.current = d
    setDriveStatus(d === 'F' ? 'Forward' : d === 'B' ? 'Backward' : d === 'L' ? 'Left' : 'Right')
    void send(d)
  }

  const selectMode = (m: RoboCarMode) => {
    setActive(m.id)
    holdDirRef.current = null
    setDriveStatus('Stop')
    if (connected) {
      lastAckedModeRef.current = m.token
      void send(m.token)
      void send('S')
      setStatus(`Switched to ${m.name} (${m.token})`)
      transportRef.current?.requestState().catch(() => {})
    }
  }

  // Behaves like the device's physical mode button: step to the next mode
  // in the firmware's MODE_CMDS[] cycle order.
  const cycleMode = () => selectMode(nextDeviceMode(mode))
  const nextMode = nextDeviceMode(mode)

  // Left joystick drives direction (4-WD / 2WD1M motor). Right joystick X
  // steers the servo in 2WD1M.
  const is2wd1m = mode.controls.includes('drive-2wd1m')
  const handleLeftJoy = (x: number, y: number) => {
    if (!connected || lock) return
    // In 2WD1M the left stick only drives the motor forward/backward.
    const d = is2wd1m
      ? (y < -0.25 ? 'F' : y > 0.25 ? 'B' : 'S')
      : joyToDirection(x, y)
    applyDir(d)
  }
  const handleRightJoy = (x: number) => {
    if (!connected || lock || !is2wd1m) return
    const angle = Math.round(90 - x * 90)
    applyServo(Math.max(0, Math.min(180, angle)))
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <div className="max-w-2xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-navy">Robo Car · Control</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink lg:text-4xl">Drive like the handheld remote</h2>
        <p className="mt-3 text-sm leading-6 text-muted lg:text-base">
          Choose a mode, connect a BLE or WiFi car, then drive with the two virtual
          joysticks and the Select / Back buttons — just like the physical remote
          and its OLED display.
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
              <Bluetooth size={16} className="text-navy" /> {NativeTransport.available() ? 'Car (via app)' : 'Bluetooth (BLE)'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {NativeTransport.available()
                ? 'Connect through the GENUM app for a wider range of cars, including those that pair like the hand-held remote.'
                : 'Scan for a BLE-capable car. Works in Chrome on desktop or Android.'}
            </p>
            <button
              type="button"
              onClick={handleConnectBt}
              disabled={busy || connected}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-navy px-5 text-xs font-black text-white transition hover:bg-navy-dark disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />}
              {connected ? 'Connected' : NativeTransport.available() ? 'Connect car' : 'Scan & connect'}
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

      {/* Remote-style control deck */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card lg:p-6">
          {/* Mode chooser: dropdown + toggle button */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="mode-select" className="text-xs font-bold uppercase tracking-wide text-muted">
                Mode
              </label>
              <div className="relative mt-1.5">
                <select
                  id="mode-select"
                  value={active}
                  onChange={(e) => {
                    const m = ROBOCAR_MODES.find((mm) => mm.id === e.target.value)
                    if (m) selectMode(m)
                  }}
                  className="w-full min-w-0 appearance-none rounded-xl border border-line bg-white py-2.5 pl-3 pr-9 text-sm font-bold text-ink focus:border-navy focus:outline-none"
                >
                  {ROBOCAR_MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleMode}
                disabled={!connected}
                aria-label={`Next mode: ${nextMode.name}`}
                title={`Next mode: ${nextMode.name}`}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-navy px-4 text-xs font-black text-white transition hover:bg-navy-dark disabled:opacity-60"
              >
                <RefreshCw size={14} aria-hidden="true" />
                Mode
              </button>
              {!connected && <span className="text-xs font-bold text-muted">Connect to switch</span>}
            </div>
          </div>

          <div className={`mt-6 transition ${lock ? 'pointer-events-none opacity-40' : ''}`}>
            {lock ? (
              <div className="mb-4 rounded-xl bg-sky px-4 py-3">
                <p className="text-sm font-bold text-navy">
                  {connected ? 'This mode is driven by its hand-held remote.' : 'Connect a device to unlock controls.'}
                </p>
              </div>
            ) : null}
          </div>

          {/* OLED display */}
          <OledDisplay
            mode={mode.name}
            token={mode.token}
            speed={speed}
            servo={is2wd1m ? servo : undefined}
            status={driveStatus}
            connected={connected}
            angle={telemetry.angle}
            telemetryMode={telemetry.mode}
          />

          <div className={`mt-6 transition ${lock ? 'pointer-events-none opacity-40' : ''}`}>
            {/* Joysticks */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-border">
                  Drive {is2wd1m ? '(Motor)' : '(Left)'}
                </p>
                <Joystick onMove={handleLeftJoy} disabled={lock} label="Drive joystick" />
              </div>
              <div className="flex flex-col items-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-border">
                  Steer {is2wd1m ? '(Servo)' : '(Unused)'}
                </p>
                <Joystick
                  onMove={(x) => handleRightJoy(x)}
                  disabled={lock || !is2wd1m}
                  label="Steering joystick"
                />
              </div>
            </div>

            {/* Select / Back buttons */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <RemoteButton
                onClick={() => (connected ? handleDisconnect() : undefined)}
                disabled={!connected}
                icon={<ArrowLeft size={16} aria-hidden="true" />}
                label="Back"
              />
              <RemoteButton
                onClick={() => (connected ? cycleMode() : undefined)}
                disabled={!connected}
                icon={<Check size={16} aria-hidden="true" />}
                label="Select"
              />
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">
              Back = disconnect · Select = next mode
            </p>
          </div>

          <div className={`mt-6 border-t border-line pt-6 transition ${lock ? 'pointer-events-none opacity-40' : ''}`}>
            {/* Speed + steering sliders */}
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
            {is2wd1m && (
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

            {/* PID / self-balancing */}
            {mode.controls.includes('pid-auto') && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                  <p className="mt-1 text-xs text-muted">Telemetry (TEL;ANGLE)</p>
                </div>
              </div>
            )}

            {/* Start/stop autonomous modes */}
            {(mode.controls.includes('start-stop') || mode.controls.includes('tuning')) && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => { void send('F'); setDriveStatus(`${mode.name} running`) }}
                  className="rounded-full bg-navy px-6 py-3 text-sm font-black text-white transition hover:bg-navy-dark"
                >
                  Run
                </button>
                <button
                  type="button"
                  onClick={() => { void send('S'); setDriveStatus(`${mode.name} stopped`) }}
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
              <div className="mt-6 rounded-xl border border-line bg-surface p-4">
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
        </div>

        {/* Legend / mode info side panel */}
        <aside className="rounded-2xl border border-line bg-white p-5 shadow-card lg:self-start lg:p-6">
          <h3 className="text-xs font-black uppercase tracking-[.2em] text-navy">About this mode</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-border">Name</p>
              <p className="font-semibold text-ink">{mode.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-border">Token</p>
              <p className="font-mono text-ink">{mode.token}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-border">Car</p>
              <p className="text-ink">{mode.car}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-border">Wheel</p>
              <p className="text-muted">{mode.wheel}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-border">Steering</p>
              <p className="text-muted">{mode.steering}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-border">Sensors</p>
              <p className="text-muted">{mode.sensors.length ? mode.sensors.join(', ') : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-border">Transport</p>
              <p className="text-muted">{mode.transport.join(', ')}</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">{mode.blurb}</p>
        </aside>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------
// Remote-style building blocks
// ---------------------------------------------------------------------

function OledDisplay({
  mode,
  token,
  speed,
  servo,
  status,
  connected,
  angle,
  telemetryMode,
}: {
  mode: string
  token: string
  speed: number
  servo?: number
  status: string
  connected: boolean
  angle?: number
  telemetryMode?: string
}) {
  const line1 = `${mode}  ${servo != null ? `STEER ${servo}` : `SPD ${speed}`}`.slice(0, 20)
  const line2 = (connected ? status : 'NO LINK').slice(0, 20)
  const line3 = angle != null
    ? `ANGLE ${angle.toFixed(1)}  ${telemetryMode ? `M:${telemetryMode}` : ''}`.slice(0, 20)
    : (telemetryMode ? `MODE ${telemetryMode}` : connected ? 'READY' : 'PRESS SELECT').slice(0, 20)
  return (
    <div className="mt-6 rounded-xl bg-slate-900 p-3 shadow-inner ring-1 ring-slate-700">
      <div className="flex items-center justify-between border-b border-slate-700 px-2 pb-2">
        <span className="font-mono text-[11px] font-bold text-emerald-400">{token}</span>
        <span className="font-mono text-[10px] text-slate-500">OLED · {connected ? 'LINK' : '---'}</span>
      </div>
      <div className="mt-2 space-y-1 px-2 font-mono text-sm text-emerald-300">
        <p className="truncate">{line1}</p>
        <p className="truncate">{line2}</p>
        <p className="truncate text-emerald-400">{line3}</p>
      </div>
    </div>
  )
}

function Joystick({
  onMove,
  disabled,
  label,
}: {
  onMove: (x: number, y: number) => void
  disabled: boolean
  label: string
}) {
  const baseRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const updateFromPoint = (clientX: number, clientY: number) => {
    const base = baseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    const radius = rect.width / 2
    let dx = clientX - (rect.left + radius)
    let dy = clientY - (rect.top + radius)
    const dist = Math.hypot(dx, dy)
    if (dist > radius) {
      dx = (dx / dist) * radius
      dy = (dy / dist) * radius
    }
    setKnob({ x: dx, y: dy })
    onMove(dx / radius, dy / radius)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || disabled) return
    updateFromPoint(e.clientX, e.clientY)
  }
  const release = () => {
    if (!dragging.current) return
    dragging.current = false
    setKnob({ x: 0, y: 0 })
    onMove(0, 0)
  }

  return (
    <div
      ref={baseRef}
      role="slider"
      aria-label={label}
      aria-disabled={disabled}
      aria-valuenow={Math.round(Math.hypot(knob.x, knob.y) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={() => { if (dragging.current) release() }}
      onKeyDown={(e) => {
        if (disabled) return
        const step = 0.5
        const moved = { ...knob }
        if (e.key === 'ArrowUp') moved.y = Math.max(-1, moved.y - step)
        else if (e.key === 'ArrowDown') moved.y = Math.min(1, moved.y + step)
        else if (e.key === 'ArrowLeft') moved.x = Math.max(-1, moved.x - step)
        else if (e.key === 'ArrowRight') moved.x = Math.min(1, moved.x + step)
        else if (e.key === ' ' || e.key === 'Enter') { setKnob({ x: 0, y: 0 }); onMove(0, 0); return }
        else return
        e.preventDefault()
        setKnob(moved)
        onMove(moved.x, moved.y)
      }}
      className="relative h-36 w-36 touch-none rounded-full border-2 border-line bg-mist shadow-inner transition disabled:opacity-50"
      style={{ pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border" aria-hidden="true" />
      <span
        className="absolute h-12 w-12 rounded-full border-2 border-navy bg-white shadow-md"
        style={{
          left: `calc(50% + ${knob.x * 72}px - 24px)`,
          top: `calc(50% + ${knob.y * 72}px - 24px)`,
        }}
        aria-hidden="true"
      />
    </div>
  )
}

function RemoteButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void
  disabled: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-navy text-white shadow-md transition hover:bg-navy-dark disabled:opacity-50"
      aria-label={label}
    >
      {icon}
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
