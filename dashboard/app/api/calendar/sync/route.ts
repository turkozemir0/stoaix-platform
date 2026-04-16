import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as sbAdmin } from '@supabase/supabase-js'
import { checkEntitlement } from '@/lib/entitlements'
import { getValidToken, getOrgCalendar, updateLastSynced } from '@/lib/calendar-token'

function getServiceClient() {
  return sbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST — Sync Google Calendar → appointments table
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getOrgCalendar(user.id)
  if (!result) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 404 })

  const { orgId, cal } = result

  const ent = await checkEntitlement(orgId, 'calendar_manage')
  if (!ent.enabled) return NextResponse.json({ error: 'upgrade_required', feature: 'calendar_manage' }, { status: 403 })

  if (cal?.provider !== 'google') {
    return NextResponse.json({ error: 'Google Takvim bağlı değil' }, { status: 400 })
  }

  const token = await getValidToken(orgId, cal)
  if (!token) return NextResponse.json({ error: 'Token yenilenemedi' }, { status: 401 })

  // Fetch last 60 days + next 90 days of events from Google Calendar
  const timeMin = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const calId = encodeURIComponent(cal.calendar_id || 'primary')

  const gcalRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?` +
    new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: '250',
      singleEvents: 'true',
      orderBy: 'startTime',
    }),
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!gcalRes.ok) {
    return NextResponse.json({ error: await gcalRes.text() }, { status: gcalRes.status })
  }

  const gcalData = await gcalRes.json()
  const items: any[] = gcalData.items ?? []

  const service = getServiceClient()
  let synced = 0
  let skipped = 0
  const errors: string[] = []

  for (const event of items) {
    try {
      // Skip cancelled events — handle as upsert with cancelled status
      const isCancelled = event.status === 'cancelled'

      const startRaw: string = event.start?.dateTime ?? event.start?.date
      if (!startRaw) { skipped++; continue }

      // Normalize to ISO datetime
      const scheduledAt = startRaw.includes('T')
        ? new Date(startRaw).toISOString()
        : new Date(`${startRaw}T09:00:00`).toISOString()

      const endRaw: string = event.end?.dateTime ?? event.end?.date
      let durationMinutes = 60
      if (endRaw) {
        const endDt  = new Date(endRaw.includes('T') ? endRaw : `${endRaw}T09:00:00`)
        const startDt = new Date(scheduledAt)
        durationMinutes = Math.max(15, Math.round((endDt.getTime() - startDt.getTime()) / 60_000))
      }

      // Extract lead_id from description if tagged
      const desc     = event.description ?? ''
      const leadMatch = desc.match(/\[stoaix:lead_id:([a-f0-9-]{36})\]/i)
      const leadId    = leadMatch ? leadMatch[1] : null

      // Extract appointment_id if we originally created this event
      const apptMatch = desc.match(/\[stoaix:appointment_id:([a-f0-9-]{36})\]/i)
      const existingApptId = apptMatch ? apptMatch[1] : null

      // Try to match contact by attendee email (best-effort)
      let contactId: string | null = null
      const attendees: any[] = event.attendees ?? []
      for (const att of attendees) {
        if (!att.email || att.self) continue
        const { data: contact } = await service
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .eq('email', att.email)
          .maybeSingle()
        if (contact) { contactId = contact.id; break }
      }

      const upsertPayload: Record<string, any> = {
        organization_id:  orgId,
        source:           'google',
        external_id:      event.id,
        title:            event.summary ?? null,
        notes:            desc.replace(/\[stoaix:[^\]]+\]/g, '').trim() || null,
        scheduled_at:     scheduledAt,
        duration_minutes: durationMinutes,
        appointment_type: 'consultation',
        status:           isCancelled ? 'cancelled' : 'confirmed',
        contact_id:       contactId,
        lead_id:          leadId,
      }

      if (existingApptId) {
        // Update the existing platform appointment with google external_id
        await service
          .from('appointments')
          .update({ external_id: event.id, updated_at: new Date().toISOString() })
          .eq('id', existingApptId)
          .eq('organization_id', orgId)
        synced++
        continue
      }

      // Upsert by (organization_id, source, external_id)
      const { error: upsertErr } = await service
        .from('appointments')
        .upsert(upsertPayload, {
          onConflict: 'organization_id,source,external_id',
          ignoreDuplicates: false,
        })

      if (upsertErr) {
        errors.push(`event ${event.id}: ${upsertErr.message}`)
      } else {
        synced++
      }
    } catch (err: any) {
      errors.push(`event ${event.id ?? '?'}: ${err.message}`)
    }
  }

  // Update last_synced_at in channel_config
  const lastSyncedAt = await updateLastSynced(orgId, cal)

  return NextResponse.json({ synced, skipped, errors, last_synced_at: lastSyncedAt })
}
