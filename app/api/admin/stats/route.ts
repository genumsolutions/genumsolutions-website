import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { getDashboardStats } from '../../../../lib/analytics'

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Dashboard stats failed', error)
    return NextResponse.json({ error: 'Could not load dashboard stats.' }, { status: 500 })
  }
}
