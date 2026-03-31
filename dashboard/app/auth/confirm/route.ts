import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'email' | null

  if (!token_hash || type !== 'email') {
    return NextResponse.redirect(`${origin}/login?error=invalid_confirmation_link`)
  }

  const supabase = createClient()

  // Exchange token_hash for session
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' })

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  const user = data.user
  const inviteToken = user.user_metadata?.invite_token as string | undefined

  if (!inviteToken) {
    // Confirmed but no invite token — already registered or direct signup
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  const service = getServiceClient()

  // Validate invite token
  const { data: tokenData } = await service
    .from('invite_tokens')
    .select('id, organization_id, is_used, expires_at, clinic_type')
    .eq('token', inviteToken)
    .maybeSingle()

  if (!tokenData || tokenData.is_used || new Date(tokenData.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite_token`)
  }

  // Mark token as used
  await service
    .from('invite_tokens')
    .update({ is_used: true, used_by: user.id, used_at: new Date().toISOString() })
    .eq('id', tokenData.id)

  // Add org_user
  await service
    .from('org_users')
    .insert({ organization_id: tokenData.organization_id, user_id: user.id, role: 'admin' })

  // Set org status
  const { data: org } = await service
    .from('organizations')
    .select('onboarding_status')
    .eq('id', tokenData.organization_id)
    .maybeSingle()

  if (org?.onboarding_status !== 'completed') {
    await service
      .from('organizations')
      .update({ status: 'onboarding', onboarding_status: 'in_progress' })
      .eq('id', tokenData.organization_id)
  }

  const clinicType = tokenData.clinic_type ?? 'other'
  const redirectTo = org?.onboarding_status === 'completed'
    ? '/dashboard'
    : `/onboarding?type=${clinicType}`

  return NextResponse.redirect(`${origin}${redirectTo}`)
}
