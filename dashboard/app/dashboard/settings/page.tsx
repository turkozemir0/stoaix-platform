'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { Settings, Trash2, Plus, Loader2, Calendar, CheckCircle2, ExternalLink, Instagram, X, MessageCircle, Lock, ToggleLeft, ToggleRight, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Facebook SDK type shim ───────────────────────────────────────────────────
declare global {
  interface Window {
    FB: any
    fbAsyncInit: () => void
  }
}

function loadFbSdk(appId: string) {
  if (document.getElementById('facebook-jssdk')) return
  window.fbAsyncInit = function () {
    window.FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' })
  }
  const script = document.createElement('script')
  script.id  = 'facebook-jssdk'
  script.src = 'https://connect.facebook.net/en_US/sdk.js'
  document.body.appendChild(script)
}

function CalendarSection() {
  const searchParams = useSearchParams()
  const [calConnected, setCalConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: orgUser } = await supabase
        .from('org_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!orgUser) { setLoading(false); return }
      const { data: org } = await supabase
        .from('organizations')
        .select('channel_config')
        .eq('id', orgUser.organization_id)
        .single()
      const cal = (org?.channel_config as any)?.calendar
      setCalConnected(!!(cal?.access_token))
      setLoading(false)
    })
  }, [searchParams.get('calendar_connected')])

  const connected = calConnected || !!searchParams.get('calendar_connected')
  const error = searchParams.get('calendar_error')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Calendar size={16} className="text-brand-600" />
        <h2 className="font-semibold text-slate-800">Google Takvim</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Randevu oluşturma özelliği için Google Takviminizi bağlayın.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor...
        </div>
      ) : connected ? (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 size={16} />
          <span className="font-medium">Google Takvim bağlı</span>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => window.location.href = '/api/calendar/auth'}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Yeniden bağla
            </button>
            <button
              disabled={disconnecting}
              onClick={async () => {
                if (!confirm('Google Takvim bağlantısını kesmek istediğinize emin misiniz?')) return
                setDisconnecting(true)
                const res = await fetch('/api/calendar/disconnect', { method: 'DELETE' })
                if (res.ok) {
                  setCalConnected(false)
                } else {
                  alert('Bağlantı kesilirken bir hata oluştu.')
                }
                setDisconnecting(false)
              }}
              className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
            >
              {disconnecting ? 'Kesiliyor...' : 'Bağlantıyı kes'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <p className="text-sm text-red-500 mb-3">
              Bağlantı başarısız: {error}
            </p>
          )}
          <button
            onClick={() => window.location.href = '/api/calendar/auth'}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Calendar size={14} />
            Google Takvim Bağla
            <ExternalLink size={13} className="opacity-70" />
          </button>
        </>
      )}
    </div>
  )
}

function InstagramSection() {
  const searchParams = useSearchParams()
  const [igState, setIgState] = useState<{ connected: boolean; username?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: orgUser } = await supabase
        .from('org_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!orgUser) { setLoading(false); return }
      const { data: org } = await supabase
        .from('organizations')
        .select('channel_config')
        .eq('id', orgUser.organization_id)
        .single()
      const ig = (org?.channel_config as any)?.instagram
      const creds = ig?.credentials
      setIgState({
        connected: !!(ig?.active && creds?.page_id),
        username: creds?.username,
      })
      setLoading(false)
    })
  }, [searchParams.get('instagram')])

  const justConnected = searchParams.get('instagram') === 'connected'
  const error = searchParams.get('instagram_error')
  const connected = justConnected || igState?.connected

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/instagram/disconnect', { method: 'DELETE' })
      setIgState({ connected: false })
      // Remove query param without full reload
      window.history.replaceState({}, '', '/dashboard/settings')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Instagram size={16} className="text-pink-500" />
        <h2 className="font-semibold text-slate-800">Instagram DM</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Instagram hesabınızı bağlayın, gelen DM&apos;ler otomatik yönetilsin.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor...
        </div>
      ) : connected ? (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 size={16} />
          <span className="font-medium">
            Bağlı{igState?.username ? ` — @${igState.username}` : ''}
          </span>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
          >
            {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Bağlantıyı Kes
          </button>
        </div>
      ) : (
        <>
          {error && (
            <p className="text-sm text-red-500 mb-3">
              Bağlantı başarısız: {error}
            </p>
          )}
          <button
            onClick={() => { window.location.href = '/api/instagram/auth' }}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Instagram size={14} />
            Instagram&apos;ı Bağla
            <ExternalLink size={13} className="opacity-70" />
          </button>
        </>
      )}
    </div>
  )
}

