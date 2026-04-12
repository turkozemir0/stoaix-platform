import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getServiceClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── GET /api/templates ───────────────────────────────────────────────────────
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getServiceClient()
  const { data: orgUser } = await service
    .from('org_users')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!orgUser) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 403 })

  const { data: templates, error } = await service
    .from('message_templates')
    .select('*')
    .eq('organization_id', orgUser.organization_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates })
}

// ─── POST /api/templates ──────────────────────────────────────────────────────
// Body: { name, language?, category, components, submit? }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const { name, language = 'tr', category, components } = body ?? {}
  if (!name || !category || !components) {
    return NextResponse.json({ error: 'name, category ve components zorunlu' }, { status: 400 })
  }

  // Validate name: lowercase letters, numbers, underscores only
  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json({
      error: 'Template adı sadece küçük harf, rakam ve alt çizgi (_) içerebilir'
    }, { status: 400 })
  }

  // Validate category
  const validCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION']
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Geçersiz kategori' }, { status: 400 })
  }

  const service = getServiceClient()
  const { data: orgUser } = await service
    .from('org_users')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!orgUser) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 403 })
  if (!['admin', 'patron', 'yönetici'].includes(orgUser.role)) {
    return NextResponse.json({ error: 'Yetki yetersiz' }, { status: 403 })
  }

  const { data: template, error } = await service
    .from('message_templates')
    .insert({
      organization_id: orgUser.organization_id,
      name,
      language,
      category,
      components,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Bu isimde bir template zaten var' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template }, { status: 201 })
}
