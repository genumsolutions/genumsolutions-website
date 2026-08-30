// =====================================================================
// robo-car-catalog.ts - the GENUM robot-car control catalogue.
//
// Single source of truth for the robot-car modes the app and website
// control. The 9 modes come from the ESP32 remote firmware
// (Remote_..._2WD1M_3_0_0/state.cpp -> MODE_CMDS[]). The command protocol
// mirrors that firmware (comms.cpp + README):
//
//   Outgoing (app/site -> car), newline terminated:
//     Direction  F | B | L | R | S            (non-2WD1M modes)
//     Speed      SPD<n>   ±255 (2WD1M signed)
//     Servo      SERVO<n> 0..180, center 90
//     Mode select BT | 2WD1M | AUTO | PATH | OBS_US | OBS_IR | MAN | ESP_CLI | ESP_SER
//     Calibrate  CFG;Kp:..;Ki:..;Kd:..;OUT:..;OFF:..
//     Request    REQ_STATE
//   Incoming (car -> app/site):
//     STATE;MODE=2WD1M;SPD=120;TRIM=0;STATUS=Forward
//     TEL;Kp:..;Ki:..;Kd:..;OUT:..;OFF:..;ANGLE:..   (AUTO live PID)
//     SPD<n>
//
// Each entry describes one mode: friendly name, the command token the car
// recognises, the physical car type it belongs to, its sensors/controllers,
// and which touch controls the app/site should render for it.
// =====================================================================

export type CarType =
  | '4wd4m' // 4-wheel-drive, 4 motors
  | '2wd1m' // 2-wheel-differential with servo steering
  | 'self-balancing' // 1-mode autonomous (PID self-balance)
  | 'obstacle-us' // obstacle avoidance via ultrasonic
  | 'obstacle-ir' // obstacle avoidance via IR
  | 'website-client' // ESP32 as website client (controls browser)
  | 'website-server' // ESP32 as website server (hosts page)
  | 'path-follow' // IR line/path following
  | 'rf-manual' // manual RF (not BT/WiFi)

export type ControlKind =
  | 'drive-tank' // 4WD: drive+direction
  | 'drive-2wd1m' // 2WD1M: motor speed + servo steer
  | 'pid-auto' // self-balancing: PID sliders + live angle
  | 'start-stop' // autonomous: run/stop + read-only telemetry
  | 'tuning' // config-driven (path/obstacle thresholds)
  | 'weblink' // website client/server: point at ESP IP

export interface RoboCarMode {
  id: CarType
  name: string
  /** Command token sent to the car to select this mode. */
  token: string
  car: string
  wheel: string
  steering: string
  sensors: string[]
  /** What comms the car exposes locally. */
  transport: ('ble' | 'wifi' | 'classic-bt' | 'rf')[]
  /** Default remote the car pairs with. */
  remoteWith: string
  controls: ControlKind[]
  /** Whether the car needs a device connected before controls unlock. */
  requiresConnection: boolean
  blurb: string
}

