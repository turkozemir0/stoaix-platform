import { NextRequest, NextResponse } from 'next/server'
import { createClient as sbAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getServiceClient() {
  return sbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
// GET — Org'un randevuları
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await supabase
    .from('org_users')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!orgUser) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status    = searchParams.get('status')     // 'scheduled' | 'confirmed' | ...
  const contactId = searchParams.get('contact_id')
  const leadId    = searchParams.get('lead_id')
  const limit     = Math.min(Number(searchParams.get('limit') ?? '50'), 200)

  const service = getServiceClient()
  let query = service
    .from('appointments')
    .select('*, contacts(full_name, phone)')
    .eq('organization_id', orgUser.organization_id)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (status)    query = query.eq('status', status)
  if (contactId) query = query.eq('contact_id', contactId)
  if (leadId)    query = query.eq('lead_id', leadId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — Yeni randevu oluştur
export async function POST(request: NextRequest) {
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
  const { scheduled_at, contact_id, lead_id, conversation_id, duration_minutes, notes, metadata } = body

  if (!scheduled_at) {
    return NextResponse.json({ error: 'scheduled_at zorunlu' }, { status: 400 })
  }

  // Validate ISO date
  const parsed = new Date(scheduled_at)
  if (isNaN(parsed.getTime())) {
    return NextResponse.json({ error: 'scheduled_at geçersiz tarih formatı' }, { status: 400 })
  }

  const service = getServiceClient()
  const { data, error } = await service
    .from('appointments')
    .insert({
      organization_id: orgUser.organization_id,
      contact_id:      contact_id   ?? null,
      lead_id:         lead_id      ?? null,
      conversation_id: conversation_id ?? null,
      scheduled_at:    parsed.toISOString(),
      duration_minutes: Number(duration_minutes ?? 60),
      notes:            notes    ?? null,
      metadata:         metadata ?? {},
      status:           'scheduled',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
