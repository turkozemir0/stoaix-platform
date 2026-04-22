import { NextRequest, NextResponse } from 'next/server'
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk'
import { checkEntitlement } from '@/lib/entitlements'

const LIVEKIT_URL    = process.env.LIVEKIT_URL!
const LIVEKIT_KEY    = process.env.LIVEKIT_API_KEY!
const LIVEKIT_SECRET = process.env.LIVEKIT_API_SECRET!

export async function POST(req: NextRequest) {
  const { orgId, model = 'claude-sonnet-4-6', scenario } = await req.json()

  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

  const ent = await checkEntitlement(orgId, 'voice_agent_inbound')
  if (!ent.enabled) return NextResponse.json({ error: 'upgrade_required', feature: 'voice_agent_inbound' }, { status: 403 })

  const roomName = `test-${orgId.slice(0, 8)}-${Date.now()}`
  const identity = `test-user-${Date.now()}`

  // Build metadata for both user token and dispatch
  const meta: Record<string, any> = { organization_id: orgId, test_mode: true, model }
  if (scenario) {
    meta.scenario = scenario
    meta.contact_name = 'Test Müşteri'
    if (scenario === 'appt_confirm') {
      meta.appointment_time = 'Yarın saat 14:00'
    }
  }

  // Kullanıcı için LiveKit token
  const at = new AccessToken(LIVEKIT_KEY, LIVEKIT_SECRET, {
    identity,
    name: 'Test Kullanıcısı',
    ttl: '1h',
    metadata: JSON.stringify(meta),
  })

  at.addGrant({
    room: roomName,
    roomJoin: true,
    roomCreate: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  const token = await at.toJwt()

  // Agent'ı bu odaya explicit dispatch ile çağır
  let dispatchOk = false
  let dispatchError = ''
  try {
    const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://')
    const dispatch = new AgentDispatchClient(httpUrl, LIVEKIT_KEY, LIVEKIT_SECRET)
    await dispatch.createDispatch(roomName, 'stoaix-platform', {
      metadata: JSON.stringify(meta),
    })
    dispatchOk = true
  } catch (e: any) {
    dispatchError = e?.message || String(e)
    console.warn('Agent dispatch failed:', dispatchError)
  }

  return NextResponse.json({
    token,
    url: LIVEKIT_URL,
    roomName,
    dispatchOk,
    dispatchError,
  })
}
