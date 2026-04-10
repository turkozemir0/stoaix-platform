'use client'

import { useState, useEffect, Suspense } from 'react'
import { Settings, Trash2, Plus, Loader2, Calendar, CheckCircle2, ExternalLink, Instagram, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function CalendarSection() {
  const searchParams = useSearchParams()
  const [calConnected, setCalConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

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
          <button
            onClick={() => window.location.href = '/api/calendar/auth'}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Yeniden bağla
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

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={22} className="text-brand-600" />
        <h1 className="text-xl font-semibold text-slate-800">Ayarlar</h1>
      </div>

      <div className="space-y-6">
        <Suspense fallback={<div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-400">Yükleniyor...</div>}>
          <CalendarSection />
        </Suspense>
        <Suspense fallback={<div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-400">Yükleniyor...</div>}>
          <InstagramSection />
        </Suspense>
        <ExcludedPhonesSection />
      </div>
    </div>
  )
}
