import { NextResponse } from 'next/server'
import { getManagedProducts } from '../../../lib/content-store'

export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json(await getManagedProducts()) }
