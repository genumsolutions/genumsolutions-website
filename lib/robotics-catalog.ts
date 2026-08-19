import type { Product } from './catalog'

export type RoboticsBuild = {
  slug: string
  name: string
  tier: string
  description: string
  skills: string[]
  components: string[]
  audience: string
  difficulty: Product['difficulty']
  time: string
}

export const roboticsBuilds: RoboticsBuild[] = [
  { slug: 'line-follower-car', name: 'Line Follower Car', tier: 'Beginner', description: 'A two-sensor robot car that follows a marked path and teaches the sense-decide-act loop.', skills: ['IR sensing', 'motor control', 'conditional logic'], components: ['Arduino Uno', 'L298N or L293D driver', '2 IR sensors', '2 DC motors'], audience: 'Learners aged 10+ and school robotics clubs', difficulty: 'Beginner', time: '2–3 hours' },
  { slug: 'obstacle-avoidance-car', name: 'Obstacle Avoidance Car', tier: 'Beginner–Intermediate', description: 'An autonomous car that reads distance and chooses a safe turn when an obstacle is detected.', skills: ['ultrasonic sensing', 'autonomous control', 'decision trees'], components: ['Arduino Uno or ESP32', 'HC-SR04 ultrasonic sensor', 'motor driver', '2–4 DC motors'], audience: 'Learners aged 12+ and maker workshops', difficulty: 'Intermediate', time: '3–4 hours' },
  { slug: 'light-follower-car', name: 'Light Follower Car', tier: 'Beginner', description: 'A robot that compares light levels and steers toward a light source.', skills: ['LDR sensors', 'analog input', 'differential steering'], components: ['Arduino Uno', 'LDR sensors', 'motor driver', '2 DC motors'], audience: 'Young makers and classroom labs', difficulty: 'Beginner', time: '2–3 hours' },
  { slug: 'rf-remote-control-car', name: 'RF Remote Control Car', tier: 'Beginner', description: 'A wireless car platform for learning remote commands, motor direction, and safe stopping.', skills: ['RF communication', 'remote control', 'motor drivers'], components: ['Arduino Uno', 'RF transmitter and receiver', 'L298N driver', 'chassis and motors'], audience: 'Beginners building their first wireless robot', difficulty: 'Beginner', time: '3–4 hours' },
  { slug: 'bluetooth-controlled-car', name: 'Bluetooth-Controlled Car', tier: 'Intermediate', description: 'A phone-controlled robot car with directional commands and speed control.', skills: ['Bluetooth serial', 'mobile control', 'PWM speed control'], components: ['Arduino Uno or ESP32', 'HC-05 or HC-06', 'L298N driver', 'chassis and motors'], audience: 'Students, clubs, and mobile-app learners', difficulty: 'Intermediate', time: '4–5 hours' },
  { slug: 'voice-controlled-car', name: 'Voice-Controlled Car', tier: 'Intermediate', description: 'A wireless robot that translates voice commands from a phone into movement.', skills: ['voice interfaces', 'Bluetooth commands', 'state handling'], components: ['ESP32 or Arduino Uno', 'Bluetooth module', 'motor driver', 'phone app'], audience: 'Learners aged 13+ and accessibility-focused projects', difficulty: 'Intermediate', time: '4–6 hours' },
  { slug: 'gesture-controlled-car', name: 'Gesture-Controlled Car', tier: 'Advanced', description: 'A multi-modal robot driven by hand movement from an accelerometer or gesture controller.', skills: ['motion sensing', 'wireless protocols', 'multi-modal input'], components: ['ESP32 or Arduino Uno', 'MPU6050', 'Bluetooth module', 'motor driver'], audience: 'Advanced school and university teams', difficulty: 'Advanced', time: '6–8 hours' },
  { slug: 'solar-powered-car', name: 'Solar-Powered Car', tier: 'Intermediate', description: 'A small vehicle that introduces energy conversion, power budgeting, and low-voltage motion.', skills: ['solar power', 'energy measurement', 'motor control'], components: ['Solar panel', 'charge or power module', 'motor driver', 'DC motors'], audience: 'STEM fairs and sustainability workshops', difficulty: 'Intermediate', time: '4–6 hours' },
  { slug: 'maze-solver-car', name: 'Maze Solver Car', tier: 'Advanced', description: 'A sensor-rich robot that maps decisions through a maze and improves its route over time.', skills: ['sensor arrays', 'algorithmic navigation', 'path memory'], components: ['Arduino or ESP32', 'IR or ultrasonic sensors', 'motor driver', 'encoders'], audience: 'Competition teams and advanced learners', difficulty: 'Advanced', time: '8–12 hours' },
  { slug: 'iot-enabled-car', name: 'IoT-Enabled Car', tier: 'Advanced', description: 'A connected robot that reports status and receives commands through a network dashboard.', skills: ['Wi-Fi', 'telemetry', 'web dashboards'], components: ['ESP32', 'Wi-Fi network', 'motor driver', 'dashboard service'], audience: 'IoT learners and prototype teams', difficulty: 'Advanced', time: '8–12 hours' },
  { slug: 'self-parking-car', name: 'Self-Parking Car', tier: 'Advanced', description: 'A sensor-guided vehicle that detects a space and performs a controlled parking maneuver.', skills: ['distance sensing', 'motion planning', 'closed-loop control'], components: ['ESP32 or Arduino', 'ultrasonic sensors', 'motor driver', 'encoders'], audience: 'Advanced learners and applied research teams', difficulty: 'Advanced', time: '8–12 hours' },
  { slug: 'ai-vision-car', name: 'AI Vision Car', tier: 'Advanced', description: 'A camera-enabled mobile platform for object detection, color tracking, or local visual inference.', skills: ['computer vision', 'machine learning', 'real-time inference'], components: ['ESP32-CAM or Raspberry Pi', 'camera module', 'L298N driver', '2–4 DC motors'], audience: 'Advanced learners aged 17+ and prototype teams', difficulty: 'Advanced', time: '8–12 hours' },
  { slug: 'obstacle-avoiding-line-follower', name: 'Obstacle Avoiding Line Follower', tier: 'Combo', description: 'A hybrid robot that follows a line while using ultrasonic sensing to detect and avoid obstacles.', skills: ['sensor fusion', 'multi-condition logic', 'modular programming'], components: ['Arduino Uno', 'IR sensors', 'ultrasonic sensor', 'motor driver'], audience: 'Beginner and intermediate classroom groups', difficulty: 'Intermediate', time: '3–4 hours' },
  { slug: 'bluetooth-obstacle-avoidance-car', name: 'Bluetooth + Obstacle Avoidance Car', tier: 'Combo', description: 'A dual-mode car that switches between phone control and autonomous obstacle avoidance.', skills: ['mode switching', 'wireless communication', 'sensor integration'], components: ['Arduino Uno or ESP32', 'HC-05 Bluetooth', 'ultrasonic sensor', 'motor driver'], audience: 'Learners aged 13+ and robotics clubs', difficulty: 'Intermediate', time: '4–5 hours' },
  { slug: 'gesture-voice-control-car', name: 'Gesture + Voice Control Car', tier: 'Combo', description: 'A multi-modal car controlled by both hand gestures and voice commands.', skills: ['sensor integration', 'multi-threaded programming', 'user interface design'], components: ['Arduino Uno or ESP32', 'MPU6050', 'Bluetooth module', 'phone microphone or app'], audience: 'Intermediate and advanced learners aged 15+', difficulty: 'Advanced', time: '6–8 hours' },
  { slug: 'emotion-expressive-car', name: 'Emotion-Expressive Car', tier: 'Unique', description: 'A creative robot that uses movement, sound, and light patterns to express a defined state.', skills: ['human-robot interaction', 'emotion modeling', 'creative coding'], components: ['Arduino Uno or ESP32', 'WS2812 RGB ring', 'buzzer or speaker', 'touch/light/sound sensors'], audience: 'Creative robotics teams and advanced classrooms', difficulty: 'Advanced', time: '6–8 hours' },
  { slug: 'swarm-bots', name: 'Swarm Bots', tier: 'Unique', description: 'A coordinated set of small robots exploring communication, distributed behavior, and collective tasks.', skills: ['distributed algorithms', 'wireless communication', 'swarm robotics'], components: ['Multiple ESP32 or Arduino Nano boards', 'motor drivers', 'RF/Bluetooth/Zigbee', 'IR or ultrasonic sensors'], audience: 'University teams and advanced maker groups', difficulty: 'Advanced', time: '8–16 hours' },
  { slug: 'music-reactive-car', name: 'Music-Reactive Car', tier: 'Unique', description: 'A robot that responds to sound with movement and lighting patterns in real time.', skills: ['sound processing', 'real-time control', 'creative coding'], components: ['Arduino Uno or ESP32', 'microphone module', 'WS2812 RGB ring', 'motor driver'], audience: 'Creative learners aged 14+ and exhibitions', difficulty: 'Advanced', time: '5–7 hours' },
  { slug: 'robotic-arm-car', name: 'Robotic Arm Car', tier: 'Unique', description: 'A mobile platform with a servo arm for pick-and-place, drawing, or object manipulation.', skills: ['kinematics', 'servo control', 'automation'], components: ['Arduino Uno or ESP32', '4–6 servo motors', 'robotic arm kit', 'mobile chassis'], audience: 'Advanced learners aged 16+ and automation teams', difficulty: 'Advanced', time: '8–12 hours' },
  { slug: 'delivery-car', name: 'Delivery Car', tier: 'Unique', description: 'A mobile platform for autonomous delivery experiments in a mapped or bounded environment.', skills: ['mapping', 'navigation', 'path planning', 'payload management'], components: ['ESP32 or Raspberry Pi', 'ultrasonic or IR sensors', 'encoders', 'payload compartment'], audience: 'Applied robotics teams and advanced learners', difficulty: 'Advanced', time: '10–14 hours' },
  { slug: 'battle-bots', name: 'Battle Bots', tier: 'Unique', description: 'A robust competition platform for mechanical design, remote control, strategy, and safety engineering.', skills: ['mechanical design', 'remote control', 'competitive strategy'], components: ['Arduino Uno or ESP32', 'reinforced chassis', 'motor driver', 'remote control system'], audience: 'Competition teams aged 16+; safety supervised', difficulty: 'Advanced', time: '10–16 hours' },
  { slug: 'environment-sensing-car', name: 'Environment Sensing Car', tier: 'Unique', description: 'A mobile data-collection platform for temperature, humidity, gas, air quality, and light experiments.', skills: ['sensor integration', 'data logging', 'IoT connectivity'], components: ['ESP32 or Arduino Uno', 'DHT11/22', 'MQ-series sensors', 'light sensors'], audience: 'Environmental science and IoT teams', difficulty: 'Advanced', time: '6–8 hours' },
]

