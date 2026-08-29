'use client'

import { useState } from 'react'

type Device = { id: string; name: string; type: string; address: string }

// Placeholder devices - will be replaced by real BLE discovery once the
// mobile app's BluetoothService integrates with the same backend.
const DEVICES: Device[] = [
  { id: 'car', name: 'GENUM Robot Car', type: 'BLE · ESP32', address: 'A4:CF:12:88:1B:07' },
  { id: 'board', name: 'ESP32 Dev Board', type: 'BLE · WiFi', address: 'CC:50:E3:44:9A:2D' },
  { id: 'light', name: 'RGB LED Strip', type: 'BLE Mesh', address: 'F0:08:D1:5C:3E:11' },
]

const SPEEDS = ['Slow', 'Medium', 'Fast'] as const

export default function DeviceControl() {
  const [scanning, setScanning] = useState(false)
  const [connectedId, setConnectedId] = useState<string | null>(null)
  const [ledOn, setLedOn] = useState(true)
  const [headlightsOn, setHeadlightsOn] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>('Medium')

  const connected = connectedId !== null
  const connectedDevice = DEVICES.find((device) => device.id === connectedId) ?? null

  const handleScan = () => {
    if (scanning) return
    setScanning(true)
    // Simulated scan - will call the shared BLE service later.
    window.setTimeout(() => setScanning(false), 2500)
  }

  const handleConnect = (device: Device) => {
    setConnectedId(device.id)
  }

  const handleDisconnect = () => {
    setConnectedId(null)
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <div className="max-w-2xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-navy">Tools · IoT</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink lg:text-4xl">
          Control your devices
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted lg:text-base">
          A lightweight panel for Bluetooth and IoT hardware — the same interface ships in the
          GENUM mobile app. Connect a device to unlock quick controls.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-card lg:p-8">
        {/* Connection status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? 'bg-accent' : 'bg-border'
              }`}
            />
            <p className="text-sm font-bold text-ink">
              {connected ? `Connected · ${connectedDevice?.name}` : 'Not connected'}
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

        {/* Devices */}
        <h3 className="mt-8 font-display text-lg font-bold text-ink">Devices</h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {DEVICES.map((device) => {
            const isConnected = connectedId === device.id
            return (
              <li key={device.id}>
                <button
                  type="button"
                  onClick={() => handleConnect(device)}
                  disabled={scanning}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    isConnected
                      ? 'border-accent bg-white'
                      : 'border-line bg-white hover:border-navy'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold text-ink">
                      {device.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {device.type} · {device.address}
                    </span>
                  </span>
                  {scanning ? (
                    <span className="animate-pulse text-xs font-bold text-navy">Scanning…</span>
                  ) : (
                    <span
                      className={`shrink-0 text-xs font-bold ${
                        isConnected ? 'text-accent' : 'text-border'
                      }`}
                    >
                      {isConnected ? '● CONNECTED' : '○ TAP TO CONNECT'}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="mt-4 rounded-full bg-navy px-6 py-3 text-sm font-bold text-white transition hover:bg-navy-dark disabled:opacity-60"
        >
          {scanning ? 'Scanning…' : 'Scan for devices'}
        </button>
        <p className="mt-2 text-xs text-muted">
          Discovery is a placeholder — real BLE scanning arrives with the shared device service.
        </p>

        {/* Quick controls */}
        <h3 className="mt-10 font-display text-lg font-bold text-ink">Quick controls</h3>
        <div className={`mt-3 rounded-xl border border-line bg-white ${connected ? '' : 'opacity-50'}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold text-ink">Built-in LED</p>
            <button
              type="button"
              role="switch"
              aria-checked={ledOn}
              disabled={!connected}
              onClick={() => setLedOn((value) => !value)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                ledOn ? 'bg-navy text-white' : 'bg-mist text-muted'
              }`}
            >
              {ledOn ? 'On' : 'Off'}
            </button>
          </div>
          <div className="border-t border-line" />
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold text-ink">Headlights</p>
            <button
              type="button"
              role="switch"
              aria-checked={headlightsOn}
              disabled={!connected}
              onClick={() => setHeadlightsOn((value) => !value)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                headlightsOn ? 'bg-navy text-white' : 'bg-mist text-muted'
              }`}
            >
              {headlightsOn ? 'On' : 'Off'}
            </button>
          </div>
          <div className="border-t border-line" />
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-ink">Motor speed</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPEEDS.map((value) => {
                const active = speed === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSpeed(value)}
                    disabled={!connected}
                    className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'border-navy bg-navy text-white'
                        : 'border-line bg-mist text-navy hover:border-navy'
                    }`}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          {connected
            ? 'Controls are demo-only until the device service is wired up.'
            : 'Connect a device to unlock the quick controls.'}
        </p>

        {/* Future note */}
        <div className="mt-8 rounded-xl bg-sky px-4 py-3">
          <p className="text-sm font-bold text-navy">Coming soon</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Live Bluetooth commands, telemetry, and the same controls mirrored from the GENUM mobile
            app.
          </p>
        </div>
      </div>
    </section>
  )
}