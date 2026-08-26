import { quotationItems } from './quotation-catalog'

export type Product = {
  id: string
  name: string
  category: string
  price: number
  priceLabel: string
  sku: string
  productType: 'Retail kit' | 'Project package' | 'Material' | 'Service package'
  note: string
  description: string
  specs: string[]
  audience: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional'
  warranty: string
  stock: number
  delivery: string
  color: string
  badge?: string
  supplier?: string
  image?: string
}

const standard = {
  audience: 'Students, schools, hobbyists, and makers',
  difficulty: 'Beginner' as const,
  warranty: '7-day component replacement for manufacturing defects',
  delivery: 'Ships in 1–2 working days',
}

const inventoryProducts: Product[] = [
  { ...standard, id: 'arduino-uno', name: 'Arduino UNO R3', category: 'Controllers & Boards', price: 1450, priceLabel: 'NPR 1,450', sku: 'GEN-ARD-0001', productType: 'Retail kit', note: 'Reliable classroom controller', description: 'The dependable Arduino UNO board for first circuits, sensors, motor control, and classroom robotics.', specs: ['ATmega328P microcontroller', '14 digital I/O pins', '6 analog inputs', 'USB cable included'], stock: 18, color: 'from-[#dce8ff] to-[#7e9ff2]', badge: 'Core inventory', image: '/media/products/arduino-uno.jpg' },
  { ...standard, id: 'esp32-dev-board', name: 'ESP32 Development Board', category: 'Controllers & Boards', price: 1850, priceLabel: 'NPR 1,850', sku: 'GEN-ESP-0001', productType: 'Retail kit', note: 'Wi-Fi and Bluetooth ready', description: 'A connected development board for web control, IoT experiments, sensors, and compact robot projects.', specs: ['Wi-Fi and Bluetooth', 'Dual-core MCU', 'GPIO, ADC, and PWM support', 'USB programming cable'], stock: 16, color: 'from-[#dff4ec] to-[#79c7a8]', badge: 'Core inventory', image: '/media/products/esp32-dev-board.jpg' },
  { ...standard, id: 'dc-geared-motor-pair', name: 'DC Geared Motor Pair', category: 'Motors & Motion', price: 890, priceLabel: 'NPR 890', sku: 'GEN-MOT-0001', productType: 'Retail kit', note: 'Reliable motion, ready to wire', description: 'A matched pair of compact geared motors for robot cars, mechanisms, and classroom prototypes.', specs: ['2 geared DC motors', '3–6V operating range', 'Mounting hardware', 'Bench-tested before dispatch'], stock: 37, color: 'from-[#f1e9ff] to-[#c4a8ef]', image: '/media/products/dc-geared-motor-pair.jpg' },
  { ...standard, id: 'sg90-servo-pair', name: 'SG90 Micro Servo Pair', category: 'Motors & Motion', price: 650, priceLabel: 'NPR 650', sku: 'GEN-MOT-0002', productType: 'Retail kit', note: 'Compact positioning motion', description: 'Small servo motors for steering, sensor mounts, robotic arms, and interactive mechanisms.', specs: ['2 micro servos', '180-degree movement', 'Servo horns and screws', '5V operation'], stock: 22, color: 'from-[#fff1cf] to-[#f1c875]', image: '/media/products/sg90-servo-pair.jpg' },
  { ...standard, id: 'ultrasonic-sensor', name: 'HC-SR04 Ultrasonic Sensor', category: 'Sensors & Modules', price: 280, priceLabel: 'NPR 280', sku: 'GEN-SEN-0001', productType: 'Retail kit', note: 'Measure distance simply', description: 'A practical distance sensor for obstacle avoidance, parking experiments, and interactive projects.', specs: ['2–400 cm range', '5V operation', 'Trigger and echo pins', 'Mounting header pins'], stock: 30, color: 'from-[#e8f3ef] to-[#a9d9c6]', image: '/media/products/ultrasonic-sensor.jpg' },
  { ...standard, id: 'sensor-starter-pack', name: 'Sensor & Module Starter Pack', category: 'Sensors & Modules', price: 2200, priceLabel: 'NPR 2,200', sku: 'GEN-SEN-0002', productType: 'Retail kit', note: '15 hands-on experiments', description: 'A tidy collection of common sensor modules for Arduino and ESP32 experiments.', specs: ['15 sensor and module boards', 'Breadboard and jumper wires', 'Project card deck', 'Arduino and ESP32 compatible'], stock: 24, color: 'from-[#e8f3ef] to-[#a9d9c6]', badge: 'Classroom pack', image: '/media/products/sensor-starter-pack.jpg' },
  { ...standard, id: 'mpu6050-imu', name: 'MPU6050 IMU Module', category: 'Sensors & Modules', price: 480, priceLabel: 'NPR 480', sku: 'GEN-SEN-0003', productType: 'Retail kit', note: 'Motion and orientation sensing', description: 'A six-axis motion module for balancing, gesture control, and movement experiments.', specs: ['3-axis accelerometer', '3-axis gyroscope', 'I2C interface', 'Header pins included'], stock: 15, color: 'from-[#dce8ff] to-[#7e9ff2]', image: '/media/products/mpu6050-imu.jpg' },
  { ...standard, id: '18650-battery-pack', name: '18650 Li-ion Battery Pack', category: 'Power & Charging', price: 950, priceLabel: 'NPR 950', sku: 'GEN-PWR-0001', productType: 'Retail kit', note: 'Portable project power', description: 'A protected rechargeable battery pack for mobile robotics and low-voltage prototypes.', specs: ['Protected Li-ion cells', 'Project connector lead', 'Insulated holder', 'Use with a suitable charger'], stock: 20, color: 'from-[#ffe3d6] to-[#f1a17e]', image: '/media/products/18650-battery-pack.jpg' },
  { ...standard, id: 'li-ion-charger', name: 'Li-ion Battery Charger', category: 'Power & Charging', price: 750, priceLabel: 'NPR 750', sku: 'GEN-PWR-0002', productType: 'Retail kit', note: 'Charge project batteries safely', description: 'A compact charger for compatible Li-ion project battery packs.', specs: ['Charging indicator', 'Protected charging circuit', 'USB input', 'Compatibility guidance included'], stock: 14, color: 'from-[#fff1cf] to-[#f1c875]', image: '/media/products/li-ion-charger.jpg' },
  { ...standard, id: 'robot-wheel-set', name: 'Rubber Robot Wheel Set', category: 'Mechanical Parts', price: 420, priceLabel: 'NPR 420', sku: 'GEN-MEC-0001', productType: 'Retail kit', note: 'Grip for mobile builds', description: 'A pair of rubber wheels for small robot cars and motorized mechanisms.', specs: ['2 rubber wheels', 'Motor shaft adapters', 'Balanced tread', 'Compatible with geared motors'], stock: 26, color: 'from-[#e9e0ff] to-[#b79be9]', image: '/media/products/robot-wheel-set.jpg' },
  { ...standard, id: 'chassis-fastener-pack', name: 'Chassis & Fastener Pack', category: 'Mechanical Parts', price: 780, priceLabel: 'NPR 780', sku: 'GEN-MEC-0002', productType: 'Retail kit', note: 'Build a clean mechanical base', description: 'A practical selection of chassis plates, spacers, screws, nuts, and mounting hardware.', specs: ['Acrylic chassis plates', 'M3 spacers and screws', 'Nuts and washers', 'Assembly guide'], stock: 11, color: 'from-[#dfeaff] to-[#9fbaff]', image: '/media/products/chassis-fastener-pack.jpg' },
  { ...standard, id: 'dupont-jst-cable-pack', name: 'Dupont & JST Cable Pack', category: 'Connectors & Cables', price: 360, priceLabel: 'NPR 360', sku: 'GEN-CON-0001', productType: 'Retail kit', note: 'Connect modules without friction', description: 'Common jumper and JST leads for breadboards, sensors, controllers, and battery connections.', specs: ['Male-male Dupont leads', 'Male-female Dupont leads', 'JST battery leads', 'Organized cable set'], stock: 32, color: 'from-[#dff4ec] to-[#79c7a8]', image: '/media/products/dupont-jst-cable-pack.jpg' },
  { ...standard, id: 'soldering-tool-kit', name: 'Soldering & Prototype Tool Kit', category: 'Tools & Fabrication', price: 2450, priceLabel: 'NPR 2,450', sku: 'GEN-TOL-0001', productType: 'Retail kit', note: 'Make and repair with confidence', description: 'A beginner-friendly tool set for soldering, wiring, assembly, and prototype maintenance.', specs: ['Temperature-controlled iron', 'Solder and flux', 'Wire cutter and tweezers', 'Safety stand and sponge'], stock: 7, color: 'from-[#f1e9ff] to-[#c4a8ef]', image: '/media/products/soldering-tool-kit.jpg' },
  { ...standard, id: 'pla-filament', name: 'PLA Maker Filament · 1 kg', category: '3D Printing Materials', price: 2850, priceLabel: 'NPR 2,850', sku: 'GEN-3DP-0001', productType: 'Material', note: 'Reliable prints, clean finish', description: 'Everyday PLA filament for prototypes, enclosures, classroom parts, and useful physical models.', specs: ['1.75 mm diameter', '1 kg spool', 'Low-odor PLA material', '195–215°C suggested nozzle temperature'], stock: 14, color: 'from-[#ffe3d6] to-[#f1a17e]', badge: 'Maker essential', image: '/media/products/pla-filament.jpg' },
  { ...standard, id: 'petg-filament', name: 'PETG Maker Filament · 1 kg', category: '3D Printing Materials', price: 3200, priceLabel: 'NPR 3,200', sku: 'GEN-3DP-0002', productType: 'Material', note: 'Stronger functional prints', description: 'Durable PETG filament for functional parts, brackets, prototypes, and workshop fixtures.', specs: ['1.75 mm diameter', '1 kg spool', 'Good layer adhesion', '230–250°C suggested nozzle temperature'], stock: 8, color: 'from-[#dce8ff] to-[#7e9ff2]', image: '/media/products/petg-filament.jpg' },
  { ...standard, id: 'printer-care-kit', name: '3D Printer Care Kit', category: 'Tools & Fabrication', price: 1650, priceLabel: 'NPR 1,650', sku: 'GEN-3DP-0003', productType: 'Retail kit', note: 'Keep the next layer honest', description: 'A practical maintenance kit for calibration, cleaning, and small FDM printer repairs.', specs: ['Nozzle cleaning needles', 'Brass brush and tweezers', 'Bed leveling cards', 'PTFE tube and cutter'], stock: 9, color: 'from-[#e9e0ff] to-[#b79be9]', image: '/media/products/printer-care-kit.jpg' },
]

