'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Loader2, ChevronRight, Clock, User, X, ExternalLink, Link2, Search } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface GCalEvent {
  id: string
  summary?: string
  description?: string
  start:  { dateTime?: string; date?: string }
  end:    { dateTime?: string; date?: string }
  attendees?: { email: string; displayName?: string; responseStatus?: string }[]
  htmlLink?: string
  extendedProperties?: { private?: { lead_id?: string }; shared?: { lead_id?: string } }
  status?: string
}

interface Lead {
  id: string
  contacts: { full_name?: string; phone?: string } | null
  qualification_score?: number
}

interface NewEventForm {
  title: string
  date: string
  startTime: string
  endTime: string
  attendeeEmail: string
  description: string
  leadId: string
}

const EMPTY_FORM: NewEventForm = {
  title: '', date: '', startTime: '09:00', endTime: '10:00',
  attendeeEmail: '', description: '', leadId: '',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}
function groupByDate(events: GCalEvent[]) {
  const groups: Record<string, GCalEvent[]> = {}
  for (const ev of events) {
    const dt  = ev.start.dateTime ?? ev.start.date ?? ''
    const day = dt.slice(0, 10)
    if (!groups[day]) groups[day] = []
    groups[day].push(ev)
  }
  return groups
}

export default function CalendarPage() {
  const [connected, setConnected]     = useState<boolean | null>(null)
  const [provider, setProvider]       = useState<string>('none')
  const [dentsoftPending, setDentsoftPending] = useState(false)
  const [events, setEvents]           = useState<GCalEvent[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [form, setForm]               = useState<NewEventForm>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')
  const [leads, setLeads]             = useState<Lead[]>([])
  const [leadSearch, setLeadSearch]   = useState('')
  const [leadsLoading, setLeadsLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/calendar/events')
      const data = await res.json()
      setConnected(data.connected ?? false)
      setProvider(data.provider ?? 'none')
      setDentsoftPending(data.dentsoft_pending ?? false)
      setEvents(data.events ?? [])
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
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
      // Filter via contacts full_name — use ilike on a joined column isn't directly possible
      // so we do a contacts search first
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

  useEffect(() => { load() }, [])

  // Load leads when modal opens
  useEffect(() => {
    if (showModal) loadLeads()
  }, [showModal])

  useEffect(() => {
    if (!showModal) return
    const t = setTimeout(() => loadLeads(leadSearch), 300)
    return () => clearTimeout(t)
  }, [leadSearch, showModal])

  async function createEvent() {
    if (!form.title || !form.date || !form.startTime || !form.endTime) {
      setFormError('Başlık, tarih ve saatler zorunlu')
      return
    }
    setSaving(true)
    setFormError('')
    const startDateTime = `${form.date}T${form.startTime}:00`
    const endDateTime   = `${form.date}T${form.endTime}:00`

    const body: Record<string, string | undefined> = {
      title: form.title,
      startDateTime,
      endDateTime,
      description:   form.description || undefined,
      attendeeEmail: form.attendeeEmail || undefined,
    }
    if (form.leadId) body.description = [form.description, `[stoaix:lead_id:${form.leadId}]`].filter(Boolean).join('\n')

    const res  = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error ?? 'Oluşturulamadı'); setSaving(false); return }
    setShowModal(false)
    setForm(EMPTY_FORM)
    setLeadSearch('')
    load()
    setSaving(false)
  }

  // Extract lead_id from event description if stored
  function getLeadIdFromEvent(ev: GCalEvent): string | null {
    const desc = ev.description ?? ''
    const match = desc.match(/\[stoaix:lead_id:([a-f0-9-]{36})\]/i)
    return match ? match[1] : null
  }

  const grouped    = groupByDate(events)
  const selectedLead = leads.find(l => l.id === form.leadId)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar size={22} className="text-brand-600" />
          <h1 className="text-xl font-semibold text-slate-800">Takvim</h1>
          {connected && provider && provider !== 'none' && (
            <span className="text-xs bg-brand-50 text-brand-600 border border-brand-100 px-2 py-0.5 rounded-full font-medium capitalize">
              {provider === 'google' ? 'Google Takvim' : provider}
            </span>
          )}
        </div>
        {connected && provider === 'google' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus size={15} />
            Yeni Randevu
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      ) : !connected ? (
        /* Not connected */
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Calendar size={40} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-1">Takvim henüz bağlı değil</p>
          <p className="text-sm text-slate-400 mb-5">
            Randevu özelliğini kullanmak için Google Takvim veya Dentsoft bağlayın.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Takvimi Bağla
            <ChevronRight size={15} />
          </Link>
        </div>
      ) : dentsoftPending ? (
        /* Dentsoft — not yet implemented */
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Calendar size={40} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-1">Dentsoft Takvim</p>
          <p className="text-sm text-slate-400 mb-5">
            Dentsoft takvim entegrasyonu geliştirme aşamasındadır. API bağlantısı kurulduktan sonra randevular burada görünecek.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-brand-600 text-sm font-medium hover:underline"
          >
            Entegrasyon Ayarları
            <ChevronRight size={15} />
          </Link>
        </div>
      ) : events.length === 0 ? (
        /* Connected but no events */
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Calendar size={40} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-1">Yaklaşan randevu yok</p>
          <p className="text-sm text-slate-400 mb-5">Yeni bir randevu oluşturmak için butona tıklayın.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus size={15} />
            Yeni Randevu
          </button>
        </div>
      ) : (
        /* Events list grouped by date */
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayEvents]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                {formatDate(day + 'T00:00:00')}
              </p>
              <div className="space-y-2">
                {dayEvents.map(ev => {
                  const leadId = getLeadIdFromEvent(ev)
                  return (
                    <div key={ev.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-start gap-4 hover:border-brand-200 transition-colors">
                      <div className="mt-0.5 w-1 h-12 rounded-full bg-brand-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{ev.summary ?? '(Başlıksız)'}</p>
                        {ev.start.dateTime && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                            <Clock size={13} />
                            {formatTime(ev.start.dateTime)}
                            {ev.end.dateTime && ` — ${formatTime(ev.end.dateTime)}`}
                          </div>
                        )}
                        {ev.attendees && ev.attendees.length > 0 && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-0.5">
                            <User size={13} />
                            {ev.attendees.map(a => a.displayName ?? a.email).join(', ')}
                          </div>
                        )}
                        {ev.description && !ev.description.includes('lead_id:') && (
                          <p className="text-sm text-slate-400 mt-1 truncate">{ev.description}</p>
                        )}
                        {leadId && (
                          <Link href={`/dashboard/leads/${leadId}`}
                            className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 mt-1 transition-colors">
                            <Link2 size={11} />
                            Lead detayı
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 shrink-0">
                        {ev.htmlLink && (
                          <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                            className="text-slate-300 hover:text-brand-500 transition-colors">
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Yeni Randevu</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(''); setLeadSearch('') }}
                className="text-slate-400 hover:text-slate-600">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Katılımcı e-posta</label>
                <input
                  type="email"
                  value={form.attendeeEmail}
                  onChange={e => setForm(f => ({ ...f, attendeeEmail: e.target.value }))}
                  placeholder="ornek@gmail.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="İsteğe bağlı not..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-500 mt-3">{formError}</p>}

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(''); setLeadSearch('') }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                İptal
              </button>
              <button
                onClick={createEvent}
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