const configurations = [
  ['classroom-build', 'Classroom Build', 'Teacher-ready assembly path with a guided project brief and learner checkpoints.'],
  ['modular-build', 'Modular Build', 'Component-separated build based on the modular firmware and hardware approach in the archive.'],
  ['bluetooth-control', 'Bluetooth Control', 'Phone-based directional control with speed and stop commands where supported.'],
  ['wifi-web-control', 'Wi-Fi / Web Control', 'Browser control and status concepts based on the ESP32 WebServer and WebSocket projects.'],
  ['autonomous-upgrade', 'Autonomous Sensor Upgrade', 'Obstacle, line, or environment sensing extension selected for the base project.'],
  ['advanced-integration', 'Advanced Integration', 'Scoped extension for telemetry, dashboards, vision, arm control, or multi-mode behavior.'],
]

export const roboticsProducts: Product[] = roboticsBuilds.flatMap((build, buildIndex) => configurations.map(([variant, variantName, variantDescription], variantIndex) => ({
  id: `robotics-${build.slug}-${variant}`,
  name: `${build.name} · ${variantName}`,
  category: 'Project Solutions',
  price: 0,
  priceLabel: 'Quote by scope',
  sku: `GEN-ROB-SRC-${String(buildIndex + 1).padStart(2, '0')}-${String(variantIndex + 1).padStart(2, '0')}`,
  productType: 'Project package',
  note: `${build.tier} project · ${build.time}`,
  description: `${build.description} ${variantDescription}`,
  specs: [...build.components, `Skills: ${build.skills.join(', ')}`, `Build time: ${build.time}`],
  audience: build.audience,
  difficulty: build.difficulty,
  warranty: 'Scope, hardware, testing, and support terms confirmed in proposal',
  stock: 0,
  delivery: 'Discovery required · quote by scope',
  color: variantIndex % 2 === 0 ? 'from-[#dce8ff] to-[#7e9ff2]' : 'from-[#dff4ec] to-[#79c7a8]',
  badge: 'Project catalog',
})))
