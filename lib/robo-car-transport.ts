// =====================================================================
// robo-car-transport.ts - multi-transport control for GENUM robot cars.
//
// One Transport interface sits in front of every physical link so the
// /robocar UI (and future Home Automation / Smart Farm / Smart City /
// Drones panels) speaks the same GENUM command protocol no matter how the
// ESP8266/ESP32 device is reached:
//
//   direction   F|B|L|R|S
//   speed       SPD<n>            (±255, 2WD1M signed)
//   servo       SERVO<n>          0..180, center 90
//   mode        BT | 2WD1M | AUTO | PATH | OBS_US | OBS_IR | MAN | ESP_CLI | ESP_SER
//   calibrate   CFG;Kp:..;Ki:..;Kd:..;OUT:..;OFF:..
//   request     REQ_STATE
//   telemetry   STATE;... | TEL;Kp:.. | SPD<n>
//
// Implementations:
//   WebSocketTransport - real, works today for WiFi cars (ESP_CLI/ESP_SER
//                        and any ESP that exposes a WS endpoint on its IP).
//   BluetoothTransport - Web Bluetooth (Chrome desktop / Android). Requires
//                        BLE-capable firmware (a UART/BLE service); if the
//                        device only exposes Classic SPP, this surfaces a
//                        clear, actionable error.
//
// The app's native build uses react-native-ble-plx behind the same
// interface (see ROBOCAR_TRANSPORT notes in the app ToolsScreen).
// =====================================================================

// Minimal Web Bluetooth typings (not in the default TS DOM lib).
interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  value: DataView | null
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  writeValue(value: BufferSource): Promise<void>
}
interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>
  disconnect(): void
}
interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>
}
interface BluetoothDevice {
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: string, listener: (event: Event) => unknown): void
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
}
type BluetoothServiceUUID = string
type BluetoothCharacteristicUUID = string

export interface CarTelemetry {
  mode?: string
  speed?: number
  trim?: number
  status?: string
  // AUTO live PID
  kp?: number
  ki?: number
  kd?: number
  out?: number
  off?: number
  angle?: number
}

export interface TransportOptions {
  onTelemetry?: (t: CarTelemetry) => void
  onStatus?: (status: 'connected' | 'disconnected' | 'error', message?: string) => void
}

export interface CarTransport {
  readonly kind: 'websocket' | 'ble' | 'native' | 'none'
  connect(): Promise<void>
  disconnect(): Promise<void>
  get connected(): boolean
  sendLine(line: string): Promise<void>
  setMode(token: string): Promise<void>
  setDirection(d: 'F' | 'B' | 'L' | 'R' | 'S'): Promise<void>
  setSpeed(value: number): Promise<void>
  setServo(value: number): Promise<void>
  calibratePid(p: { kp: number; ki: number; kd: number; out: number; off: number }): Promise<void>
  requestState(): Promise<void>
}

// ---------------------------------------------------------------------
// Protocol helpers shared by every transport.
// ---------------------------------------------------------------------
export const MODE_TOKEN = {
  BT: 'BT',
  TWO_WD_1M: '2WD1M',
  AUTO: 'AUTO',
  PATH: 'PATH',
  OBS_US: 'OBS_US',
  OBS_IR: 'OBS_IR',
  MAN: 'MAN',
  ESP_CLI: 'ESP_CLI',
  ESP_SER: 'ESP_SER',
} as const

