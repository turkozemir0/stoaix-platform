import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import Papa from 'papaparse'
import { normalizePhone } from '@/lib/phone-utils'

function getServiceClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const MAX_ROWS = 500

// POST /api/import — CSV lead import (multipart/form-data)
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
  if (orgUser && !superAdmin && !['admin', 'yönetici'].includes(orgUser.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  const orgId = orgUser?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 400 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const phoneCol = (formData.get('phone_col') as string) || 'phone'
  const nameCol = (formData.get('name_col') as string) || 'name'
  const emailCol = (formData.get('email_col') as string) || 'email'
  const sourceCol = (formData.get('source_col') as string) || 'source'

  if (!file) return NextResponse.json({ error: 'CSV dosyası gerekli' }, { status: 400 })

  const csvText = await file.text()
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  if (parsed.errors.length > 0 && !parsed.data.length) {
    return NextResponse.json({ error: 'CSV parse hatası: ' + parsed.errors[0].message }, { status: 400 })
  }

  const rows = parsed.data as Record<string, string>[]
  const totalRows = Math.min(rows.length, MAX_ROWS)

  const service = getServiceClient()

  // Create import job
  const { data: job, error: jobErr } = await service
    .from('import_jobs')
    .insert({
      organization_id: orgId,
      created_by: user.id,
      status: 'processing',
      total_rows: totalRows,
      source_filename: file.name,
    })
    .select('id')
    .single()

  if (jobErr || !job) return NextResponse.json({ error: 'Job oluşturulamadı' }, { status: 500 })

  // Process in batches of 50
  let insertedCount = 0
  let duplicateCount = 0
  let errorCount = 0
  const errorDetails: Array<{ row: number; error: string }> = []

  const batchSize = 50
  for (let i = 0; i < totalRows; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j]
      const rowNum = i + j + 2 // 1-based + header
      try {
        const rawPhone = row[phoneCol] || ''
        const name = (row[nameCol] || '').trim()
        const email = (row[emailCol] || '').trim().toLowerCase() || null
        const source = (row[sourceCol] || 'import').trim()
        const phone = normalizePhone(rawPhone)

        if (!phone && !email) {
          errorDetails.push({ row: rowNum, error: 'Telefon veya e-posta gerekli' })
          errorCount++
          continue
        }

        // Dedup: check by phone or email
        let existingContactId: string | null = null

        if (phone) {
          const { data: byPhone } = await service
            .from('contacts')
            .select('id')
            .eq('organization_id', orgId)
            .eq('phone', phone)
            .maybeSingle()
          if (byPhone?.id) existingContactId = byPhone.id
        }

        if (!existingContactId && email) {
          const { data: byEmail } = await service
            .from('contacts')
            .select('id')
            .eq('organization_id', orgId)
            .eq('email', email)
            .maybeSingle()
          if (byEmail?.id) existingContactId = byEmail.id
        }

        if (existingContactId) {
          duplicateCount++
          continue
        }

        // Insert contact
        const { data: newContact, error: contactErr } = await service
          .from('contacts')
          .insert({
            organization_id: orgId,
            full_name: name || null,
            phone: phone || null,
            email: email || null,
            source_channel: source,
            status: 'new',
          })
          .select('id')
          .single()

        if (contactErr || !newContact) {
          errorDetails.push({ row: rowNum, error: contactErr?.message || 'Contact insert failed' })
          errorCount++
          continue
        }

        // Insert lead
        await service.from('leads').insert({
          organization_id: orgId,
          contact_id: newContact.id,
          status: 'new',
          qualification_score: 5,
          source_channel: source,
          collected_data: {},
        })

        insertedCount++
      } catch (err: any) {
        errorDetails.push({ row: rowNum, error: err.message || 'Unknown error' })
        errorCount++
      }
    }

    // Update progress
    await service
      .from('import_jobs')
      .update({ processed_rows: Math.min(i + batchSize, totalRows) })
      .eq('id', job.id)
  }

  // Complete job
  await service
    .from('import_jobs')
    .update({
      status: errorCount === totalRows ? 'failed' : 'completed',
      processed_rows: totalRows,
      inserted_count: insertedCount,
      duplicate_count: duplicateCount,
      error_count: errorCount,
      error_details: errorDetails,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    total_rows: totalRows,
    inserted_count: insertedCount,
    duplicate_count: duplicateCount,
    error_count: errorCount,
    truncated: rows.length > MAX_ROWS,
  })
}
