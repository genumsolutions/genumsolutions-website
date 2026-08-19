export type Project = {
  slug: string
  title: string
  type: string
  summary: string
  tags: string[]
  accent: string
}

export const projects: Project[] = [
  { slug: 'esp32-iot-hub', title: 'Website-Controlled ESP32 Car', type: 'IoT systems', summary: 'Dual-mode ESP32 robot car with a browser dashboard, WiFi control, speed commands, and a failsafe stop.', tags: ['ESP32', 'WiFi', 'Web UI'], accent: 'bg-cobalt' },
  { slug: 'home-automation', title: 'Home Automation System', type: 'Smart automation', summary: 'A connected home control system with voice integration, schedules, mobile control, and energy monitoring.', tags: ['Arduino', 'Mobile app', 'Voice control'], accent: 'bg-signal' },
  { slug: 'wireless-sensor-network', title: 'Wireless Sensor Network', type: 'IoT systems', summary: 'A multi-node environmental monitoring network using mesh communication and fault-tolerant sensor reporting.', tags: ['RF communication', 'Mesh network', 'Sensors'], accent: 'bg-[#a9d9c6]' },
  { slug: 'smart-street-lighting', title: 'Smart Street Lighting', type: 'Urban infrastructure', summary: 'Adaptive LED lighting with motion detection, ambient sensing, remote monitoring, and maintenance alerts.', tags: ['LED control', 'Energy efficient', 'IoT'], accent: 'bg-[#f1a17e]' },
  { slug: 'rfid-tracking', title: 'RFID Tracking System', type: 'Transportation technology', summary: 'A centralized RFID tracking and fare-management system with encrypted validation and auditable reporting.', tags: ['RFID', 'Inventory', 'Tracking'], accent: 'bg-[#b79be9]' },
  { slug: 'telecom-infrastructure', title: 'Telecom Infrastructure', type: 'Telecom engineering', summary: 'Telecom network design, deployment, site work, and signal optimization for reliable connectivity.', tags: ['Network deployment', 'Optimization', 'Project management'], accent: 'bg-[#9fbaff]' },
  { slug: 'smart-agriculture', title: 'Smart Agriculture Platform', type: 'Precision farming', summary: 'Soil monitoring, automated irrigation, and machine-learning assisted yield and disease insights.', tags: ['Agriculture', 'Sensors', 'Machine learning'], accent: 'bg-[#79c7a8]' },
  { slug: 'intelligent-parking', title: 'Intelligent Parking System', type: 'Urban mobility', summary: 'Automated parking management with RFID access, license plate recognition, availability, and pricing logic.', tags: ['RFID', 'Computer vision', 'Automation'], accent: 'bg-[#f1c875]' },
]

export const caseStudies = [
  { title: 'RFID-Based Vehicle Fare Management System', meta: 'Transportation · 6 months · 3-person team', description: 'A centralized public transport fare system with contactless RFID payment processing, encrypted transaction validation, multi-modal integration, and audit trails.', results: ['50,000+ daily transactions', '99.9% uptime', '60% faster fare collection', 'Real-time revenue reporting'] },
  { title: 'Smart Street Light Control Network', meta: 'Urban infrastructure · 4 months · 500+ units', description: 'An intelligent lighting network using motion sensors and ambient light detection for adaptive illumination, remote monitoring, predictive maintenance, and energy analytics.', results: ['70% reduction in energy consumption', 'Autonomous maintenance scheduling', 'Real-time fault detection', 'ROI achieved in 2.5 years'] },
  { title: 'IoT-Based Weather Monitoring Network', meta: 'Environmental · 8 months · 50-node network', description: 'A sensor network for agricultural and industrial applications with real-time transmission, cloud analytics, automated alerts, and historical trend analysis.', results: ['95% reported prediction accuracy', 'Sub-minute data transmission', '30% reported crop-yield improvement', 'Early warning for severe weather'] },
]

export const technologies = {
  platforms: ['ESP32', 'Arduino', 'STM32', 'ARM Cortex', 'Raspberry Pi'],
  protocols: ['WiFi', 'Bluetooth', 'LoRaWAN', 'MQTT', 'CoAP', 'Zigbee'],
  cloud: ['AWS IoT', 'Azure', 'Google Cloud', 'Firebase', 'InfluxDB'],
  languages: ['C++', 'Python', 'JavaScript', 'Java', 'Embedded C'],
}
