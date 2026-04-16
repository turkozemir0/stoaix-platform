'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Plus, Loader2, ChevronRight, Clock, User,
  X, Link2, Search, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type AppointmentType = 'consultation' | 'operation' | 'follow_up' | 'other'
type AppointmentSource = 'platform' | 'google' | 'ai' | 'ghl'
type SourceFilter = 'all' | AppointmentSource

interface Appointment {
  id: string
  title?: string | null
  scheduled_at: string
  duration_minutes: number
  status: string
  appointment_type: AppointmentType
  source: AppointmentSource
  external_id?: string | null
  notes?: string | null
  contact_id?: string | null
  lead_id?: string | null
  contacts?: { full_name?: string; phone?: string } | null
  leads?: { qualification_score?: number; status?: string } | null
}

interface Lead {
  id: string
  contacts: { full_name?: string; phone?: string } | null
  qualification_score?: number
}

interface NewAppointmentForm {
  title: string
  date: string
  startTime: string
  endTime: string
  appointment_type: AppointmentType
  notes: string
  leadId: string
  contactId: string
}

const EMPTY_FORM: NewAppointmentForm = {
  title: '', date: '', startTime: '09:00', endTime: '10:00',
  appointment_type: 'consultation', notes: '', leadId: '', contactId: '',
}

const TYPE_LABELS: Record<AppointmentType, string> = {
  consultation: 'Konsültasyon',
  operation:    'Operasyon',
  follow_up:    'Kontrol',
  other:        'Diğer',
}

const SOURCE_LABELS: Record<AppointmentSource, string> = {
  platform: 'Platform',
  google:   'Google',
  ai:       'AI Asistan',
  ghl:      'GHL',
}

// Left-bar color by source
const SOURCE_BAR_CLASS: Record<AppointmentSource, string> = {
  platform: 'bg-brand-400',
  google:   'bg-blue-400',
  ai:       'bg-emerald-400',
  ghl:      'bg-amber-400',
}

// Chip badge color by source
const SOURCE_BADGE_CLASS: Record<AppointmentSource, string> = {
  platform: 'bg-brand-50 text-brand-600 border-brand-100',
  google:   'bg-blue-50 text-blue-600 border-blue-100',
  ai:       'bg-emerald-50 text-emerald-600 border-emerald-100',
  ghl:      'bg-amber-50 text-amber-600 border-amber-100',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 1)  return 'az önce'
  if (diff < 60) return `${diff} dk önce`
  const h = Math.floor(diff / 60)
  if (h < 24)    return `${h} saat önce`
  return `${Math.floor(h / 24)} gün önce`
}
function groupByDate(appointments: Appointment[]) {
  const groups: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    const day = appt.scheduled_at.slice(0, 10)
    if (!groups[day]) groups[day] = []
    groups[day].push(appt)
  }
  return groups
}