const quoteInventory = (id: string, name: string, category: string, sku: string, note: string, description: string, specs: string[], color: string, image?: string): Product => ({
  ...standard,
  id,
  name,
  category,
  price: 0,
  priceLabel: 'Request quote',
  sku,
  productType: 'Retail kit',
  note,
  description,
  specs,
  stock: 0,
  delivery: 'Availability and lead time confirmed with quotation',
  color,
  ...(image ? { image } : {}),
})

const additionalInventoryProducts: Product[] = [
  quoteInventory('arduino-mega', 'Arduino Mega', 'Controllers & Boards', 'GEN-ARD-0002', 'More pins for larger builds', 'A larger Arduino controller for multi-sensor, display, and automation projects.', ['Arduino Mega board', 'Expanded digital and analog I/O', 'USB programming connection'], 'from-[#dce8ff] to-[#7e9ff2]', '/media/products/arduino-mega.jpg'),
  quoteInventory('arduino-nano', 'Arduino Nano', 'Controllers & Boards', 'GEN-ARD-0003', 'Compact controller for small builds', 'A compact Arduino board for embedded projects and tight robot-car layouts.', ['Arduino Nano board', 'ATmega328-class controller', 'Compact header layout'], 'from-[#dff4ec] to-[#79c7a8]', '/media/products/arduino-nano.jpg'),
  quoteInventory('esp8266-board', 'ESP8266 Development Board', 'Controllers & Boards', 'GEN-ESP-0002', 'Wi-Fi for compact IoT builds', 'A compact Wi-Fi development board for connected sensors and small automation projects.', ['ESP8266 board', 'Wi-Fi connectivity', 'USB programming connection'], 'from-[#dce8ff] to-[#7e9ff2]', '/media/products/esp8266-board.jpg'),
  quoteInventory('stm32-board', 'STM32 Development Board', 'Controllers & Boards', 'GEN-STM-0001', 'Advanced embedded control', 'An STM32 board for learners and teams working with higher-performance embedded control.', ['STM32 microcontroller board', 'Digital and analog I/O', 'Embedded development support'], 'from-[#e9e0ff] to-[#b79be9]', '/media/products/stm32-board.jpg'),
  quoteInventory('raspberry-pi-board', 'Raspberry Pi Board', 'Controllers & Boards', 'GEN-RPI-0001', 'Linux edge computing platform', 'A Raspberry Pi platform for dashboards, vision, automation gateways, and networked projects.', ['Raspberry Pi computer board', 'Linux-capable platform', 'USB and network connectivity'], 'from-[#ffe3d6] to-[#f1a17e]', '/media/products/raspberry-pi-board.jpg'),
  quoteInventory('l298n-motor-driver', 'L298N Motor Driver', 'Motors & Motion', 'GEN-MOT-0003', 'Dual-channel motor control', 'A dual H-bridge driver for DC motor direction and speed control in robot platforms.', ['Dual H-bridge driver', 'Direction and PWM inputs', 'Motor power terminal'], 'from-[#f1e9ff] to-[#c4a8ef]', '/media/products/l298n-motor-driver.jpg'),
  quoteInventory('l298p-motor-driver', 'L298P Motor Driver', 'Motors & Motion', 'GEN-MOT-0004', 'Compact motor-control board', 'A compact motor driver for embedded mobile robotics and classroom builds.', ['L298P driver board', 'Dual motor channels', 'Direction and speed control'], 'from-[#f1e9ff] to-[#c4a8ef]', '/media/products/l298p-motor-driver.jpg'),
  quoteInventory('stepper-motor', 'Stepper Motor', 'Motors & Motion', 'GEN-MOT-0005', 'Precise incremental motion', 'A stepper motor for positioning, mechanisms, and automation experiments.', ['Stepper motor', 'Incremental positioning', 'Driver required for operation'], 'from-[#fff1cf] to-[#f1c875]', '/media/products/stepper-motor.jpg'),
  quoteInventory('bldc-motor', 'BLDC Motor', 'Motors & Motion', 'GEN-MOT-0006', 'Efficient high-speed motion', 'A brushless motor for drone, fan, and advanced motion projects.', ['Brushless DC motor', 'ESC required', 'High-speed motion platform'], 'from-[#ffe3d6] to-[#f1a17e]', '/media/products/bldc-motor.jpg'),
  quoteInventory('bo-motor', 'BO Gear Motor', 'Motors & Motion', 'GEN-MOT-0007', 'Robot-car drive motor', 'A small BO geared motor matched to the Arduino robot-car builds in the source projects.', ['BO geared motor', 'Low-voltage operation', 'Robot-car mounting format'], 'from-[#f1e9ff] to-[#c4a8ef]', '/media/products/bo-motor.jpg'),
  quoteInventory('hc06-bluetooth', 'HC-06 Bluetooth Module', 'Communication Modules', 'GEN-COM-0001', 'Phone control for Arduino cars', 'A serial Bluetooth module used by the Arduino robot-car source projects for manual control.', ['HC-06 serial Bluetooth', 'UART interface', 'Phone pairing support'], 'from-[#dce8ff] to-[#7e9ff2]', '/media/products/hc06-bluetooth.jpg'),
  quoteInventory('oled-display-13', '1.3-inch OLED Display', 'Displays & Interfaces', 'GEN-DSP-0001', 'Live robot telemetry', 'A small OLED display for robot status, modes, speed, and sensor feedback.', ['1.3-inch OLED', 'SH1106 or SSD1306 compatible', 'I2C interface'], 'from-[#dff4ec] to-[#79c7a8]', '/media/products/oled-display-13.jpg'),
  quoteInventory('oled-display-09', '0.9-inch OLED Display', 'Displays & Interfaces', 'GEN-DSP-0002', 'Compact status display', 'A compact OLED option for small embedded controllers and robot builds.', ['0.9-inch OLED', 'I2C interface', 'Compact embedded display'], 'from-[#dff4ec] to-[#79c7a8]', '/media/products/oled-display-09.jpg'),
  quoteInventory('lipo-battery-pack', 'LiPo Battery Pack', 'Power & Charging', 'GEN-PWR-0003', 'Lightweight mobile power', 'A rechargeable LiPo pack for mobile robotics and drone-related projects.', ['LiPo battery pack', 'Lightweight energy storage', 'Use with compatible charger and BMS'], 'from-[#ffe3d6] to-[#f1a17e]', '/media/products/lipo-battery-pack.jpg'),
  quoteInventory('dc-dc-converter', 'DC-DC Converter', 'Power & Charging', 'GEN-PWR-0004', 'Stable project voltage', 'A voltage converter for powering controllers, sensors, displays, and motor systems safely.', ['DC-DC converter', 'Input/output voltage regulation', 'Project power integration'], 'from-[#fff1cf] to-[#f1c875]', '/media/products/dc-dc-converter.jpg'),
  quoteInventory('battery-bms', 'Battery Management System', 'Power & Charging', 'GEN-PWR-0005', 'Protected rechargeable packs', 'A BMS module for monitoring and protecting compatible rechargeable battery packs.', ['Battery protection board', 'Charge and discharge protection', 'Pack integration support'], 'from-[#fff1cf] to-[#f1c875]', '/media/products/battery-bms.jpg'),
  quoteInventory('omni-wheel-set', 'Omni Wheel Set', 'Mechanical Parts', 'GEN-MEC-0003', 'Omnidirectional motion', 'Omni wheels for advanced mobile robot bases and maneuverability experiments.', ['Omni wheels', 'Multi-direction rollers', 'Robot chassis compatible'], 'from-[#e9e0ff] to-[#b79be9]', '/media/products/omni-wheel-set.jpg'),
  quoteInventory('caster-wheel', 'Robot Caster Wheel', 'Mechanical Parts', 'GEN-MEC-0004', 'Stable third-point support', 'A caster for two-wheel robot platforms and balanced mobile chassis.', ['Caster wheel', 'Mounting plate', 'Mobile chassis support'], 'from-[#e9e0ff] to-[#b79be9]', '/media/products/caster-wheel.jpg'),
  quoteInventory('breadboard-jumper-set', 'Breadboard & Jumper Wire Set', 'Connectors & Cables', 'GEN-CON-0002', 'Prototype without soldering', 'A breadboard and jumper set for classroom circuits, sensor experiments, and quick tests.', ['Solderless breadboard', 'Male and female jumper wires', 'Prototype-ready layout'], 'from-[#dff4ec] to-[#79c7a8]', '/media/products/breadboard-jumper-set.jpg'),
  quoteInventory('xt60-power-connectors', 'XT60 Power Connectors', 'Connectors & Cables', 'GEN-CON-0003', 'Secure battery connection', 'High-current connectors for battery-powered robotics and drone projects.', ['XT60 connector pair', 'High-current power connection', 'Polarity-aware assembly'], 'from-[#ffe3d6] to-[#f1a17e]', '/media/products/xt60-power-connectors.jpg'),
  quoteInventory('multimeter', 'Digital Multimeter', 'Tools & Fabrication', 'GEN-TOL-0002', 'Measure before debugging', 'A practical multimeter for voltage, continuity, resistance, and safe electronics troubleshooting.', ['Digital multimeter', 'Voltage and continuity modes', 'Test leads'], 'from-[#fff1cf] to-[#f1c875]', '/media/products/multimeter.jpg'),
  quoteInventory('abs-filament', 'ABS Maker Filament · 1 kg', '3D Printing Materials', 'GEN-3DP-0004', 'Durable printed parts', 'ABS filament for stronger functional prototypes and workshop parts where suitable ventilation is available.', ['1.75 mm diameter', '1 kg spool', 'Higher-temperature printing material'], 'from-[#dce8ff] to-[#7e9ff2]', '/media/products/abs-filament.jpg'),
]

