import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

// 303 so the browser follows with a clean GET instead of rendering the JSON body.
export async function POST(request: NextRequest) {
  await createClient().auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), 303)
}