export default function CalendarPage() {
  const [provider, setProvider]       = useState<string>('none')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [lastSynced, setLastSynced]   = useState<string | null>(null)
  const [syncing, setSyncing]         = useState(false)
  const [loading, setLoading]         = useState(true)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const [showModal, setShowModal]     = useState(false)
  const [form, setForm]               = useState<NewAppointmentForm>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')
  const [leads, setLeads]             = useState<Lead[]>([])
  const [leadSearch, setLeadSearch]   = useState('')
  const [leadsLoading, setLeadsLoading] = useState(false)

  const loadAppointments = useCallback(async () => {
    const params = new URLSearchParams()
    if (sourceFilter !== 'all') params.set('source', sourceFilter)
    const res  = await fetch(`/api/calendar/events?${params}`)
    const data = await res.json()
    setProvider(data.provider ?? 'none')
    setLastSynced(data.last_synced_at ?? null)
    setAppointments(data.appointments ?? [])
  }, [sourceFilter])

  const load = useCallback(async () => {
    setLoading(true)
    let detectedProvider = 'none'
    try {
      const res  = await fetch('/api/calendar/events')
      const data = await res.json()
      detectedProvider = data.provider ?? 'none'
      setProvider(detectedProvider)
      setLastSynced(data.last_synced_at ?? null)
      setAppointments(data.appointments ?? [])
    } finally {
      setLoading(false)
    }
    // Auto-sync Google in background (non-blocking)
    if (detectedProvider === 'google') {
      setSyncing(true)
      try {
        const syncRes  = await fetch('/api/calendar/sync', { method: 'POST' })
        const syncData = await syncRes.json()
        if (syncRes.ok) {
          setLastSynced(syncData.last_synced_at)
          if (syncData.synced > 0) await loadAppointments()
        }
      } finally {
        setSyncing(false)
      }
    }
  }, [loadAppointments])

  useEffect(() => { load() }, [])

  // Reload when filter changes
  useEffect(() => {
    loadAppointments()
  }, [sourceFilter])

  async function manualSync() {
    setSyncing(true)
    try {
      const syncRes  = await fetch('/api/calendar/sync', { method: 'POST' })
      const syncData = await syncRes.json()
      if (syncRes.ok) {
        setLastSynced(syncData.last_synced_at)
        await loadAppointments()
      }
    } finally {
      setSyncing(false)
    }
  }

  async function loadLeads(search = '') {
    setLeadsLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLeadsLoading(false); return }

    const { data: orgUser } = await sb
      .from('org_users').select('organization_id').eq('user_id', user.id).maybeSingle()
    if (!orgUser) { setLeadsLoading(false); return }

    let query = sb
      .from('leads')
      .select('id, qualification_score, contacts(full_name, phone)')
      .eq('organization_id', orgUser.organization_id)
      .not('status', 'in', '("converted","lost")')
      .order('updated_at', { ascending: false })
      .limit(20)

    if (search) {
      const { data: contactMatches } = await sb
        .from('contacts')
        .select('id')
        .eq('organization_id', orgUser.organization_id)
        .ilike('full_name', `%${search}%`)
        .limit(20)
      const contactIds = (contactMatches ?? []).map((c: any) => c.id)
      if (contactIds.length === 0) { setLeads([]); setLeadsLoading(false); return }
      query = query.in('contact_id', contactIds)
    }

    const { data } = await query
    setLeads((data ?? []) as Lead[])
    setLeadsLoading(false)
  }

  useEffect(() => {
    if (showModal) loadLeads()
  }, [showModal])

  useEffect(() => {
    if (!showModal) return
    const t = setTimeout(() => loadLeads(leadSearch), 300)
    return () => clearTimeout(t)
  }, [leadSearch, showModal])

  async function createAppointment() {
    if (!form.title || !form.date || !form.startTime || !form.endTime) {
      setFormError('Başlık, tarih ve saatler zorunlu')
      return
    }
    setSaving(true)
    setFormError('')

    const startDateTime = `${form.date}T${form.startTime}:00`
    const [endH, endM]  = form.endTime.split(':').map(Number)
    const [startH, startM] = form.startTime.split(':').map(Number)
    const durationMinutes = Math.max(15, (endH * 60 + endM) - (startH * 60 + startM))

    const selectedLead = leads.find(l => l.id === form.leadId)
    const contactId    = selectedLead?.contacts ? form.leadId
      ? (await resolveContactId(form.leadId)) : form.contactId
      : form.contactId

    const body: Record<string, any> = {
      scheduled_at:     startDateTime,
      duration_minutes: durationMinutes,
      title:            form.title,
      appointment_type: form.appointment_type,
      notes:            form.notes || undefined,
      lead_id:          form.leadId || undefined,
      contact_id:       contactId || undefined,
      source:           'platform',
    }

    const res  = await fetch('/api/appointments', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error ?? 'Oluşturulamadı'); setSaving(false); return }

    setShowModal(false)
    setForm(EMPTY_FORM)
    setLeadSearch('')
    await loadAppointments()
    setSaving(false)
  }

  async function resolveContactId(leadId: string): Promise<string | null> {
    const sb = createClient()
    const { data } = await sb.from('leads').select('contact_id').eq('id', leadId).maybeSingle()
    return data?.contact_id ?? null
  }

  const grouped      = groupByDate(appointments)
  const selectedLead = leads.find(l => l.id === form.leadId)
  const hasEntries   = appointments.length > 0

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar size={22} className="text-brand-600" />
          <h1 className="text-xl font-semibold text-slate-800">Takvim</h1>
          {provider && provider !== 'none' && (
            <span className="text-xs bg-brand-50 text-brand-600 border border-brand-100 px-2 py-0.5 rounded-full font-medium">
              {provider === 'google' ? 'Google Takvim bağlı' : provider}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus size={15} />
          Yeni Randevu
        </button>
      </div>

      {/* Filter chips + Sync */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {(['all', 'platform', 'google', 'ai', 'ghl'] as const).map(f => (
          <button
            key={f}
            onClick={() => setSourceFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              sourceFilter === f
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f === 'all' ? 'Tümü' : SOURCE_LABELS[f]}
          </button>
        ))}

        {provider === 'google' && (
          <div className="ml-auto flex items-center gap-2">
            {lastSynced && (
              <span className="text-xs text-slate-400">Son senkron: {timeAgo(lastSynced)}</span>
            )}
            <button
              onClick={manualSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Senkronize ediliyor...' : 'Senkronize Et'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      ) : !hasEntries ? (
        /* No appointments */
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Calendar size={40} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-1">
            {sourceFilter !== 'all'
              ? `${SOURCE_LABELS[sourceFilter]} kaynağından randevu yok`
              : 'Yaklaşan randevu yok'}
          </p>
          <p className="text-sm text-slate-400 mb-5">
            {provider === 'none'
              ? 'Google Takvim veya Dentsoft bağlamak için Ayarlar sayfasına gidin.'
              : 'Yeni bir randevu oluşturmak için butona tıklayın.'}
          </p>
          {provider === 'none' ? (
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Takvimi Bağla
              <ChevronRight size={15} />
            </Link>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Plus size={15} />
              Yeni Randevu
            </button>
          )}
        </div>
      ) : (
        /* Appointments grouped by date */
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayAppts]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                {formatDate(day + 'T00:00:00')}
              </p>
              <div className="space-y-2">
                {dayAppts.map(appt => {
                  const barClass    = SOURCE_BAR_CLASS[appt.source] ?? 'bg-slate-300'
                  const badgeClass  = SOURCE_BADGE_CLASS[appt.source] ?? 'bg-slate-50 text-slate-500 border-slate-100'
                  const contactName = appt.contacts?.full_name
                  const displayName = appt.title ?? contactName ?? '(Başlıksız)'
                  const endTime     = new Date(
                    new Date(appt.scheduled_at).getTime() + appt.duration_minutes * 60_000
                  ).toISOString()

                  return (
                    <div
                      key={appt.id}
                      className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-start gap-4 hover:border-brand-200 transition-colors"
                    >
                      <div className={`mt-0.5 w-1 h-12 rounded-full shrink-0 ${barClass}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-800 truncate">{displayName}</p>
                          <span className={`text-xs border px-1.5 py-0.5 rounded-full font-medium ${badgeClass}`}>
                            {TYPE_LABELS[appt.appointment_type] ?? appt.appointment_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                          <Clock size={13} />
                          {formatTime(appt.scheduled_at)} — {formatTime(endTime)}
                        </div>
                        {contactName && appt.title && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-0.5">
                            <User size={13} />
                            {contactName}
                          </div>
                        )}
                        {appt.notes && (
                          <p className="text-sm text-slate-400 mt-1 truncate">{appt.notes}</p>
                        )}
                        {appt.lead_id && (
                          <Link
                            href={`/dashboard/leads/${appt.lead_id}`}
                            className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 mt-1 transition-colors"
                          >
                            <Link2 size={11} />
                            Lead detayı
                          </Link>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className={`text-xs border px-1.5 py-0.5 rounded-full font-medium ${badgeClass}`}>
                          {SOURCE_LABELS[appt.source] ?? appt.source}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Yeni Randevu</h2>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(''); setLeadSearch('') }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Başlık *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Randevu başlığı"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Randevu Tipi</label>
                <select
                  value={form.appointment_type}
                  onChange={e => setForm(f => ({ ...f, appointment_type: e.target.value as AppointmentType }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {(Object.entries(TYPE_LABELS) as [AppointmentType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tarih *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç *</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bitiş *</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Lead seçimi */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lead bağlantısı</label>
                {form.leadId ? (
                  <div className="flex items-center justify-between border border-brand-200 bg-brand-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-brand-700">
                        {selectedLead?.contacts?.full_name ?? 'İsimsiz'}
                      </p>
                      {selectedLead?.contacts?.phone && (
                        <p className="text-xs text-brand-500">{selectedLead.contacts.phone}</p>
                      )}
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, leadId: '' }))}
                      className="text-brand-400 hover:text-brand-600">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={leadSearch}
                      onChange={e => setLeadSearch(e.target.value)}
                      placeholder="Lead ara..."
                      className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    {(leads.length > 0 || leadsLoading) && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto z-10">
                        {leadsLoading ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-slate-400 text-sm">
                            <Loader2 size={13} className="animate-spin" />
                            Yükleniyor...
                          </div>
                        ) : leads.map(lead => (
                          <button key={lead.id} type="button"
                            onClick={() => { setForm(f => ({ ...f, leadId: lead.id })); setLeadSearch('') }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                            <span className="font-medium text-slate-700">
                              {lead.contacts?.full_name ?? 'İsimsiz'}
                            </span>
                            {lead.contacts?.phone && (
                              <span className="text-slate-400 ml-2 text-xs">{lead.contacts.phone}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="İsteğe bağlı not..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {provider === 'google' && (
              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                Google Takvim'e otomatik eklenecek
              </p>
            )}

            {formError && <p className="text-sm text-red-500 mt-3">{formError}</p>}

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(''); setLeadSearch('') }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                İptal
              </button>
              <button
                onClick={createAppointment}
                disabled={saving}
                className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