export function parseTelemetryLine(line: string, into: CarTelemetry): void {
  const l = line.trim()
  if (!l) return
  const up = l.toUpperCase()

  // STATE;MODE=2WD1M;SPD=120;TRIM=0;STATUS=Forward
  if (up.startsWith('STATE')) {
    const body = l.split(/[;:]/)
    let i = 1
    while (i < body.length) {
      const key = body[i]?.toUpperCase()
      const val = body[i + 1]
      if (!key || val === undefined) { i += 1; continue }
      if (key === 'MODE') into.mode = val
      else if (key === 'SPD') into.speed = Number(val) || 0
      else if (key === 'TRIM') into.trim = Number(val) || 0
      else if (key === 'STATUS') into.status = val
      i += 2
    }
    return
  }

  // TEL;Kp:12.30;Ki:0.50;Kd:3.10;OUT:050;OFF:+0.75;ANGLE:+12.34
  if (up.startsWith('TEL')) {
    const body = l.replace(/^TEL[:;]/i, '')
    for (const part of body.split(';')) {
      const m = /^([A-Za-z]+):(.+)$/.exec(part.trim())
      if (!m) continue
      const key = m[1]!.toUpperCase()
      const num = Number(m[2]) || 0
      if (key === 'KP') into.kp = num
      else if (key === 'KI') into.ki = num
      else if (key === 'KD') into.kd = num
      else if (key === 'OUT') into.out = num
      else if (key === 'OFF') into.off = num
      else if (key === 'ANGLE') into.angle = num
    }
    return
  }

  // SPD<value> or SPD:<value>
  if (/^SPD[:]?-?[\d]+$/i.test(l)) {
    const num = Number(l.replace(/^SPD[:]?/i, '')) || 0
    if (num > 0) into.speed = num
  }
}

export function buildCalibration(p: { kp: number; ki: number; kd: number; out: number; off: number }): string {
  return `CFG;Kp:${p.kp.toFixed(2)};Ki:${p.ki.toFixed(3)};Kd:${p.kd.toFixed(3)};OUT:${p.out.toFixed(0)};OFF:${p.off.toFixed(2)}`
}

// ---------------------------------------------------------------------
// WebSocket transport - works today for WiFi cars.
// ---------------------------------------------------------------------
export class WebSocketTransport implements CarTransport {
  readonly kind = 'websocket' as const
  private ws: WebSocket | null = null
  private url: string
  private options: TransportOptions
  private lineBuffer = ''

  constructor(url: string, options: TransportOptions = {}) {
    this.url = url
    this.options = options
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url)
      this.ws = ws
      ws.onopen = () => {
        this.options.onStatus?.('connected', 'WiFi connected')
        resolve()
      }
      ws.onerror = () => {
        this.options.onStatus?.('error', 'Could not reach the car. Check its IP and that WiFi car firmware is running.')
        reject(new Error('WebSocket connection failed'))
      }
      ws.onclose = () => {
        this.options.onStatus?.('disconnected', 'Disconnected from car')
        this.ws = null
      }
      ws.onmessage = (event) => {
        const data = typeof event.data === 'string' ? event.data : ''
        this.lineBuffer += data
        const lines = this.lineBuffer.split('\n')
        this.lineBuffer = lines.pop() ?? ''
        const telemetry: CarTelemetry = {}
        for (const line of lines) {
          parseTelemetryLine(line, telemetry)
          if (Object.keys(telemetry).length) this.options.onTelemetry?.({ ...telemetry })
        }
      }
    })
  }

  async disconnect(): Promise<void> {
    this.ws?.close()
    this.ws = null
    this.options.onStatus?.('disconnected')
  }

  async sendLine(line: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected')
    this.ws?.send(line + '\n')
  }

  async setMode(token: string) { await this.sendLine(token) }
  async setDirection(d: 'F' | 'B' | 'L' | 'R' | 'S') { await this.sendLine(d) }
  async setSpeed(value: number) { await this.sendLine(`SPD${Math.round(value)}`) }
  async setServo(value: number) { await this.sendLine(`SERVO${Math.round(value)}`) }
  async calibratePid(p: { kp: number; ki: number; kd: number; out: number; off: number }) {
    await this.sendLine(buildCalibration(p))
  }
  async requestState() { await this.sendLine('REQ_STATE') }
}

// ---------------------------------------------------------------------
// Web Bluetooth transport - works in Chrome (desktop/Android) when the car
// exposes a BLE UART service. Classic-SPP-only cars cannot be reached from
// a browser, so connect() surfaces that clearly.
// ---------------------------------------------------------------------
const BLE_UART_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb' // common HM-10/Nordic UART
const BLE_UART_TX = '0000ffe1-0000-1000-8000-00805f9b34fb'

