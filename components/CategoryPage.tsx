type Category = {
  slug: string
  eyebrow: string
  title: string
  body: string
  points: string[]
  hardware: string[]
}

const CATEGORIES: Record<string, Category> = {
  'home-automation': {
    slug: 'home-automation',
    eyebrow: 'Category · Home Automation',
    title: 'Home Automation',
    body: 'Control lights, fans, relays, sensors, and smart devices around the home using ESP32/ESP8266 and Arduino — locally or over the internet.',
    points: [
      'Relay & switch control (AC/DC loads)',
      'Temperature, humidity & ambient sensors',
      'Remote on/off and schedules from the app and website',
      'Voice and WiFi (MQTT / WebSocket) integration',
    ],
    hardware: ['ESP32 / ESP8266', 'Relay modules', 'DHT / BME sensors', 'IR & motion detect'],
  },
  'smart-farm': {
    slug: 'smart-farm',
    eyebrow: 'Category · Smart Farm',
    title: 'Smart Farm',
    body: 'Automate irrigation, soil monitoring, greenhouses, and livestock with ESP and Arduino controllers, then manage everything from one dashboard.',
    points: [
      'Automated irrigation from soil moisture',
      'Pump, solenoid & relay control',
      'Temperature / humidity / light logging',
      'Alerts and telemetry to the app and website',
    ],
    hardware: ['ESP32', 'Soil moisture sensors', 'Water pumps / solenoids', 'Relays & PSUs'],
  },
  'smart-city': {
    slug: 'smart-city',
    eyebrow: 'Category · Smart City',
    title: 'Smart City',
    body: 'Street lighting, parking, waste, environment monitoring, and signalling prototypes built with ESP and Arduino and controlled over the network.',
    points: [
      'Intelligent street & status lighting',
      'Parking occupancy sensing',
      'Environment / air-quality monitoring',
      'Central monitoring via MQTT / WebSocket',
    ],
    hardware: ['ESP32', 'Ambient air sensors', 'Ultrasonic / IR', 'NeoPixel / LED arrays'],
  },
  drones: {
    slug: 'drones',
    eyebrow: 'Category · Drones',
    title: 'Drones & Aerial',
    body: 'Flight-controller and telemetry builds for quadcopters and aerial platforms, from sensor wiring to ground-station control.',
    points: [
      'Flight controller setup & tuning',
      'Motor, ESC & propeller integration',
      'Telemetry link to the ground station',
      'Payload & sensor mounting',
    ],
    hardware: ['ESP32 / STM32', 'Flight cameras', 'ESC + brushless motors', 'GPS & IMU'],
  },
}

export function category(slug: string): Category {
  return (
    CATEGORIES[slug] ?? {
      slug,
      eyebrow: 'Category',
      title: slug,
      body: 'Projects in this category.',
      points: [],
      hardware: [],
    }
  )
}

export default function CategoryPage({ slug }: { slug: string }) {
  const cat = category(slug)
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <p className="text-[10px] font-black uppercase tracking-widest text-navy">{cat.eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink lg:text-5xl">{cat.title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted lg:text-lg">{cat.body}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-ink">What you can build</h2>
          <ul className="mt-4 space-y-3">
            {cat.points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm leading-6 text-muted">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-ink">Typical hardware</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cat.hardware.map((item) => (
              <li key={item} className="rounded-full bg-mist px-3 py-1.5 text-xs font-bold text-navy">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl bg-sky px-4 py-3">
            <p className="text-sm font-bold text-navy">Device controls</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Live control panels for this category are being wired to the same
              Bluetooth / WiFi transport used on the Robot Car page.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
