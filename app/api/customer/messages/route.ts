import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/supabase/server'
import { getMessages } from '../../../../lib/customer-store'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ messages: await getMessages(user.id) })
  } catch (error) {
    console.error('Customer messages failed', error)
    return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 })
  }
}