const robotCarImages = [
  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
]

const robotCarProducts: Product[] = [
  { ...standard, id: 'arduino-multimode-robot-car', name: 'Arduino Multimode Robot Car', category: 'Robot Cars', price: 0, priceLabel: 'Request quote', sku: 'GEN-CAR-0001', productType: 'Retail kit', note: 'Bluetooth, obstacle avoidance, and path-learning platform', description: 'The canonical Arduino Uno robot car from the modular source projects, consolidated from the near-duplicate final, final2, final3, and base versions.', specs: ['Arduino Uno', 'HC-06 Bluetooth module', 'L298N motor driver', '4 BO motors', '3 HC-SR04 ultrasonic sensors', 'Buzzer and mode switch', 'Bluetooth manual control and obstacle avoidance'], stock: 0, delivery: 'Kit contents and lead time confirmed with quotation', color: 'from-[#dce8ff] to-[#7e9ff2]', badge: 'Canonical build', image: robotCarImages[0] },
  { ...standard, id: 'esp32-bluetooth-robot-car', name: 'ESP32 Bluetooth Robot Car', category: 'Robot Cars', price: 0, priceLabel: 'Request quote', sku: 'GEN-CAR-0002', productType: 'Retail kit', note: 'Simple phone-controlled teaching car', description: 'A distinct ESP32 Bluetooth car for MIT App Inventor teaching, manual driving, OLED status, and failsafe stopping.', specs: ['ESP32', 'L298N motor driver', 'DC motors, chassis, and wheels', '1.3-inch SH1106 OLED', 'Battery pack', 'Manual stop switch', 'Phone Bluetooth control'], stock: 0, delivery: 'Kit contents and lead time confirmed with quotation', color: 'from-[#dff4ec] to-[#79c7a8]', badge: 'Teaching build', image: robotCarImages[1] },
  { ...standard, id: 'esp32-wifi-web-robot-car', name: 'ESP32 Wi-Fi Web Robot Car', category: 'Robot Cars', price: 0, priceLabel: 'Request quote', sku: 'GEN-CAR-0003', productType: 'Retail kit', note: 'Browser and WebSocket control', description: 'A separate ESP32 Wi-Fi robot car for browser dashboards, WebServer control, WebSocket commands, and OLED telemetry.', specs: ['ESP32', 'L298N motor driver', 'DC motor and chassis assembly', 'OLED display', 'Wi-Fi WebServer and WebSocket control', 'Browser control interface'], stock: 0, delivery: 'Kit contents and lead time confirmed with quotation', color: 'from-[#f1e9ff] to-[#c4a8ef]', badge: 'Web control build', image: robotCarImages[2] },
]

