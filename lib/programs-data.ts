// =====================================================================
// programs-data.ts - bundled training-programs / pilot-costs /
// curriculum-highlights data used as the offline fallback (and seed
// source) when Supabase is unreachable or not configured. The
// authoritative lists live in the DB tables seeded from this file.
// =====================================================================

export type TrainingProgram = {
  title: string
  audience: string
  description: string
  duration: string
  outcome: string
}

export type TrainingProgramRow = TrainingProgram & { id: string; sortOrder: number }

export type PilotCostRow = { id: string; item: string; cost: string; note: string; sortOrder: number }

export type CurriculumHighlightRow = { id: string; ageBand: string; items: string[]; sortOrder: number }

export const localTrainingPrograms: TrainingProgramRow[] = [
  { id: 'k5-robotics-foundations', title: 'K–5 Robotics Foundations', audience: 'Elementary schools · 3-classroom pilot', description: 'ESP32 starter kits, grade-mapped lessons, teacher training, coaching, and a pilot report for 30 student kits.', duration: '13-week pilot + months 4–12 support', outcome: '30 kits · 36 curriculum units · measurable pilot report', sortOrder: 1 },
  { id: 'stem-master-package', title: 'STEM Master Package', audience: 'Schools, NGOs, workshops, and private clients', description: 'A reusable package combining the 100+ project catalog, curriculum guide, robotics manuals, six-stream activities, presentation material, and implementation notes.', duration: 'Digital delivery or workshop deployment', outcome: 'Age-banded projects · teacher notes · demos · assessment prompts', sortOrder: 2 },
  { id: 'esp32-robotics-lab', title: 'ESP32 Robotics Lab', audience: 'Clubs, makerspaces, and secondary learners', description: 'Build and test modular robot cars across Bluetooth, Wi-Fi, OLED, path following, and obstacle avoidance modes.', duration: 'Half-day to multi-session lab', outcome: 'Working build · firmware workflow · safety and troubleshooting practice', sortOrder: 3 },
  { id: 'teacher-enablement-workshop', title: 'Teacher Enablement Workshop', audience: 'Up to 6 teachers per workshop', description: 'Assembly, classroom management, lesson delivery, assessment, and practical troubleshooting using the GENUM kit system.', duration: 'One full day + two virtual coaching sessions', outcome: 'Teacher confidence target ≥ 4/5 · first lesson delivered', sortOrder: 4 },
]

export const localPilotCosts: PilotCostRow[] = [
  { id: '30-classroom-kits', item: '30 classroom kits', cost: 'NPR 3,60,000', note: '10 kits per classroom × 3 classrooms at the illustrative bulk rate', sortOrder: 1 },
  { id: 'storage-and-charging', item: 'Storage and charging', cost: 'NPR 40,000', note: 'Caddies, charging or USB hub, and spare-parts handling', sortOrder: 2 },
  { id: 'shipping-and-handling', item: 'Shipping and handling', cost: 'NPR 26,000', note: 'Valley delivery included; nationwide courier confirmed by destination', sortOrder: 3 },
  { id: 'on-site-teacher-workshop', item: 'On-site teacher workshop', cost: 'NPR 1,60,000', note: 'One full-day session for up to 6 teachers', sortOrder: 4 },
  { id: 'virtual-coaching', item: 'Virtual coaching', cost: 'NPR 54,000', note: 'Two 90-minute sessions in months 1 and 3', sortOrder: 5 },
  { id: 'curriculum-subscription', item: 'Curriculum subscription', cost: 'NPR 72,000', note: '12 months × 3 classrooms × NPR 2,000 per classroom/month', sortOrder: 6 },
  { id: 'dashboard-and-secure-relay', item: 'Dashboard and secure relay setup', cost: 'NPR 48,000', note: 'One-time setup for lesson distribution and oversight', sortOrder: 7 },
  { id: 'pilot-support-and-report', item: 'Pilot support and report', cost: 'NPR 80,000', note: 'Coordination, data collection, feedback, and recommendations', sortOrder: 8 },
]

export const localCurriculumHighlights: CurriculumHighlightRow[] = [
  { id: 'ages-5-7', ageBand: 'Ages 5–7', items: ['Baking soda volcano', 'Rainbow walking water', 'Balloon rocket', 'Paper helicopter'], sortOrder: 1 },
  { id: 'ages-8-10', ageBand: 'Ages 8–10', items: ['Lemon battery', 'Paper circuit card', 'Bristlebot', 'Scratch maze game'], sortOrder: 2 },
  { id: 'ages-11-12', ageBand: 'Ages 11–12', items: ['Light-following robot', 'Soil moisture alarm', 'Line-following robot', 'Weather station'], sortOrder: 3 },
]
