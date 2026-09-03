// =====================================================================
// journal-data.ts - bundled journal posts used as the offline fallback
// (and seed source) when Supabase is unreachable or not configured.
// The authoritative list lives in the `journal_posts` table.
// =====================================================================
import type { JournalPost } from './journal'

export const localJournalPosts: JournalPost[] = [
  {
    id: 'esp32-beginner-project',
    tag: 'Tutorial · Robotics',
    title: 'Your first ESP32 project: a calmer way to begin',
    text: 'A practical starting point for wiring, flashing, and debugging without the mystery.',
  },
  {
    id: 'edge-ai-close-to-decision',
    tag: 'Field note · AI',
    title: 'Edge AI is useful when the decision needs to stay close',
    text: 'A grounded look at local inference, latency, privacy, and why not every sensor needs a cloud dashboard.',
  },
  {
    id: 'teaching-automation-nepal',
    tag: 'Learning · Nepal',
    title: 'How to teach automation without making promises it cannot keep',
    text: 'A human-centered workshop format built around critical thinking, testing, and responsible use.',
  },
]
