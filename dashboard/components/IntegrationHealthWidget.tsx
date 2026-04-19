'use client'

import { useState, useEffect } from 'react'
import {
  MessageCircle, Instagram, Phone, PhoneOutgoing, Calendar,
  AlertTriangle, CheckCircle2, MinusCircle, Loader2, Plug,
} from 'lucide-react'
import Link from 'next/link'

type ChannelStatus = 'connected' | 'missing_config' | 'not_configured' | 'token_expired'

interface ChannelHealth {
  status: ChannelStatus
  detail: string | null
}

interface HealthData {
  channels: Record<string, ChannelHealth>
  active_workflow_count: number
  blocked_workflow_count: number
  blocked_workflows: Array<{ name: string; missing: string[] }>
}

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  whatsapp:       { label: 'WhatsApp',     icon: <MessageCircle size={14} className="text-green-500" /> },
  instagram:      { label: 'Instagram',    icon: <Instagram size={14} className="text-pink-500" /> },
  voice_inbound:  { label: 'Ses (Gelen)',  icon: <Phone size={14} className="text-blue-500" /> },
  voice_outbound: { label: 'Ses (Giden)',  icon: <PhoneOutgoing size={14} className="text-indigo-500" /> },
  calendar:       { label: 'Takvim',       icon: <Calendar size={14} className="text-brand-600" /> },
}

const STATUS_DOT: Record<ChannelStatus, string> = {
  connected:      'bg-emerald-500',
  missing_config: 'bg-amber-400',
  not_configured: 'bg-slate-300',
  token_expired:  'bg-red-400',
}

const STATUS_LABEL: Record<ChannelStatus, string> = {
  connected:      'Bağlı',
  missing_config: 'Eksik yapılandırma',
  not_configured: 'Yapılandırılmamış',
  token_expired:  'Token süresi dolmuş',
}

export default function IntegrationHealthWidget() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/integration-health')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-slate-100" />
          <div className="h-3 bg-slate-100 rounded w-36" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const channelEntries = Object.entries(CHANNEL_META)
    .map(([key, meta]) => ({
      key,
      ...meta,
      health: data.channels[key] ?? { status: 'not_configured' as ChannelStatus, detail: null },
    }))

  const hasIssues = data.blocked_workflow_count > 0

  return (
    <div className={`bg-white rounded-xl border ${hasIssues ? 'border-amber-200' : 'border-slate-200'} p-5 mb-6`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Plug size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Entegrasyon Durumu</h3>
        </div>
        <Link
          href="/dashboard/integrations"
          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          Ayarlar
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {channelEntries.map(({ key, label, icon, health }) => (
          <div key={key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50">
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[health.status]}`} />
            <span className="shrink-0">{icon}</span>
            <span className="text-xs text-slate-700 font-medium">{label}</span>
            <span className="text-xs text-slate-400 truncate ml-auto">
              {health.detail ?? STATUS_LABEL[health.status]}
            </span>
          </div>
        ))}
      </div>

      {hasIssues && (
        <div className="mt-3 pt-3 border-t border-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-amber-700 font-medium">
                {data.blocked_workflow_count} iş akışı eksik entegrasyon nedeniyle çalışamaz
              </p>
              <ul className="mt-1 space-y-0.5">
                {data.blocked_workflows.map((bw, i) => (
                  <li key={i} className="text-xs text-amber-600">
                    {bw.name} — {bw.missing.join(', ')} gerekli
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/workflows"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-amber-700 hover:text-amber-800 font-medium"
              >
                İş akışlarını gör
              </Link>
            </div>
          </div>
        </div>
      )}

      {!hasIssues && data.active_workflow_count > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span className="text-xs text-slate-500">
            {data.active_workflow_count} aktif iş akışı sorunsuz çalışıyor
          </span>
        </div>
      )}
    </div>
  )
}
