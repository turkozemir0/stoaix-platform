import { NextRequest, NextResponse } from 'next/server'
import { createClient as sbAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getValidToken } from '@/lib/calendar-token'

function getServiceClient() {
  return sbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// PATCH — Randevu durumu güncelle (attended, no_show, confirmed, cancelled, rescheduled)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await supabase
    .from('org_users')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!orgUser) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['admin', 'yönetici', 'satisci'].includes(orgUser.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { status, notes, scheduled_at } = body

  const VALID_STATUSES = ['scheduled', 'confirmed', 'attended', 'no_show', 'cancelled', 'rescheduled']
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({
      error: `status gerekli. Geçerli değerler: ${VALID_STATUSES.join(', ')}`,
    }, { status: 400 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, any> = { status, updated_at: now }

  if (status === 'attended')  updates.attended_at  = now
  if (status === 'no_show')   updates.no_show_at   = now
  if (status === 'confirmed') updates.confirmed_at = now
  if (notes !== undefined)    updates.notes        = notes
  if (scheduled_at)           updates.scheduled_at = scheduled_at

  const service = getServiceClient()
  const { data, error } = await service
    .from('appointments')
    .update(updates)
    .eq('id', params.id)
    .eq('organization_id', orgUser.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })

  // Sync to Google Calendar if appointment has an external_id and source != 'google'
  if (data.external_id && data.source !== 'google') {
    syncToGoogle(data, orgUser.organization_id, status, scheduled_at)
      .catch(err => console.warn('[calendar] Google sync failed:', err))
  }

  return NextResponse.json(data)
  // Note: pg_net trigger on appointments.status UPDATE automatically fires
  // appointment_noshow or post_appointment workflow events
}

// ── Google Calendar sync helper ────────────────────────────────────────────────

async function syncToGoogle(
  appointment: any,
  orgId: string,
  newStatus: string,
  newScheduledAt: string | undefined,
) {
  try {
    const service = getServiceClient()
    const { data: org } = await service
      .from('organizations')
      .select('channel_config')
      .eq('id', orgId)
      .single()

    const cal = (org?.channel_config as any)?.calendar
    if (!cal || cal.provider !== 'google' || !cal.access_token) return

    const token = await getValidToken(orgId, cal)
    if (!token) return

    const calId = encodeURIComponent(cal.calendar_id || 'primary')
    const eventId = appointment.external_id

    if (newStatus === 'cancelled') {
      // Delete the Google Calendar event
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      )
    } else if (newScheduledAt) {
      // Update the Google Calendar event time
      const parsed = new Date(newScheduledAt)
      const endAt  = new Date(parsed.getTime() + (appointment.duration_minutes ?? 60) * 60_000)
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
        {
          method:  'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: { dateTime: parsed.toISOString(), timeZone: 'Europe/Istanbul' },
            end:   { dateTime: endAt.toISOString(),   timeZone: 'Europe/Istanbul' },
          }),
        }
      )
    }
  } catch (err) {
    console.warn('[calendar] syncToGoogle error:', err)
  }
}

// GET — Tek randevu
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await supabase
    .from('org_users')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!orgUser) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const service = getServiceClient()
  const { data, error } = await service
    .from('appointments')
    .select('*, contacts(full_name, phone)')
    .eq('id', params.id)
    .eq('organization_id', orgUser.organization_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })
  return NextResponse.json(data)
}
