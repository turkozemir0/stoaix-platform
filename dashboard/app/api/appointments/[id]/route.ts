import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  const service = createServiceClient()
  const { data, error } = await service
    .from('appointments')
    .update(updates)
    .eq('id', params.id)
    .eq('organization_id', orgUser.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })

  return NextResponse.json(data)
  // Note: pg_net trigger on appointments.status UPDATE automatically fires
  // appointment_noshow or post_appointment workflow events
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

  const service = createServiceClient()
  const { data, error } = await service
    .from('appointments')
    .select('*, contacts(full_name, phone)')
    .eq('id', params.id)
    .eq('organization_id', orgUser.organization_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })
  return NextResponse.json(data)
}