type ExcelProject = [string, string, string, string, string, string, string, string]
const excelProjects: ExcelProject[] = [
  ['Solar Tracking System', 'Pre-packaged Kits', 'Autonomous / IoT', 'Autonomous: dual-axis tracking; IoT: dashboard monitoring', 'ESP32, LDR sensors (x4), servo motors (x2), solar panel, frame, battery', '4 LDR', 'Maximize solar efficiency', '4000 / 30'],
  ['Smart Irrigation System', 'Pre-packaged Kits', 'Autonomous / IoT / Manual', 'Autonomous: soil moisture-based watering; IoT: remote control; Manual: override via app', 'ESP32, soil moisture sensors (x2), water pump, relay, tubing, battery, mobile app', '2 soil moisture', 'Water conservation in agriculture', '4500 / 34'],
  ['Mini Wind Turbine Monitor', 'Sensors & Modules', 'Autonomous / IoT', 'Autonomous: RPM sensing; IoT: data logging', 'Mini wind turbine, RPM sensor, ESP32, battery, WiFi module', '1 RPM sensor', 'Renewable energy education', '5000 / 38'],
  ['Smart Lighting System', 'Controllers & Boards', 'Manual / Voice / IoT', 'Manual: switch; Voice: assistant control; IoT: app-based control', 'ESP32, relay module, PIR sensor, LDR, smart assistant integration', '1 PIR, 1 LDR', 'Home automation', '3000 / 23'],
  ['Home Security System', 'Sensors & Modules', 'Autonomous / IoT / Alert', 'Autonomous: motion detection; IoT: remote monitoring; Alert: SMS/email', 'ESP32-CAM, PIR sensors (x2), GSM module, buzzer, battery', '2 PIR, 1 camera', 'Home safety and surveillance', '5500 / 42'],
  ['Smart Door Lock', 'Pre-packaged Kits', 'Manual / App / Biometric', 'Manual: keypad; App: mobile unlock; Biometric: fingerprint sensor', 'ESP32, fingerprint sensor, keypad, servo motor, relay, battery', '1 fingerprint', 'Smart home entry system', '6000 / 46'],
  ['Face Recognition Attendance System', 'Controllers & Boards', 'Autonomous / Camera / IoT', 'Autonomous: face detection; Camera: ESP32-CAM; IoT: attendance logging', 'ESP32-CAM, SD card, WiFi module, battery', '1 camera', 'School/office attendance', '7000 / 54'],
  ['Object Detection Robot Arm', 'Pre-packaged Kits', 'Autonomous / Camera / Manual', 'Autonomous: ML-based detection; Camera: vision input; Manual: joystick control', 'ESP32-CAM, robotic arm kit, servos, camera, ML model', '1 camera, 1 color sensor', 'AI robotics education', '6500 / 50'],
  ['AI-Powered Sorting Machine', 'Pre-packaged Kits', 'Autonomous / Camera / IoT', 'Autonomous: object classification; Camera: vision input; IoT: data logging', 'ESP32-CAM, color sensor, servo motors, conveyor belt, WiFi module', '1 camera, 1 color sensor', 'Smart manufacturing demo', '12000 / 92'],
  ['Quadcopter DIY Kit', 'Pre-packaged Kits', 'Manual / Remote / Autonomous', 'Manual: joystick; Remote: app; Autonomous: GPS path', 'Brushless motors, ESCs, flight controller, GPS, frame, battery, transmitter', '1 GPS, 1 gyro', 'Drone education and demos', '14000 / 107'],
  ['Autonomous Drone Navigation', 'Pre-packaged Kits', 'Autonomous / GPS / Obstacle Avoidance', 'Autonomous: pre-set route; GPS: location tracking; Obstacle: ultrasonic sensors', 'Drone kit, GPS module, ultrasonic sensors, flight controller', '1 GPS, 2 ultrasonic', 'Autonomous flight projects', '18000 / 138'],
  ['Agricultural Drone', 'Pre-packaged Kits', 'Remote / Autonomous / IoT', 'Remote: app control; Autonomous: GPS path; IoT: data logging', 'Drone frame, GPS, sprayer, ESP32, battery, sensors', '1 GPS, 1 flow sensor', 'Smart farming', '18000 / 138'],
  ['Electronics Learning Board', 'Tools & Fabrication', 'Manual / Interactive', 'Manual: switch-based; Interactive: sensor-based experiments', 'Breadboard, LEDs, resistors, sensors, Arduino, jumper wires', 'Varies (IR, LDR, temp)', 'STEM education', '3500 / 26'],
  ['Mini Weather Station', 'Sensors & Modules', 'Autonomous / IoT', 'Autonomous: sensor logging; IoT: online dashboard', 'ESP32, DHT11, BMP180, rain sensor, WiFi module', '1 temp/humidity, 1 pressure, 1 rain', 'Weather education', '3500 / 26'],
  ['DIY Oscilloscope', 'Tools & Fabrication', 'Manual / Visual', 'Manual: probe signals; Visual: waveform display', 'Arduino UNO, resistors, capacitors, OLED display, probes', 'Analog input', 'Electronics lab tool', '3500 / 26'],
  ['Smart Traffic Management', 'Controllers & Boards', 'IoT / Remote / Autonomous', 'Autonomous: sensor-based traffic control; IoT: cloud dashboard', 'ESP32, IR sensors (x4), relays, cloud dashboard', '4 IR', 'Reduce congestion, improve safety', '3500 / 26'],
  ['Smart Waste Bin', 'Sensors & Modules', 'IoT / Autonomous', 'Autonomous: fill detection; IoT: cloud monitoring; Alert: GSM/WiFi notifications', 'ESP32, ultrasonic sensor, GSM/WiFi module, battery', '1 ultrasonic', 'Smart waste management', '3500 / 26'],
  ['Smart Parking System', 'Sensors & Modules', 'IoT / Remote / Autonomous', 'IoT: app-based info; Remote: user app; Autonomous: sensor detection', 'ESP32, IR sensors (x2), ultrasonic sensors (x2), mobile app', '2 IR, 2 ultrasonic', 'Reduce parking search time', '3500 / 26'],
  ['Air Quality Monitoring', 'Sensors & Modules', 'IoT / Autonomous', 'IoT: cloud dashboard; Autonomous: continuous monitoring', 'ESP32, MQ135, MQ7, DHT11, WiFi module', '3 gas sensors', 'Urban pollution tracking', '3500 / 26'],
  ['Smart Street Lighting', 'Controllers & Boards', 'Autonomous / IoT', 'Autonomous: motion/LDR control; IoT: remote monitoring', 'ESP32, LDR, PIR sensors (x2), relay module', '1 LDR, 2 PIR', 'Sustainable city lighting', '3500 / 26'],
]

