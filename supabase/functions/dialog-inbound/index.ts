import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleInboundMessage, getSupabase } from '../_shared/chat-engine.ts'

// ─── 360dialog webhook types ──────────────────────────────────────────────────
// 360dialog uses the same Meta Cloud API webhook format
// Docs: https://docs.360dialog.com/whatsapp-api/whatsapp-api/webhooks

interface MetaTextMessage {
  from:      string   // wa_id — phone without '+', e.g. "905551234567"
  id:        string   // wamid — used for idempotency (duplicate webhook prevention)
  type:      string   // 'text' | 'image' | 'audio' | 'document' | ...
  timestamp: string
  text?:     { body: string }
}

interface MetaWebhookPayload {
  object: string   // 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: {
          display_phone_number: string
          phone_number_id: string   // routes to the correct org
        }
        contacts?: Array<{
          profile: { name: string }
          wa_id: string
        }>
        messages?: MetaTextMessage[]
        statuses?: unknown[]  // delivery/read receipts — ignored
      }
      field: string
    }>
  }>
}

// ─── 360dialog send helper ────────────────────────────────────────────────────
// API endpoint: https://waba.360dialog.io/v1/messages
// Auth: D360-API-KEY header (not Bearer token)

async function send360dialogMessage(
  clientToken:   string,
  to:            string,   // wa_id (phone without '+')
  message:       string
): Promise<void> {
  const res = await fetch('https://waba.360dialog.io/v1/messages', {
    method: 'POST',
    headers: {
      'D360-API-KEY':  clientToken,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type:              'text',
      text:              { body: message },
    }),
  })
  if (!res.ok) console.error(`360dialog send failed ${res.status}: ${await res.text()}`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handleInbound(
  phoneNumberId: string,
  message:       MetaTextMessage
): Promise<void> {
  // Only process text messages — skip images, audio, stickers, etc. for now
  if (message.type !== 'text' || !message.text?.body?.trim()) return

  const supabase    = getSupabase()
  const waId        = message.from              // e.g. "905551234567"
  const phone       = '+' + waId               // E.164: "+905551234567"
  const messageText = message.text.body.trim()

  // Find org by 360dialog phone_number_id stored in channel_config.whatsapp.credentials
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, channel_config')
    .eq('status', 'active')

  const org = orgs?.find((o: any) => {
    const wa = (o.channel_config as any)?.whatsapp
    return wa?.provider === '360dialog' && wa?.credentials?.phone_number_id === phoneNumberId
  })

  if (!org) {
    console.error(`No active org for 360dialog phone_number_id: ${phoneNumberId}`)
    return
  }

  const creds       = (org.channel_config as any)?.whatsapp?.credentials ?? {}
  const clientToken = creds.client_token

  if (!clientToken) {
    console.error(`Missing client_token for org: ${org.id}`)
    return
  }

  await handleInboundMessage({
    supabase,
    orgId: org.id,
    phone,
    providerContactId:    waId,
    channelIdentifierKey: 'wa_id',
    channel:              'whatsapp',
    messageText,
    channelMetadata: {
      wa_id:           waId,
      phone_number_id: phoneNumberId,
      provider:        '360dialog',
    },
    sendReply: (msg) => send360dialogMessage(clientToken, waId, msg),
    // onNewLead: undefined — internal Supabase CRM only, no external pipeline
  })
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const url = new URL(req.url)

  // ── Webhook verification (GET) ──
  // 360dialog sends same Meta-style verification:
  // GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  // verify_token is stored per-org in channel_config.whatsapp.credentials.webhook_verify_token
  if (req.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token && challenge) {
      const supabase = getSupabase()
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, channel_config')
        .eq('status', 'active')

      const matched = orgs?.find((o: any) => {
        const wa = (o.channel_config as any)?.whatsapp
        return wa?.provider === '360dialog' && wa?.credentials?.webhook_verify_token === token
      })

      if (matched) return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let payload: MetaWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Only handle WhatsApp Business Account events
  if (payload.object !== 'whatsapp_business_account') {
    return new Response('OK', { status: 200 })
  }

  // Collect all message-handling tasks across all entries/changes
  const tasks: Promise<void>[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      const phoneNumberId = change.value.metadata.phone_number_id

      for (const message of change.value.messages ?? []) {
        tasks.push(handleInbound(phoneNumberId, message))
      }
    }
  }

  // Ack immediately — 360dialog requires fast response to avoid retries
  // @ts-ignore Deno-specific global
  EdgeRuntime.waitUntil(Promise.all(tasks))
  return new Response('OK', { status: 200 })
})