export class BluetoothTransport implements CarTransport {
  readonly kind = 'ble' as const
  private device: BluetoothDevice | null = null
  private char: BluetoothRemoteGATTCharacteristic | null = null
  private options: TransportOptions
  private lineBuffer = ''

  constructor(options: TransportOptions = {}) {
    this.options = options
  }

  get connected() {
    return this.device?.gatt?.connected === true
  }

  connect(): Promise<void> {
    const nav = navigator as Navigator & {
      bluetooth?: { requestDevice: (o: object) => Promise<BluetoothDevice> }
    }
    if (!nav.bluetooth) {
      this.options.onStatus?.(
        'error',
        'Bluetooth is not available here. Open this page in Chrome on a desktop or Android phone, or use the native app.',
      )
      return Promise.reject(new Error('Web Bluetooth not supported'))
    }

    return nav.bluetooth
      .requestDevice({ filters: [{ services: [BLE_UART_SERVICE] }], acceptAllDevices: false })
      .then(async (device) => {
        this.device = device
        device.addEventListener('gattserverdisconnected', () => {
          this.options.onStatus?.('disconnected', 'Bluetooth disconnected')
          this.char = null
        })
        const server = await device.gatt!.connect()
        const service = await server.getPrimaryService(BLE_UART_SERVICE)
        const tx = await service.getCharacteristic(BLE_UART_TX)
        this.char = tx
        await tx.startNotifications()
        tx.addEventListener('characteristicvaluechanged', (event) => {
          const target = event.target as BluetoothRemoteGATTCharacteristic
          const value = target.value
          const text = value ? new TextDecoder().decode(value) : ''
          this.lineBuffer += text
          const lines = this.lineBuffer.split('\n')
          this.lineBuffer = lines.pop() ?? ''
          const telemetry: CarTelemetry = {}
          for (const line of lines) {
            parseTelemetryLine(line, telemetry)
            if (Object.keys(telemetry).length) this.options.onTelemetry?.({ ...telemetry })
          }
        })
        this.options.onStatus?.('connected', device.name || 'Car connected')
      })
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      try { this.device.gatt.disconnect() } catch { /* ignore */ }
    }
    this.device = null
    this.char = null
    this.options.onStatus?.('disconnected')
  }

  async sendLine(line: string): Promise<void> {
    if (!this.char) throw new Error('Not connected')
    await this.char.writeValue(new TextEncoder().encode(line + '\n'))
  }

  async setMode(token: string) { await this.sendLine(token) }
  async setDirection(d: 'F' | 'B' | 'L' | 'R' | 'S') { await this.sendLine(d) }
  async setSpeed(value: number) { await this.sendLine(`SPD${Math.round(value)}`) }
  async setServo(value: number) { await this.sendLine(`SERVO${Math.round(value)}`) }
  async calibratePid(p: { kp: number; ki: number; kd: number; out: number; off: number }) {
    await this.sendLine(buildCalibration(p))
  }
  async requestState() { await this.sendLine('REQ_STATE') }
}

// ---------------------------------------------------------------------
// Native transport - used when the /robocar page runs inside the GENUM
// mobile app (window.ReactNativeWebView). The browser page cannot perform
// Classic-SPP pairing or reach some BLE cars, so it delegates the raw
// GENUM command protocol to the native shell, which owns the actual
// socket (BLE via react-native-ble-plx or WebSocket to a LAN WiFi car).
// Native is the opposite direction from the other transports: command
// lines flow OUT over postMessage (rhs -> lhs), and the shell pushes
// telemetry/status back IN by calling the global callback registered here.
// ---------------------------------------------------------------------

declare global {
  interface Window {
    readonly ReactNativeWebView?: {
      postMessage(message: string): void
    }
    readonly GENUM_APP?: boolean
    __GENUM_ROBO__?: {
      /** Registered by the page while it is mounted. The native shell
       *  invokes this to stream telemetry / status back into the page. */
      ingress: (kind: 'telemetry' | 'status' | 'connected' | 'disconnected' | 'error', payload: string) => void
    }
  }
}

