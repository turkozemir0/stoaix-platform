'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Phone, MessageSquare, Flame, Target, Loader2, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import KanbanBoard from './KanbanBoard'

type LeadStatus = 'new' | 'in_progress' | 'handed_off' | 'nurturing' | 'qualified' | 'converted' | 'lost'

interface Lead {
  id: string
  qualification_score: number
  status: LeadStatus
  source_channel: string
  collected_data: Record<string, any>
  updated_at: string
  contact_id: string
  contacts: {
    phone: string | null
    full_name: string | null
    source_channel: string
  } | null
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new:          'Yeni',
  in_progress:  'Aktif',
  handed_off:   'Temsilci Talep',
  nurturing:    'Takipte',
  qualified:    'Randevu',
  converted:    'Dönüştü',
  lost:         'Kaybedildi',
}

const STATUS_COLOR: Record<LeadStatus, string> = {
  new:         'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-blue-700',
  handed_off:  'bg-amber-50 text-amber-700',
  nurturing:   'bg-purple-50 text-purple-700',
  qualified:   'bg-green-50 text-green-700',
  converted:   'bg-emerald-50 text-emerald-700',
  lost:        'bg-red-50 text-red-500',
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-red-500 text-white' :
    score >= 60 ? 'bg-orange-400 text-white' :
    score >= 40 ? 'bg-amber-400 text-white' :
                  'bg-slate-200 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {score >= 70 && <Flame size={10} />}
      {score}
    </span>
  )
}

type FilterStatus = 'all' | 'handed_off' | 'in_progress' | 'new'

const PAGE_SIZE = 100

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState({ all: 0, new: 0, handed_off: 0, in_progress: 0 })
  const [orgId, setOrgId] = useState<string | null>(null)

  // Load org once
  useEffect(() => {
    async function loadOrg() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: orgUser } = await supabase
        .from('org_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (orgUser) setOrgId(orgUser.organization_id)
    }
    loadOrg()
  }, [])

  // Load status counts (separate lightweight queries)
  useEffect(() => {
    if (!orgId) return
    async function loadCounts() {
      const supabase = createClient()
      const base = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!)
      const [all, newC, handedOff, inProgress] = await Promise.all([
        base,
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!).eq('status', 'new'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!).eq('status', 'handed_off'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!).eq('status', 'in_progress'),
      ])
      setStatusCounts({
        all:         all.count ?? 0,
        new:         newC.count ?? 0,
        handed_off:  handedOff.count ?? 0,
        in_progress: inProgress.count ?? 0,
      })
    }
    loadCounts()
  }, [orgId])

  // Load page of leads
  const loadLeads = useCallback(async (orgId: string, filter: FilterStatus, page: number) => {
    setLoading(true)
    const supabase = createClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('leads')
      .select('id,qualification_score,status,source_channel,collected_data,updated_at,contact_id,contacts(phone,full_name,source_channel)', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('qualification_score', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (filter !== 'all') query = query.eq('status', filter)

    const { data, count } = await query
    setLeads((data as unknown as Lead[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!orgId) return
    loadLeads(orgId, filter, page)
  }, [orgId, filter, page, loadLeads])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handleFilter(f: FilterStatus) {
    setFilter(f)
    setPage(0)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Target size={22} className="text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Leads</h1>
            <p className="text-sm text-slate-500">{statusCounts.all} kayıt</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List size={14} />
            Tablo
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        orgId ? <KanbanBoard orgId={orgId} /> : null
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {([
              ['all', 'Tümü'],
              ['new', 'Yeni'],
              ['handed_off', 'Temsilci Talep'],
              ['in_progress', 'Aktif'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-brand-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
                <span className={`ml-1.5 text-xs ${filter === key ? 'text-brand-200' : 'text-slate-400'}`}>
                  {statusCounts[key]}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
              <Loader2 size={16} className="animate-spin" /> Yükleniyor...
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Target size={32} className="mx-auto mb-3 opacity-40" />
              <p>Bu kriterde lead yok.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-3">Kişi</th>
                      <th className="text-left px-4 py-3">Telefon</th>
                      <th className="text-left px-4 py-3">Skor</th>
                      <th className="text-left px-4 py-3">Durum</th>
                      <th className="text-left px-4 py-3">Son Aktiv.</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => {
                      const name = lead.collected_data?.full_name || lead.contacts?.full_name
                      const channel = lead.source_channel
                      const phone = lead.contacts?.phone || (lead.collected_data?.phone as string)
                      const updatedAt = new Date(lead.updated_at).toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                channel === 'whatsapp' ? 'bg-green-100 text-green-600' :
                                channel === 'instagram' ? 'bg-pink-100 text-pink-600' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {channel === 'whatsapp' ? 'W' : channel === 'instagram' ? 'IG' : '?'}
                              </span>
                              <span className="font-medium text-slate-800">
                                {name || <span className="text-slate-400 font-normal">İsimsiz</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {phone ? (
                              <a href={`tel:${phone}`} className="font-mono text-sm text-slate-800 hover:text-brand-600">
                                {phone}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ScoreBadge score={lead.qualification_score} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[lead.status]}`}>
                              {STATUS_LABEL[lead.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{updatedAt}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              {phone && (
                                <a
                                  href={`tel:${phone}`}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
                                >
                                  <Phone size={12} />
                                  Ara
                                </a>
                              )}
                              <Link
                                href={`/dashboard/leads/${lead.id}`}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                              >
                                <MessageSquare size={12} />
                                Detay
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-slate-500">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total} kayıt
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={14} />
                      Önceki
                    </button>
                    <span className="text-sm text-slate-500 px-2">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Sonraki
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
