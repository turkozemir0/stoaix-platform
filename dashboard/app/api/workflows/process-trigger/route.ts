import { NextRequest, NextResponse } from 'next/server'
import { createClient as sbAdmin } from '@supabase/supabase-js'
import { getTemplate } from '@/lib/workflow-templates'
import type { TriggerType } from '@/lib/workflow-types'

function getServiceClient() {
  return sbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
// POST — Supabase pg_net trigger → bu endpoint → n8n dispatch
// Body: { event, org_id, ref_id, data }
export async function POST(request: NextRequest) {
  // Validate internal secret
  const secret = request.headers.get('x-internal-secret')
  const expectedSecret = process.env.WORKFLOW_INTERNAL_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event, org_id, ref_id, data: triggerData } = body

  if (!event || !org_id) {
    return NextResponse.json({ error: 'event ve org_id zorunlu' }, { status: 400 })
  }

  const service = getServiceClient()

  // event'e eşleşen aktif org_workflows bul
  const { data: workflows, error } = await service
    .from('org_workflows')
    .select('*')
    .eq('organization_id', org_id)
    .eq('is_active', true)

  if (error || !workflows?.length) {
    return NextResponse.json({ processed: 0, _debug: 'no_workflows', error: error?.message, count: workflows?.length ?? 0 })
  }

  // event → trigger_type eşleşmesi
  const triggerType = event as TriggerType
  const matching = workflows.filter(w => {
    const template = getTemplate(w.template_id)
    return template?.trigger_type === triggerType
  })

  if (!matching.length) {
    return NextResponse.json({ processed: 0, _debug: 'no_matching', found_templates: workflows.map(w => ({ id: w.template_id, trigger: getTemplate(w.template_id)?.trigger_type })), event })
  }

  // Contact bilgisi
  let contactPhone = triggerData?.phone ?? ''
  let contactId    = triggerData?.contact_id ?? null
  let contactData: Record<string, any> = {}

  if (contactId) {
    const { data: contact } = await service
      .from('contacts')
      .select('phone, full_name, source_channel')
      .eq('id', contactId)
      .maybeSingle()
    if (contact) {
      contactPhone  = contact.phone ?? contactPhone
      contactData.name         = contact.full_name ?? ''
      contactData.lead_source  = contact.source_channel ?? ''
    }
  }

  // Lead bilgisi varsa
  if (triggerData?.id && event === 'lead_created') {
    const { data: lead } = await service
      .from('leads')
      .select('contact_id, collected_data, source_channel')
      .eq('id', triggerData.id)
      .maybeSingle()
    if (lead) {
      contactId              = lead.contact_id ?? contactId
      contactData.lead_source = lead.source_channel ?? ''
      Object.assign(contactData, lead.collected_data ?? {})

      // Get phone from contact if not already set
      if (!contactPhone && lead.contact_id) {
        const { data: c } = await service
          .from('contacts')
          .select('phone, full_name')
          .eq('id', lead.contact_id)
          .maybeSingle()
        if (c) {
          contactPhone     = c.phone ?? ''
          contactData.name = c.full_name ?? ''
        }
      }
    }
  }

  // Appointment events — bilgi zenginleştirme
  const isApptEvent = ['appointment_created', 'appointment_reminder', 'appointment_noshow', 'post_appointment'].includes(event)
  if (isApptEvent && triggerData?.id) {
    const apptId = ref_id ?? triggerData.id
    const { data: appt } = await service
      .from('appointments')
      .select('contact_id, lead_id, scheduled_at, metadata')
      .eq('id', apptId)
      .maybeSingle()

    if (appt) {
      contactId = contactId ?? appt.contact_id ?? appt.lead_id
      contactData.appointment_id = apptId
      contactData.lead_id        = appt.lead_id ?? null
      contactData.contact_id     = appt.contact_id ?? null

      // appointment_time from schedule or pre-built label
      if (triggerData.appointment_time) {
        contactData.appointment_time = triggerData.appointment_time
      } else if (appt.scheduled_at) {
        const apptDate = new Date(appt.scheduled_at)
        contactData.appointment_time = apptDate.toLocaleString('tr-TR', {
          timeZone: 'Europe/Istanbul', hour12: false,
        })
      }

      // Get contact phone if not set yet
      if (!contactPhone && appt.contact_id) {
        const { data: c } = await service
          .from('contacts')
          .select('phone, full_name')
          .eq('id', appt.contact_id)
          .maybeSingle()
        if (c) {
          contactPhone     = c.phone ?? ''
          contactData.name = contactData.name || (c.full_name ?? '')
        }
      }
    }
  }

  const dashboardUrl   = process.env.NEXT_PUBLIC_APP_URL || 'https://platform.stoaix.com'
  const n8nWebhookUrl  = process.env.N8N_WEBHOOK_BASE_URL

  let processed = 0
  for (const workflow of matching) {
    const template = getTemplate(workflow.template_id)
    if (!template) continue

    // workflow_runs INSERT
    const { data: run, error: runErr } = await service
      .from('workflow_runs')
      .insert({
        org_workflow_id: workflow.id,
        organization_id: org_id,
        contact_id:      contactId ?? null,
        contact_phone:   contactPhone,
        trigger_type:    triggerType,
        trigger_ref_id:  ref_id ?? null,
        status:          'pending',
      })
      .select('id')
      .single()

    if (runErr || !run) continue

    // n8n dispatch (async, no-wait)
    if (n8nWebhookUrl && contactPhone) {
      const payload = {
        run_id:       run.id,
        org_id,
        phone:        contactPhone,
        config:       workflow.config,
        script_type:  template.id,
        contact_data: contactData,
        callback_url: `${dashboardUrl}/api/webhooks/n8n-result`,
      }

      fetch(`${n8nWebhookUrl}/webhook/${template.n8n_workflow_id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }).then(() => {
        service.from('workflow_runs')
          .update({ status: 'running', started_at: new Date().toISOString() })
          .eq('id', run.id)
          .then(() => {})
      }).catch(e => {
        console.error('[process-trigger] n8n dispatch failed:', e)
        service.from('workflow_runs')
          .update({ status: 'failed', finished_at: new Date().toISOString() })
          .eq('id', run.id)
          .then(() => {})
      })
    }

    processed++
  }

  return NextResponse.json({ processed })
}