export class NativeTransport implements CarTransport {
  readonly kind = 'native' as const
  private options: TransportOptions
  private bridge: Window['ReactNativeWebView'] | null = null
  private _connected = false

  static available(): boolean {
    return typeof window !== 'undefined' && !!window.ReactNativeWebView && !!(window as Window).GENUM_APP
  }

  private url?: string
  transport: 'ws' | 'ble' = 'ws'

  setUrl(url: string) {
    this.url = url
  }

  /** Which native link the shell should open: a WS to a LAN car, or a BLE
   *  scan + connect to the car's UART service. */
  setTransport(transport: 'ws' | 'ble') {
    this.transport = transport
  }

  constructor(options: TransportOptions = {}) {
    this.options = options
  }

  get connected() {
    return this._connected
  }

  private emit(kind: string, payload: unknown) {
    try {
      this.bridge?.postMessage(
        JSON.stringify({ type: 'genum:robo', action: kind, payload }),
      )
    } catch { /* ignore */ }
  }

  connect(): Promise<void> {
    if (!NativeTransport.available()) {
      this.options.onStatus?.('error', 'Native car control is only available in the GENUM app.')
      return Promise.reject(new Error('Native transport not available'))
    }
    this.bridge = window.ReactNativeWebView
    window.__GENUM_ROBO__ = {
      ingress: (kind, payload) => {
        if (kind === 'telemetry') {
          const telemetry: CarTelemetry = {}
          parseTelemetryLine(payload, telemetry)
          if (Object.keys(telemetry).length) this.options.onTelemetry?.(telemetry)
        } else if (kind === 'connected') {
          this._connected = true
          this.options.onStatus?.('connected', payload || 'Car connected')
        } else if (kind === 'disconnected') {
          this._connected = false
          this.options.onStatus?.('disconnected', payload || undefined)
        } else if (kind === 'error') {
          this.options.onStatus?.('error', payload || 'Car connection failed')
        }
      },
    }
    // Ask the shell to (re)open its underlying connection (a WS URL for a
    // LAN car, or a BLE scan for the car's UART service), then confirm via
    // ingress('connected', ...).
    this.emit('connect', { transport: this.transport, url: this.url })
    // The shell will call ingress('connected') when the link is up.
    return Promise.resolve()
  }

  async disconnect(): Promise<void> {
    this.emit('disconnect', null)
    this._connected = false
    delete window.__GENUM_ROBO__
    this.bridge = null
    this.options.onStatus?.('disconnected')
  }

  async sendLine(line: string): Promise<void> {
    if (!this.bridge) throw new Error('Not connected')
    this.emit('send', line)
  }

  async setMode(token: string) { await this.sendLine(token) }
  async setDirection(d: 'F' | 'B' | 'L' | 'R' | 'S') { await this.sendLine(d) }
  async setSpeed(value: number) { await this.sendLine(`SPD${Math.round(value)}`) }
  async setServo(value: number) { await this.sendLine(`SERVO${Math.round(value)}`) }
  async calibratePid(p: { kp: number; ki: number; kd: number; out: number; off: number }) {
    await this.sendLine(buildCalibration(p))
  }
  async requestState() { await this.sendLine('REQ_STATE') }
}

// Factory so the UI can request a concrete transport.
export type NativeLink = 'ws' | 'ble'
export type CarTransportOptions = TransportOptions & { url?: string; transport?: NativeLink }

export function createCarTransport(
  kind: 'websocket' | 'ble' | 'native',
  options: CarTransportOptions = {},
): CarTransport {
  switch (kind) {
    case 'websocket':
      return new WebSocketTransport(options.url ?? 'ws://192.168.4.1:81', options)
    case 'native': {
      const t = new NativeTransport(options)
      if (options.url) t.setUrl(options.url)
      if (options.transport) t.setTransport(options.transport)
      return t
    }
    default:
      return new BluetoothTransport(options)
  }
}
