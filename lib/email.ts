const recipient = process.env.CONTACT_EMAIL || 'genumsolutions@gmail.com'
const sender = process.env.RESEND_FROM_EMAIL || 'GENUM website <onboarding@resend.dev>'

export async function sendEmail({ replyTo, subject, text }: { replyTo?: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender, to: [recipient], reply_to: replyTo, subject, text }),
  })

  if (!response.ok) throw new Error(`Email provider returned ${response.status}`)
}