const projectProducts: Product[] = excelProjects.map(([name, category, modes, explanation, components, sensors, useCase, cost], index) => {
  const [npr] = cost.split(' / ')
  return {
    id: `excel-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    category,
    price: Number(npr),
    priceLabel: `From NPR ${Number(npr).toLocaleString('en-IN')} · quote by scope`,
    sku: `GEN-XLS-${String(index + 1).padStart(4, '0')}`,
    productType: 'Project package',
    note: `${modes} · Excel project catalog`,
    description: `${useCase}. This scoped project package follows the components and operating modes listed in the Excel catalog.`,
    specs: [`Modes: ${modes}`, `How it works: ${explanation}`, `Components: ${components}`, `Sensors: ${sensors}`, `Best use: ${useCase}`],
    audience: 'Schools, institutions, student teams, and technical workshops',
    difficulty: 'Advanced',
    warranty: 'Scope, hardware, testing, and support terms confirmed in proposal',
    stock: 0,
    delivery: 'Discovery required · quote by scope',
    color: index % 2 === 0 ? 'from-[#dce8ff] to-[#7e9ff2]' : 'from-[#dff4ec] to-[#79c7a8]',
    badge: 'Excel catalog',
  }
})

const quotationCategory: Record<string, string> = {
  'Air Quality': 'Sensors & Modules',
  'Arduino Boards': 'Controllers & Boards',
  Battery: 'Power & Charging',
  Breadboard: 'Connectors & Cables',
  Camera: 'Sensors & Modules',
  'Charge Controller': 'Power & Charging',
  'Charging Modules': 'Power & Charging',
  'Connecting Cables': 'Connectors & Cables',
  'DC to DC Converter': 'Power & Charging',
  Display: 'Displays & Interfaces',
  Encoder: 'Sensors & Modules',
  'Encoder Wheel': 'Mechanical Parts',
  ESC: 'Motors & Motion',
  'ESP Boards': 'Controllers & Boards',
  'Flight Controller': 'Controllers & Boards',
  Frame: 'Mechanical Parts',
  Gimbal: 'Mechanical Parts',
  GPS: 'Sensors & Modules',
  'GSM Module': 'Communication Modules',
  'Header Pins': 'Connectors & Cables',
  'Heat Shrink': 'Connectors & Cables',
  IMU: 'Sensors & Modules',
  'Linear Actuator': 'Motors & Motion',
  'LoRa Module': 'Communication Modules',
  MCU: 'Controllers & Boards',
  'Motor Driver': 'Motors & Motion',
  Motors: 'Motors & Motion',
  Multimeter: 'Tools & Fabrication',
  'Nuts and Bolts': 'Mechanical Parts',
  'PCB Service': 'Tools & Fabrication',
  PDB: 'Power & Charging',
  'pH Sensor': 'Sensors & Modules',
  'PID Controller': 'Controllers & Boards',
  'PID Tuning Kit': 'Tools & Fabrication',
  'Power Bank': 'Power & Charging',
  Propellers: 'Mechanical Parts',
  'Rain Sensor': 'Sensors & Modules',
  'Relay Module': 'Sensors & Modules',
  RTC: 'Sensors & Modules',
  SBC: 'Controllers & Boards',
  'SBC Accessory': 'Sensors & Modules',
  'SD Module': 'Sensors & Modules',
  'Smart Switch': 'Controllers & Boards',
  'Soil Sensor': 'Sensors & Modules',
  'Solar Panel': 'Power & Charging',
  'Soldering Kit': 'Tools & Fabrication',
  'Solenoid Valve': 'Motors & Motion',
  SSR: 'Sensors & Modules',
  'Stepper Driver': 'Motors & Motion',
  'TDS Sensor': 'Sensors & Modules',
  'Voltage Sensor': 'Sensors & Modules',
  'Water Pump': 'Motors & Motion',
  Wheels: 'Mechanical Parts',
}

const existingQuotationVariants = new Set(['Arduino Uno R3', 'Arduino Mega 2560', 'Arduino Nano', 'Li-ion 18650 Pack 3.7V x N', 'Full-size Solderless Breadboard', 'ESP8266 NodeMCU', 'ESP32 WROOM', 'L298N Dual H-Bridge', 'Micro Servo SG90', 'Digital Multimeter 600V/10A', 'Raspberry Pi 4 4GB', '60W Soldering Iron + Accessories', 'Rubber Robot Wheel 65mm'])

const quotationImages: Record<string, string> = {
  'Air Quality': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Arduino Boards': 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  Battery: 'https://images.unsplash.com/photo-1620283085439-39620a128440?auto=format&fit=crop&w=600&q=80',
  Breadboard: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  Camera: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  'Charge Controller': 'https://images.unsplash.com/photo-1616763355548-1b606f439f86?auto=format&fit=crop&w=600&q=80',
  'Charging Modules': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Connecting Cables': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80',
  'DC to DC Converter': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  Display: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  Encoder: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=600&q=80',
  'Encoder Wheel': 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=600&q=80',
  ESC: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=600&q=80',
  'ESP Boards': 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  'Flight Controller': 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=600&q=80',
  Frame: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=600&q=80',
  Gimbal: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=600&q=80',
  GPS: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  'GSM Module': 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  'Header Pins': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Heat Shrink': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80',
  IMU: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=600&q=80',
  'Linear Actuator': 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
  'LoRa Module': 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  MCU: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  'Motor Driver': 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  Motors: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
  Multimeter: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=600&q=80',
  'Nuts and Bolts': 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
  'PCB Service': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  PDB: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'pH Sensor': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'PID Controller': 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  'PID Tuning Kit': 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=600&q=80',
  'Power Bank': 'https://images.unsplash.com/photo-1620283085439-39620a128440?auto=format&fit=crop&w=600&q=80',
  Propellers: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=600&q=80',
  'Rain Sensor': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Relay Module': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  RTC: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  SBC: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  'SBC Accessory': 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  'SD Module': 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  'Smart Switch': 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  'Soil Sensor': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Solar Panel': 'https://images.unsplash.com/photo-1616763355548-1b606f439f86?auto=format&fit=crop&w=600&q=80',
  'Soldering Kit': 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=600&q=80',
  'Solenoid Valve': 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
  SSR: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Stepper Driver': 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
  'TDS Sensor': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Voltage Sensor': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'Water Pump': 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
  Wheels: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
}

const quotationProducts: Product[] = quotationItems.filter(([, variant]) => !existingQuotationVariants.has(variant)).map(([type, variant, description, supplier], index) => ({
  ...standard,
  id: `quote-${variant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name: variant,
  category: quotationCategory[type] || 'Tools & Fabrication',
  price: 0,
  priceLabel: 'Request quote',
  sku: `GEN-QT-${String(index + 1).padStart(4, '0')}`,
  productType: 'Retail kit',
  note: `${type} · quotation inventory`,
  description,
  specs: [`Inventory type: ${type}`, 'Pricing and availability confirmed by quotation'],
  stock: 0,
  delivery: 'Availability and lead time confirmed with quotation',
  color: index % 2 === 0 ? 'from-[#dce8ff] to-[#7e9ff2]' : 'from-[#dff4ec] to-[#79c7a8]',
  badge: 'Quotation inventory',
  supplier,
  image: quotationImages[type] || 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80',
}))

export const products: Product[] = [...inventoryProducts, ...additionalInventoryProducts, ...quotationProducts, ...robotCarProducts, ...projectProducts]
export const formatNPR = (value: number) => `NPR ${value.toLocaleString('en-IN')}`
export const findProduct = (slug: string) => products.find((product) => product.id === slug)
