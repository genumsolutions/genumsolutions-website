// =====================================================================
// project-catalog.ts - single source of truth for the GENUM "IoT &
// Remote Controller" project categories (web-side).
//
// This is the ONE place the 5 controller categories are defined on the
// website: the /iot-remote hub selector, the control panels, and any
// descriptive grid all read from here. Renders nothing itself; consumer
// components map the enum to UI.
//
// The product catalogue (buyable packages) is separate - see
// lib/catalog.ts / ProjectsCatalog. This file is about CONTROLLERS.
// =====================================================================

export type ControlCapability =
  | 'directional' // F/B/L/R + speed (drives)
  | 'servo' // steering servo
  | 'pid' // PID tuning + live angle
  | 'start-stop' // autonomous run/stop
  | 'relay' // on/off relay/switch outputs
  | 'sensor' // live sensor readout
  | 'weblink' // client/server ESP link
  | 'slider' // arbitrary 0..n control (e.g. speed/threshold)

export type ProjectCategory = {
  slug: string
  name: string
  tagline: string
  description: string
  hardware: string[]
  /** What control capabilities the panel for this category offers. */
  capabilities: ControlCapability[]
  /** For directional/servo/pid categories, the robo-car mode id to drive. */
  carType?: string
}

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  {
    slug: 'robocar',
    name: 'Robo Car',
    tagline: 'Drive robot cars with two joysticks, like the hand-held remote.',
    description:
      'Connect a BLE or WiFi car and drive it with the virtual joysticks and Select / Back buttons - 4WD, 2WD+servo, self-balancing, obstacle avoidance, path following, and website-controlled cars.',
    hardware: ['ESP32', 'BO / brushed motors', 'Servo', 'MPU6050', 'HC-SR04 / IR'],
    capabilities: ['directional', 'servo', 'pid', 'start-stop', 'weblink', 'slider'],
    carType: '4wd4m',
  },
  {
    slug: 'home-automation',
    name: 'Home Automation',
    tagline: 'Flip relays, switches, and read sensors around the home.',
    description:
      'Control lights, fans, relays, and sensors using ESP32/ESP8266 - toggle outputs and read temperature, humidity, and motion locally or over the network.',
    hardware: ['ESP32 / ESP8266', 'Relay modules', 'DHT / BME sensors', 'IR & motion detect'],
    capabilities: ['relay', 'sensor', 'slider'],
  },
  {
    slug: 'smart-farm',
    name: 'Smart Farm',
    tagline: 'Pumps, solenoids, and soil sensors for automation.',
    description:
      'Automate irrigation and soil monitoring - toggle pumps and solenoids, and read soil moisture and ambient sensors from one dashboard.',
    hardware: ['ESP32', 'Soil moisture sensors', 'Water pumps / solenoids', 'Relays & PSUs'],
    capabilities: ['relay', 'sensor', 'slider'],
  },
  {
    slug: 'smart-city',
    name: 'Smart City',
    tagline: 'Lighting, parking, and environment monitoring prototypes.',
    description:
      'Street lighting, parking sensing, and air-quality monitoring prototypes - control outputs and read environment sensors.',
    hardware: ['ESP32', 'Ambient air sensors', 'Ultrasonic / IR', 'NeoPixel / LED arrays'],
    capabilities: ['relay', 'sensor', 'slider'],
  },
  {
    slug: 'drones',
    name: 'Drones & Aerial',
    tagline: 'Flight-controller and telemetry builds.',
    description:
      'Flight-controller setup, motor/ESC integration, and telemetry links to the ground station.',
    hardware: ['ESP32 / STM32', 'Flight cameras', 'ESC + brushless motors', 'GPS & IMU'],
    capabilities: ['sensor', 'slider'],
  },
]

export function getProjectCategory(slug: string): ProjectCategory | undefined {
  return PROJECT_CATEGORIES.find((c) => c.slug === slug)
}

/** Human-readable note per control capability, used to describe a category. */
export const CAPABILITY_NOTES: Record<ControlCapability, string> = {
  directional: 'Drive forward, back, left, and right with adjustable speed',
  servo: 'Steer with a servo and tune the endpoint angles',
  pid: 'Tune the PID and read the live angle/heading',
  'start-stop': 'Run and stop autonomous behaviour with a toggle',
  relay: 'Flip relay / switch outputs (AC and DC loads)',
  sensor: 'Read live sensor values from the device',
  weblink: 'Link a client/server ESP connection over WiFi',
  slider: 'Adjust an arbitrary 0..n value (speed, threshold, brightness)',
}

/** Bullet list describing what you can build for a category (tagline first). */
export function categoryBullets(category: ProjectCategory): string[] {
  const capPoints = category.capabilities.map(
    (cap) => CAPABILITY_NOTES[cap] ?? `Control via ${cap}`,
  )
  return [category.tagline, ...capPoints].filter(Boolean)
}
