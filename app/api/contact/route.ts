import { NextResponse } from 'next/server'
import { sendEmail } from '../../../lib/email'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!name || !email || !message) return NextResponse.json({ error: 'Please complete all fields.' }, { status: 400 })
    if (name.length > 100 || email.length > 254 || message.length > 5000 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please check your details and try again.' }, { status: 400 })
    }

    await sendEmail({ replyTo: email, subject: `New website inquiry from ${name}`, text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}` })
    return NextResponse.json({ message: 'Thanks. Your inquiry has been sent.' })
  } catch (error) {
    console.error('Contact email failed', error)
    return NextResponse.json({ error: 'We could not send your inquiry right now. Please email us directly.' }, { status: 500 })
  }
}
