'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Loader2, ChevronRight, Clock, User, X, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface GCalEvent {
  id: string
  summary?: string
  description?: string
  start:  { dateTime?: string; date?: string }
  end:    { dateTime?: string; date?: string }
  attendees?: { email: string; displayName?: string; responseStatus?: string }[]
  htmlLink?: string
  status?: string
}

interface NewEventForm {
  title: string
  date: string
  startTime: string
  endTime: string
  attendeeEmail: string
  description: string
}

const EMPTY_FORM: NewEventForm = { title: '', date: '', startTime: '09:00', endTime: '10:00', attendeeEmail: '', description: '' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}
function groupByDate(events: GCalEvent[]) {
  const groups: Record<string, GCalEvent[]> = {}
  for (const ev of events) {
    const dt = ev.start.dateTime ?? ev.start.date ?? ''
    const day = dt.slice(0, 10)
    if (!groups[day]) groups[day] = []
    groups[day].push(ev)
  }
  return groups
}

export default function CalendarPage() {
  const [connected, setConnected]   = useState<boolean | null>(null)
  const [events, setEvents]         = useState<GCalEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState<NewEventForm>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/calendar/events')
    const data = await res.json()
    setConnected(data.connected ?? false)
    setEvents(data.events ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createEvent() {
    if (!form.title || !form.date || !form.startTime || !form.endTime) {
      setFormError('Başlık, tarih ve saatler zorunlu')
      return
    }
    setSaving(true)
    setFormError('')
    const startDateTime = `${form.date}T${form.startTime}:00`
    const endDateTime   = `${form.date}T${form.endTime}:00`
    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:         form.title,
        startDateTime,
        endDateTime,
        description:   form.description || undefined,
        attendeeEmail: form.attendeeEmail || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error ?? 'Oluşturulamadı'); setSaving(false); return }
    setShowModal(false)
    setForm(EMPTY_FORM)
    load()
    setSaving(false)
  }

  const grouped = groupByDate(events)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar size={22} className="text-brand-600" />
          <h1 className="text-xl font-semibold text-slate-800">Takvim</h1>
        </div>
        {connected && (
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
          <p className="text-sm text-slate-400 mb-5">Randevu özelliğini kullanmak için Google Takviminizi bağlayın.</p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Takvimi Bağla
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
                {dayEvents.map(ev => (
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
                      {ev.description && (
                        <p className="text-sm text-slate-400 mt-1 truncate">{ev.description}</p>
                      )}
                    </div>
                    {ev.htmlLink && (
                      <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-brand-500 transition-colors mt-1 shrink-0">
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Yeni Randevu</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError('') }}
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
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError('') }}
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
