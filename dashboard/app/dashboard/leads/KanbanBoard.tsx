'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Flame, Search } from 'lucide-react'

type LeadStatus = 'new' | 'in_progress' | 'handed_off' | 'nurturing' | 'qualified' | 'converted' | 'lost'

interface Lead {
  id: string
  qualification_score: number
  status: LeadStatus
  source_channel: string
  collected_data: Record<string, any>
  updated_at: string
  contacts: { phone: string | null; full_name: string | null } | null
}

interface Props {
  leads: Lead[]
}

const COLUMNS: { key: LeadStatus; label: string; color: string; headerColor: string }[] = [
  { key: 'new',         label: 'Yeni',           color: 'bg-slate-50 border-slate-200',    headerColor: 'bg-slate-100 text-slate-700' },
  { key: 'in_progress', label: 'Aktif',           color: 'bg-blue-50 border-blue-100',      headerColor: 'bg-blue-100 text-blue-700' },
  { key: 'handed_off',  label: 'Temsilci Talep',  color: 'bg-amber-50 border-amber-100',    headerColor: 'bg-amber-100 text-amber-700' },
  { key: 'nurturing',   label: 'Takipte',         color: 'bg-purple-50 border-purple-100',  headerColor: 'bg-purple-100 text-purple-700' },
  { key: 'qualified',   label: 'Randevu',         color: 'bg-green-50 border-green-100',    headerColor: 'bg-green-100 text-green-700' },
  { key: 'converted',   label: 'Dönüştü',         color: 'bg-emerald-50 border-emerald-100',headerColor: 'bg-emerald-100 text-emerald-700' },
  { key: 'lost',        label: 'Kaybedildi',      color: 'bg-red-50 border-red-100',        headerColor: 'bg-red-100 text-red-700' },
]

const PAGE_SIZE = 30

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-red-500 text-white' :
    score >= 60 ? 'bg-orange-400 text-white' :
    score >= 40 ? 'bg-amber-400 text-white' :
                  'bg-slate-200 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
      {score >= 70 && <Flame size={8} />}
      {score}
    </span>
  )
}

export default function KanbanBoard({ leads: initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [searches, setSearches] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function moveToStatus(leadId: string, newStatus: LeadStatus) {
    setMovingId(leadId)
    const res = await fetch(`/api/leads/${leadId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    }
    setMovingId(null)
  }

  function setSearch(colKey: string, val: string) {
    setSearches(prev => ({ ...prev, [colKey]: val }))
    // Arama değişince sayfa sıfırla
    setExpanded(prev => ({ ...prev, [colKey]: false }))
  }

  const byStatus = COLUMNS.reduce<Record<string, Lead[]>>((acc, col) => {
    const q = (searches[col.key] ?? '').toLowerCase().trim()
    const all = leads.filter(l => l.status === col.key)
    if (!q) { acc[col.key] = all; return acc }

    acc[col.key] = all.filter(l => {
      const name = (l.collected_data?.full_name || l.contacts?.full_name || '').toLowerCase()
      const phone = (l.contacts?.phone || l.collected_data?.phone || '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
    return acc
  }, {})

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const filtered = byStatus[col.key] ?? []
        const total = leads.filter(l => l.status === col.key).length
        const isExpanded = expanded[col.key]
        const visible = isExpanded ? filtered : filtered.slice(0, PAGE_SIZE)
        const hiddenCount = filtered.length - PAGE_SIZE

        return (
          <div key={col.key} className="flex-shrink-0 w-64">
            {/* Column header */}
            <div className={`rounded-t-xl px-3 pt-2.5 pb-1.5 ${col.headerColor}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">{col.label}</span>
                <span className="text-xs font-bold opacity-70">
                  {searches[col.key] ? `${filtered.length} / ${total}` : total}
                </span>
              </div>
              {/* Per-column search */}
              <div className="relative">
                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  value={searches[col.key] ?? ''}
                  onChange={e => setSearch(col.key, e.target.value)}
                  placeholder="İsim veya telefon..."
                  className="w-full pl-5 pr-2 py-1 text-[10px] rounded-lg bg-white/60 border border-black/10 focus:outline-none focus:bg-white placeholder:opacity-50"
                />
              </div>
            </div>

            {/* Cards */}
            <div className={`rounded-b-xl border ${col.color} min-h-[200px] p-2 space-y-2`}>
              {visible.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-6">
                  {searches[col.key] ? 'Eşleşme yok' : 'Lead yok'}
                </p>
              )}

              {visible.map(lead => {
                const name = lead.collected_data?.full_name || lead.contacts?.full_name
                const phone = lead.contacts?.phone || lead.collected_data?.phone
                const isMoving = movingId === lead.id

                return (
                  <div
                    key={lead.id}
                    className={`bg-white rounded-xl border border-slate-100 p-3 shadow-sm transition-opacity ${isMoving ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <p className="text-xs font-medium text-slate-800 truncate flex-1">
                        {name || <span className="text-slate-400">İsimsiz</span>}
                      </p>
                      <ScoreBadge score={lead.qualification_score} />
                    </div>

                    {phone && (
                      <p className="text-[11px] text-slate-500 font-mono mb-2 truncate">{phone}</p>
                    )}

                    <div className="flex items-center gap-1 mb-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        lead.source_channel === 'whatsapp' ? 'bg-green-100 text-green-700' :
                        lead.source_channel === 'instagram' ? 'bg-pink-100 text-pink-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {lead.source_channel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-50">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="flex-1 text-center text-[10px] text-brand-600 hover:text-brand-700 font-medium py-1 rounded hover:bg-brand-50 transition-colors"
                      >
                        Detay
                      </Link>
                      <select
                        value={lead.status}
                        onChange={e => moveToStatus(lead.id, e.target.value as LeadStatus)}
                        disabled={isMoving}
                        className="text-[10px] border border-slate-200 rounded px-1 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
                      >
                        {COLUMNS.map(c => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}

              {/* "Daha fazla göster" */}
              {!isExpanded && hiddenCount > 0 && (
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [col.key]: true }))}
                  className="w-full text-[11px] text-slate-500 hover:text-slate-700 py-2 border border-dashed border-slate-200 rounded-xl hover:bg-white transition-colors"
                >
                  + {hiddenCount} kişi daha
                </button>
              )}
              {isExpanded && filtered.length > PAGE_SIZE && (
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [col.key]: false }))}
                  className="w-full text-[11px] text-slate-400 hover:text-slate-600 py-2 transition-colors"
                >
                  Küçült
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
