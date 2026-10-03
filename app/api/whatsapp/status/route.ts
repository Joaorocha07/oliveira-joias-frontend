import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/whatsapp/status`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { slots: [
        { status: 'disconnected', qrBase64: null, phone: null },
        { status: 'disconnected', qrBase64: null, phone: null },
      ]},
    )
  }
}