type WaConnectMode = 'embedded' | 'manual'

function WhatsAppSection() {
  const [waState, setWaState]       = useState<{ connected: boolean; phone?: string } | null>(null)
  const [loading, setLoading]       = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError]           = useState('')
  const [mode, setMode]             = useState<WaConnectMode>('embedded')

  // Manual form fields
  const [manualPhoneId, setManualPhoneId]   = useState('')
  const [manualToken, setManualToken]       = useState('')
  const [manualWabaId, setManualWabaId]     = useState('')

  const waSessionInfo = useRef<{ phone_number_id?: string; waba_id?: string } | null>(null)
  const hasEmbeddedSignup = !!process.env.NEXT_PUBLIC_META_WA_CONFIG_ID

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
    if (appId) loadFbSdk(appId)

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: orgUser } = await supabase
        .from('org_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!orgUser) { setLoading(false); return }
      const { data: org } = await supabase
        .from('organizations')
        .select('channel_config')
        .eq('id', orgUser.organization_id)
        .single()
      const wa    = (org?.channel_config as any)?.whatsapp
      const creds = wa?.credentials
      setWaState({
        connected: !!(wa?.active && creds?.phone_number_id),
        phone:     creds?.phone_number,
      })
      setLoading(false)
    })
  }, [])

  // Listen for Embedded Signup session info (WABA + phone_number_id from Meta popup)
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== 'https://www.facebook.com') return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          waSessionInfo.current = {
            phone_number_id: data.data?.phone_number_id,
            waba_id:         data.data?.waba_id,
          }
        }
      } catch {}
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  async function connectEmbedded() {
    if (!window.FB) {
      setError('Facebook SDK yüklenemedi, sayfayı yenileyin.')
      return
    }
    setConnecting(true)
    setError('')
    waSessionInfo.current = null

    window.FB.login(async (response: any) => {
      try {
        if (!response?.authResponse?.code) {
          setError('Bağlantı iptal edildi veya yetki verilmedi.')
          return
        }
        const sessionInfo = waSessionInfo.current ?? {}
        const res = await fetch('/api/whatsapp/callback', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code:            response.authResponse.code,
            phone_number_id: sessionInfo.phone_number_id,
            waba_id:         sessionInfo.waba_id,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Bağlantı başarısız')
        setWaState({ connected: true, phone: data.phone_number })
      } catch (e: any) {
        setError(e.message ?? 'Bağlantı başarısız')
      } finally {
        setConnecting(false)
      }
    }, {
      config_id:                    process.env.NEXT_PUBLIC_META_WA_CONFIG_ID,
      response_type:                'code',
      override_default_response_type: true,
      extras: { sessionInfoVersion: '3' },
    })
  }

  async function connectManual() {
    if (!manualPhoneId.trim() || !manualToken.trim()) {
      setError('Phone Number ID ve Access Token zorunlu.')
      return
    }
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/whatsapp/manual-connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: manualPhoneId.trim(),
          access_token:    manualToken.trim(),
          waba_id:         manualWabaId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Bağlantı başarısız')
      setWaState({ connected: true, phone: data.phone_number })
      setManualPhoneId('')
      setManualToken('')
      setManualWabaId('')
    } catch (e: any) {
      setError(e.message ?? 'Bağlantı başarısız')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'DELETE' })
      setWaState({ connected: false })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle size={16} className="text-green-500" />
        <h2 className="font-semibold text-slate-800">WhatsApp</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        WhatsApp Business hesabınızı bağlayın, gelen mesajlar otomatik yönetilsin.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor...
        </div>
      ) : waState?.connected ? (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 size={16} />
          <span className="font-medium">
            Bağlı{waState.phone ? ` — ${waState.phone}` : ''}
          </span>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
          >
            {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Bağlantıyı Kes
          </button>
        </div>
      ) : (
        <>
          {/* Mode toggle — only show if Embedded Signup is configured */}
          {hasEmbeddedSignup && (
            <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => { setMode('embedded'); setError('') }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'embedded' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Embedded Signup
              </button>
              <button
                onClick={() => { setMode('manual'); setError('') }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Manuel Bağla
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          {/* Embedded Signup button */}
          {(mode === 'embedded' && hasEmbeddedSignup) && (
            <button
              onClick={connectEmbedded}
              disabled={connecting}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
              WhatsApp Bağla
              <ExternalLink size={13} className="opacity-70" />
            </button>
          )}

          {/* Manual connect form */}
          {(mode === 'manual' || !hasEmbeddedSignup) && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Phone Number ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualPhoneId}
                  onChange={(e) => setManualPhoneId(e.target.value)}
                  placeholder="Meta App → WhatsApp → Phone Numbers"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  System User Access Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="EAAx..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  WABA ID <span className="text-slate-400 font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  type="text"
                  value={manualWabaId}
                  onChange={(e) => setManualWabaId(e.target.value)}
                  placeholder="WhatsApp Business Account ID"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                onClick={connectManual}
                disabled={connecting || !manualPhoneId.trim() || !manualToken.trim()}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {connecting ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                Bağlan &amp; Doğrula
              </button>
              <p className="text-xs text-slate-400">
                Meta Business Suite → System Users → "Generate Token" ile token alabilirsiniz.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ExcludedPhonesSection() {
  const [phones, setPhones] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/settings/excluded-phones')
      .then((r) => r.json())
      .then((d) => setPhones(d.phones ?? []))
      .catch(() => setError('Yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  async function save(updated: string[]) {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch('/api/settings/excluded-phones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: updated }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPhones(data.phones)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (e: any) {
      setError(e.message ?? 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  function addPhones() {
    if (!input.trim()) return
    const parsed = input.split(/[\s,\n]+/).map((s) => s.trim()).filter(Boolean)
    const merged = Array.from(new Set([...phones, ...parsed]))
    setInput('')
    save(merged)
  }

  function remove(phone: string) {
    save(phones.filter((p) => p !== phone))
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-800 mb-1">Hariç Tutulan Numaralar</h2>
      <p className="text-sm text-slate-500 mb-4">
        Bu numaralara gelen mesajlara AI yanıt vermez. Numaraları ülke kodu ile girin (ör.{' '}
        <span className="font-mono">4915123456789</span> veya{' '}
        <span className="font-mono">+4915123456789</span>). Virgülle, boşlukla veya alt alta yapıştırabilirsiniz.
      </p>

      <div className="flex gap-2 mb-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addPhones() } }}
          placeholder="+4915123456789&#10;4915123456789, +90 555 000 00 00"
          rows={3}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={addPhones}
          disabled={saving || !input.trim()}
          className="self-start flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Ekle
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {success && <p className="text-sm text-green-600 mb-3">Kaydedildi.</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor...
        </div>
      ) : phones.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">Henüz hariç tutulan numara yok.</p>
      ) : (
        <ul className="space-y-1">
          {phones.map((phone) => (
            <li key={phone} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
              <span className="font-mono text-slate-700">{phone}</span>
              <button
                onClick={() => remove(phone)}
                disabled={saving}
                className="text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Module labels ────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  whatsapp:       'WhatsApp',
  inbox:          'Gelen Kutusu',
  voice:          'Ses Agent',
  knowledge_base: 'Bilgi Bankası',
  leads:          'Lead Yönetimi',
  proposals:      'Teklifler',
  calendar:       'Takvim',
  followup:       'Takip',
  instagram:      'Instagram DM',
  analytics:      'Analitik',
  api:            'API / Webhook',
  crm:            'CRM Entegrasyonu',
  support:        'Destek',
  team:           'Ekip',
}

interface ModuleFeature {
  key: string
  module: string
  name: string
  plan_enabled: boolean
  plan_limit: number | null
  user_disabled: boolean
  effective_enabled: boolean
}

function ModulesSection() {
  const [features, setFeatures] = useState<ModuleFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/modules')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setFeatures(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle(featureKey: string, newEnabled: boolean) {
    setToggling(featureKey)
    try {
      await fetch('/api/settings/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: featureKey, enabled: newEnabled }),
      })
      // Optimistic update
      setFeatures(prev => prev.map(f =>
        f.key === featureKey
          ? { ...f, user_disabled: !newEnabled, effective_enabled: f.plan_enabled && newEnabled }
          : f
      ))
    } finally {
      setToggling(null)
    }
  }

  // Group by module
  const grouped: Record<string, ModuleFeature[]> = {}
  for (const f of features) {
    if (!grouped[f.module]) grouped[f.module] = []
    grouped[f.module].push(f)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="h-3 w-24 bg-slate-100 rounded" />
            {[1, 2].map(j => (
              <div key={j} className="flex items-center justify-between py-2">
                <div className="h-3 w-40 bg-slate-100 rounded" />
                <div className="h-5 w-10 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (features.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
        Özellik listesi yüklenemedi.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Planınızda açık olan modülleri kapatabilirsiniz. Planınızda olmayan modüller için{' '}
        <Link href="/dashboard/billing" className="text-brand-600 underline hover:text-brand-700">plan yükseltme</Link>{' '}
        gereklidir.
      </p>
      {Object.entries(grouped).map(([module, moduleFeatures]) => (
        <div key={module} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {MODULE_LABELS[module] ?? module}
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {moduleFeatures.map(f => {
              const isToggling = toggling === f.key
              return (
                <div key={f.key} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {!f.plan_enabled ? (
                      <Lock size={14} className="shrink-0 text-slate-300" />
                    ) : f.effective_enabled ? (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    ) : (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${!f.plan_enabled ? 'text-slate-400' : 'text-slate-700'}`}>
                        {f.name}
                      </p>
                      {f.plan_limit !== null && (
                        <p className="text-xs text-slate-400">{f.plan_limit.toLocaleString('tr-TR')}/ay limit</p>
                      )}
                    </div>
                  </div>

                  {!f.plan_enabled ? (
                    <Link
                      href="/dashboard/billing"
                      className="shrink-0 text-xs text-brand-600 font-medium hover:text-brand-700 flex items-center gap-1"
                    >
                      <CreditCard size={12} />
                      Yükselt
                    </Link>
                  ) : (
                    <button
                      onClick={() => toggle(f.key, !f.effective_enabled)}
                      disabled={isToggling}
                      title={f.effective_enabled ? 'Kapat' : 'Aç'}
                      className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                    >
                      {isToggling ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : f.effective_enabled ? (
                        <ToggleRight size={24} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={24} className="text-slate-300" />
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

type SettingsTab = 'kanallar' | 'moduller'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('kanallar')

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={22} className="text-brand-600" />
        <h1 className="text-xl font-semibold text-slate-800">Ayarlar</h1>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {(['kanallar', 'moduller'] as SettingsTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'kanallar' ? 'Kanallar' : 'Modüller'}
          </button>
        ))}
      </div>

      {activeTab === 'kanallar' && (
        <div className="space-y-6">
          <Suspense fallback={<div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-400">Yükleniyor...</div>}>
            <WhatsAppSection />
          </Suspense>
          <Suspense fallback={<div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-400">Yükleniyor...</div>}>
            <InstagramSection />
          </Suspense>
          <Suspense fallback={<div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-400">Yükleniyor...</div>}>
            <CalendarSection />
          </Suspense>
          <ExcludedPhonesSection />
        </div>
      )}

      {activeTab === 'moduller' && <ModulesSection />}
    </div>
  )
}
