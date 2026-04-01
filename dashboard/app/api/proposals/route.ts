import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/proposals — Yeni teklif oluştur
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await supabase
    .from('org_users')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: superAdmin } = await supabase
    .from('super_admin_users')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!orgUser && !superAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allowedRoles = ['admin', 'yönetici', 'satisci']
  if (orgUser && !superAdmin && !allowedRoles.includes(orgUser.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  const body = await request.json()
  const { lead_id, title, description, total_amount, currency, status, notes, payments } = body

  if (!lead_id || !title) {
    return NextResponse.json({ error: 'lead_id ve title zorunlu' }, { status: 400 })
  }

  const orgId = orgUser?.organization_id

  // Verify lead belongs to org
  if (orgId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('organization_id')
      .eq('id', lead_id)
      .maybeSingle()

    if (!lead || lead.organization_id !== orgId) {
      return NextResponse.json({ error: 'Lead bulunamadı' }, { status: 404 })
    }
  }

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      organization_id: orgId,
      lead_id,
      created_by: user.id,
      title: title.trim(),
      description: description || null,
      total_amount: parseFloat(total_amount) || 0,
      currency: currency || 'TRY',
      status: status || 'draft',
      notes: notes || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert payment schedules if provided
  if (payments?.length && proposal?.id) {
    const paymentRows = payments.map((p: any) => ({
      organization_id: orgId,
      proposal_id: proposal.id,
      amount: parseFloat(p.amount),
      due_date: p.due_date,
      notes: p.notes || null,
    }))
    await supabase.from('payment_schedules').insert(paymentRows)
  }

  return NextResponse.json({ ok: true, id: proposal.id }, { status: 201 })
}