export const ROBOCAR_MODES: RoboCarMode[] = [
  {
    id: '4wd4m',
    name: 'Bluetooth · 4WD (4M)',
    token: 'BT',
    car: '4-wheel-drive',
    wheel: '4 × BO/brushed motors',
    steering: 'Skid-steer (differential)',
    sensors: [],
    transport: ['ble', 'classic-bt'],
    remoteWith: 'ESP REMOTE or app',
    controls: ['drive-tank'],
    requiresConnection: true,
    blurb: 'A 4-motor drive car driven by direction (F/B/L/R) and speed.',
  },
  {
    id: '2wd1m',
    name: 'Bluetooth · 2WD + Servo (1M)',
    token: '2WD1M',
    car: '2-wheel-drive',
    wheel: '1 × BO motor (rear)',
    steering: '1 × servo (0..180, center 90)',
    sensors: [],
    transport: ['ble', 'classic-bt'],
    remoteWith: 'ESP REMOTE two-joystick',
    controls: ['drive-2wd1m'],
    requiresConnection: true,
    blurb: 'One drive motor plus a steering servo. Speed is signed SPD (fwd +ve).',
  },
  {
    id: 'self-balancing',
    name: 'Self-Balancing',
    token: 'AUTO',
    car: 'Self-balancing',
    wheel: '2 × BO motors',
    steering: 'Self-balance (PID)',
    sensors: ['MPU6050 IMU'],
    transport: ['ble', 'wifi', 'classic-bt'],
    remoteWith: 'ESP REMOTE (PID tuning)',
    controls: ['pid-auto'],
    requiresConnection: true,
    blurb: 'Balances itself in AUTO mode. The app/remote tune Kp/Ki/Kd OUT/OFF live.',
  },
  {
    id: 'obstacle-us',
    name: 'Obstacle Avoidance · Ultrasonic',
    token: 'OBS_US',
    car: 'Obstacle avoider',
    wheel: '2/4 × BO motors',
    steering: 'Skid-steer',
    sensors: ['HC-SR04 / ultrasonic'],
    transport: ['ble', 'wifi', 'classic-bt'],
    remoteWith: 'ESP REMOTE',
    controls: ['start-stop'],
    requiresConnection: true,
    blurb: 'Runs autonomous obstacle avoidance using an ultrasonic sensor.',
  },
  {
    id: 'obstacle-ir',
    name: 'Obstacle Avoidance · IR',
    token: 'OBS_IR',
    car: 'Obstacle avoider',
    wheel: '2/4 × BO motors',
    steering: 'Skid-steer',
    sensors: ['IR / photodiode pair'],
    transport: ['ble', 'wifi', 'classic-bt'],
    remoteWith: 'ESP REMOTE',
    controls: ['start-stop'],
    requiresConnection: true,
    blurb: 'Autonomous obstacle avoidance driven by IR sensors.',
  },
  {
    id: 'website-client',
    name: 'Website Controlled · Client',
    token: 'ESP_CLI',
    car: 'Website car',
    wheel: '2/4 × BO motors',
    steering: 'Skid-steer',
    sensors: [],
    transport: ['wifi'],
    remoteWith: 'Browser / app',
    controls: ['weblink'],
    requiresConnection: false,
    blurb: 'The ESP32 is a WiFi client; the browser/app acts as the control server.',
  },
  {
    id: 'website-server',
    name: 'Website Controlled · Server',
    token: 'ESP_SER',
    car: 'Website car',
    wheel: '2/4 × BO motors',
    steering: 'Skid-steer',
    sensors: [],
    transport: ['wifi'],
    remoteWith: 'Browser / app',
    controls: ['weblink'],
    requiresConnection: false,
    blurb: 'The ESP32 hosts its own web page; open its IP to drive it.',
  },
  {
    id: 'path-follow',
    name: 'Path Following · IR',
    token: 'PATH',
    car: 'Line follower',
    wheel: '2/4 × BO motors',
    steering: 'Skid-steer',
    sensors: ['IR line sensors'],
    transport: ['ble', 'wifi', 'classic-bt'],
    remoteWith: 'ESP REMOTE',
    controls: ['start-stop'],
    requiresConnection: true,
    blurb: 'Follows an IR-detected line or path autonomously.',
  },
  {
    id: 'rf-manual',
    name: 'Manual · RF',
    token: 'MAN',
    car: 'RF car',
    wheel: '2/4 × BO motors',
    steering: 'Skid-steer',
    sensors: [],
    transport: ['rf'],
    remoteWith: 'RF hand-held remote',
    controls: ['drive-tank'],
    requiresConnection: false,
    blurb: 'Manual control over RF modules (not BT or WiFi) - drive with the RF handset.',
  },
]

export const CAR_TYPE_MAP = ROBOCAR_MODES.reduce<Record<string, RoboCarMode>>(
  (map, mode) => {
    map[mode.id] = mode
    return map
  },
  {},
)

/** Resolve a car-type id or mode token to its catalogue entry. */
export function resolveCarType(idOrToken: string): RoboCarMode | undefined {
  return (
    CAR_TYPE_MAP[idOrToken.toLowerCase()] ??
    ROBOCAR_MODES.find((m) => m.token.toLowerCase() === idOrToken.toLowerCase())
  )
}
