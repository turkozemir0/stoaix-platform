import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

function getServiceClient() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getOrgCalendar(userId: string) {
  const service = getServiceClient()
  const { data: orgUser } = await service
    .from('org_users').select('organization_id').eq('user_id', userId).maybeSingle()
  if (!orgUser) return null
  const { data: org } = await service
    .from('organizations').select('channel_config').eq('id', orgUser.organization_id).single()
  return { orgId: orgUser.organization_id, cal: (org?.channel_config as any)?.calendar }
}

async function refreshToken(orgId: string, cal: any): Promise<string | null> {
  if (!cal?.refresh_token) return null
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: cal.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const newExpiry = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : undefined

  const service = getServiceClient()
  const { data: org } = await service
    .from('organizations').select('channel_config').eq('id', orgId).single()
  const cc = (org?.channel_config ?? {}) as Record<string, unknown>
  await service.from('organizations').update({
    channel_config: {
      ...cc,
      calendar: { ...cal, access_token: data.access_token, ...(newExpiry ? { token_expiry: newExpiry } : {}) },
    },
  }).eq('id', orgId)

  return data.access_token
}

async function getValidToken(orgId: string, cal: any): Promise<string | null> {
  if (!cal?.access_token) return null
  if (cal.token_expiry && new Date(cal.token_expiry) <= new Date(Date.now() + 60_000)) {
    return refreshToken(orgId, cal)
  }
  return cal.access_token
}

// GET — upcoming events (provider-agnostic)
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getOrgCalendar(user.id)
  if (!result) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 404 })

  const { orgId, cal } = result
  const provider = cal?.provider ?? 'none'

  // No calendar configured
  if (provider === 'none' || !cal) {
    return NextResponse.json({ connected: false, provider: 'none', events: [] })
  }

  // Dentsoft — adapter not yet implemented
  if (provider === 'dentsoft') {
    return NextResponse.json({ connected: true, provider: 'dentsoft', events: [], dentsoft_pending: true })
  }

  // Google Calendar
  if (provider === 'google') {
    if (!cal?.access_token) return NextResponse.json({ connected: false, provider: 'google', events: [] })

    const token = await getValidToken(orgId, cal)
    if (!token) return NextResponse.json({ error: 'Token yenilenemedi' }, { status: 401 })

    const calId     = encodeURIComponent(cal.calendar_id || 'primary')
    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?` +
      new URLSearchParams({ timeMin: new Date().toISOString(), maxResults: '30', singleEvents: 'true', orderBy: 'startTime' }),
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!eventsRes.ok) return NextResponse.json({ error: await eventsRes.text() }, { status: eventsRes.status })
    const data = await eventsRes.json()
    return NextResponse.json({ connected: true, provider: 'google', events: data.items ?? [] })
  }

  // Legacy: no calendar.provider but old config pattern
  if (!cal?.access_token) return NextResponse.json({ connected: false, provider: 'google', events: [] })
  const token = await getValidToken(orgId, cal)
  if (!token) return NextResponse.json({ error: 'Token yenilenemedi' }, { status: 401 })

  const calId     = encodeURIComponent(cal.calendar_id || 'primary')
  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?` +
    new URLSearchParams({ timeMin: new Date().toISOString(), maxResults: '30', singleEvents: 'true', orderBy: 'startTime' }),
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!eventsRes.ok) return NextResponse.json({ error: await eventsRes.text() }, { status: eventsRes.status })
  const data = await eventsRes.json()
  return NextResponse.json({ connected: true, provider: 'google', events: data.items ?? [] })
}

// POST — create event (Google Calendar only — Dentsoft pending)
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getOrgCalendar(user.id)
  if (!result) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 404 })

  const { orgId, cal } = result
  const provider = cal?.provider ?? 'none'

  if (provider === 'dentsoft') {
    return NextResponse.json({ error: 'Dentsoft takvim entegrasyonu yakında aktif olacak' }, { status: 400 })
  }

  if (!cal?.access_token) return NextResponse.json({ error: 'Takvim bağlı değil' }, { status: 400 })

  const token = await getValidToken(orgId, cal)
  if (!token) return NextResponse.json({ error: 'Token yenilenemedi' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }) }
  const { title, startDateTime, endDateTime, description, attendeeEmail } = body
  if (!title || !startDateTime || !endDateTime)
    return NextResponse.json({ error: 'title, startDateTime, endDateTime zorunlu' }, { status: 400 })

  const event: any = {
    summary: title,
    start: { dateTime: startDateTime, timeZone: 'Europe/Istanbul' },
    end:   { dateTime: endDateTime,   timeZone: 'Europe/Istanbul' },
  }
  if (description)   event.description = description
  if (attendeeEmail) event.attendees   = [{ email: attendeeEmail }]

  const calId = encodeURIComponent(cal.calendar_id || 'primary')
  const createRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  )

  if (!createRes.ok) return NextResponse.json({ error: await createRes.text() }, { status: createRes.status })
  return NextResponse.json(await createRes.json())
}
