'use client'

import { useState, useEffect } from 'react'
import {
  Rocket, ChevronDown, ChevronUp, Settings,
  MessageCircle, Instagram, Phone, PhoneOutgoing, Calendar,
  AlertTriangle, CheckCircle2, Plug, Check,
} from 'lucide-react'
import Link from 'next/link'
import SetupStep from './SetupStep'

/* ── Types ──────────────────────────────────────────────── */

interface SetupStatus {
  business_info_complete: boolean
  has_kb_items: boolean
  has_channel: boolean
  has_playbook: boolean
  has_conversation: boolean
  kb_count: number
}

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

/* ── Constants ──────────────────────────────────────────── */

const STORAGE_KEY = 'setup_banner_v2'
const CONTENT_ID = 'dashboard-main-content'

const CHANNEL_META: Record<string, { label: string; shortLabel: string; icon: React.ReactNode }> = {
  whatsapp:       { label: 'WhatsApp',     shortLabel: 'WA',    icon: <MessageCircle size={14} className="text-green-500" /> },
  instagram:      { label: 'Instagram',    shortLabel: 'IG',    icon: <Instagram size={14} className="text-pink-500" /> },
  voice_inbound:  { label: 'Ses (Gelen)',  shortLabel: 'Ses(G)', icon: <Phone size={14} className="text-blue-500" /> },
  voice_outbound: { label: 'Ses (Giden)',  shortLabel: 'Ses(Ç)', icon: <PhoneOutgoing size={14} className="text-indigo-500" /> },
  calendar:       { label: 'Takvim',       shortLabel: 'Takvim', icon: <Calendar size={14} className="text-brand-600" /> },
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

/* ── Component ──────────────────────────────────────────── */

export default function SetupCommandCenter() {
  const [activeTab, setActiveTab] = useState<'setup' | 'integrations'>('setup')
  const [collapsed, setCollapsed] = useState(false)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loaded, setLoaded] = useState(false)

  const completedCount = setupStatus
    ? [setupStatus.business_info_complete, setupStatus.has_kb_items, setupStatus.has_channel, setupStatus.has_playbook, setupStatus.has_conversation].filter(Boolean).length
    : 0
  const isSetupComplete = completedCount === 5
  const isIncomplete = completedCount < 5
  const percent = Math.round((completedCount / 5) * 100)

  const activeChannelCount = healthData
    ? Object.values(healthData.channels).filter(c => c.status === 'connected').length
    : 0

  /* ── Fetch ── */
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'collapsed') setCollapsed(true)

    Promise.all([
      fetch('/api/setup-status').then(r => (r.ok ? r.json() : null)),
      fetch('/api/integration-health').then(r => (r.ok ? r.json() : null)),
    ])
      .then(([setup, health]) => {
        setSetupStatus(setup)
        setHealthData(health)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  /* ── Blur effect ── */
  useEffect(() => {
    if (!loaded || !setupStatus) return
    const el = document.getElementById(CONTENT_ID)
    if (!el) return

    const shouldBlur = isIncomplete && !collapsed
    el.classList.toggle('blur-sm', shouldBlur)
    el.classList.toggle('opacity-60', shouldBlur)
    el.classList.toggle('pointer-events-none', shouldBlur)
    el.classList.toggle('select-none', shouldBlur)

    return () => {
      el.classList.remove('blur-sm', 'opacity-60', 'pointer-events-none', 'select-none')
    }
  }, [loaded, isIncomplete, collapsed, setupStatus])

  /* ── Loading skeleton ── */
  if (!loaded) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
          <div className="h-4 bg-slate-100 rounded w-40" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (!setupStatus || !healthData) return null

  /* ── Helpers ── */
  const handleCollapse = () => {
    setCollapsed(true)
    localStorage.setItem(STORAGE_KEY, 'collapsed')
  }

  const handleExpand = () => {
    setCollapsed(false)
    localStorage.removeItem(STORAGE_KEY)
  }

  const channelEntries = Object.entries(CHANNEL_META).map(([key, meta]) => ({
    key,
    ...meta,
    health: healthData.channels[key] ?? { status: 'not_configured' as ChannelStatus, detail: null },
  }))

  const workflowSummary = healthData.blocked_workflow_count > 0
    ? `${healthData.blocked_workflow_count} iş akışı bekliyor`
    : healthData.active_workflow_count > 0
    ? `${healthData.active_workflow_count} iş akışı aktif`
    : null

  /* ── Durum B: Setup tamamlandı → compact health card ── */
  if (isSetupComplete) {
    const hasIssues = healthData.blocked_workflow_count > 0

    return (
      <div className={`bg-white rounded-xl border ${hasIssues ? 'border-amber-200' : 'border-slate-200'} shadow-sm overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900">Sistem Durumu</h3>
          </div>
          <Link
            href="/dashboard/settings"
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Ayarlar
          </Link>
        </div>

        <div className="px-5 pb-4">
          {/* Channel status row */}
          <div className="flex flex-wrap gap-3 mb-3">
            {channelEntries.map(({ key, shortLabel, icon, health }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[health.status]}`} />
                {icon}
                <span className="text-xs text-slate-600 font-medium">{shortLabel}</span>
              </div>
            ))}
          </div>

          {/* Workflow summary */}
          {hasIssues ? (
            <div className="pt-3 border-t border-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">
                    {healthData.blocked_workflow_count} iş akışı eksik entegrasyon nedeniyle çalışamaz
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {healthData.blocked_workflows.map((bw, i) => (
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
          ) : healthData.active_workflow_count > 0 ? (
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="text-xs text-slate-500">
                {healthData.active_workflow_count} aktif iş akışı sorunsuz çalışıyor
              </span>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  /* ── Collapsed mini banner ── */
  if (collapsed) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Komuta Merkezi — {completedCount}/5 adım tamamlandı
          </span>
          {healthData && (
            <span className="text-xs text-amber-600 ml-1">
              · {activeChannelCount}/5 kanal aktif
            </span>
          )}
        </div>
        <button
          onClick={handleExpand}
          className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Göster
        </button>
      </div>
    )
  }

  /* ── Durum A: Setup tamamlanmamış → tabbed full card ── */

  const completedSteps = [
    { key: 'business', done: setupStatus.business_info_complete, label: 'İşletme Profili' },
    { key: 'kb', done: setupStatus.has_kb_items, label: 'Bilgi Bankası' },
    { key: 'channel', done: setupStatus.has_channel, label: 'Kanal Bağlı' },
    { key: 'playbook', done: setupStatus.has_playbook, label: 'AI Asistanı' },
    { key: 'conversation', done: setupStatus.has_conversation, label: 'İlk Konuşma' },
  ].filter(s => s.done)

  const incompleteSteps = [
    {
      key: 'business', done: setupStatus.business_info_complete,
      step: 1, title: 'İşletme Profilini Tamamla',
      description: 'Telefon, e-posta ve şehir bilgilerini ekle',
      cta: { label: 'Ayarlara Git', href: '/dashboard/settings' },
    },
    {
      key: 'kb', done: setupStatus.has_kb_items,
      step: 2, title: 'Bilgi Bankası Oluştur',
      description: setupStatus.has_kb_items ? `${setupStatus.kb_count} içerik eklendi` : 'Web siteni tara veya bilgileri manuel ekle',
      cta: { label: 'KB Oluştur', href: '/dashboard/knowledge' },
    },
    {
      key: 'channel', done: setupStatus.has_channel,
      step: 3, title: 'Kanal Bağla',
      description: 'WhatsApp, Instagram veya ses kanalını aktif et',
      cta: { label: 'Entegrasyonlar', href: '/dashboard/integrations' },
    },
    {
      key: 'playbook', done: setupStatus.has_playbook,
      step: 4, title: 'AI Asistanını Kur',
      description: 'Şablon seç, asistan adını ve davranışını belirle',
      cta: { label: 'AI Asistanı', href: '/dashboard/agent' },
    },
    {
      key: 'conversation', done: setupStatus.has_conversation,
      step: 5, title: 'İlk Konuşmayı Bekle',
      description: 'Kanal bağlandığında AI asistanınız otomatik olarak konuşmalara başlayacak',
    },
  ].filter(s => !s.done)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-brand-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Komuta Merkezi</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500">%{percent}</span>
          </div>
          <button
            onClick={handleCollapse}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
          >
            Daha Sonra
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('setup')}
          className={`px-5 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === 'setup'
              ? 'text-brand-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Kurulum
          {activeTab === 'setup' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-5 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === 'integrations'
              ? 'text-brand-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Entegrasyonlar
          {healthData.blocked_workflow_count > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
              {healthData.blocked_workflow_count}
            </span>
          )}
          {activeTab === 'integrations' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t" />
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'setup' ? (
        <div className="px-5 py-4">
          {/* Completed steps as badges */}
          {completedSteps.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {completedSteps.map(s => (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full"
                >
                  <Check className="w-3 h-3" />
                  {s.label}
                </span>
              ))}
            </div>
          )}

          {/* Incomplete steps */}
          <div className="divide-y divide-slate-50">
            {incompleteSteps.map(s => (
              <div key={s.key} className="flex items-center gap-4 py-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold bg-slate-100 text-slate-500">
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                    {/* Mini channel dots for "Kanal Bağla" step */}
                    {s.key === 'channel' && (
                      <div className="flex items-center gap-1.5 ml-1">
                        {channelEntries.slice(0, 3).map(({ key, shortLabel, health }) => (
                          <span
                            key={key}
                            className="inline-flex items-center gap-0.5 text-[10px] text-slate-400"
                            title={`${shortLabel}: ${STATUS_LABEL[health.status]}`}
                          >
                            {shortLabel}
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[health.status]}`} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                </div>
                {s.cta ? (
                  <Link
                    href={s.cta.href}
                    className="flex-shrink-0 text-xs font-medium px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors whitespace-nowrap"
                  >
                    {s.cta.label}
                  </Link>
                ) : (
                  <span className="flex-shrink-0 text-xs text-slate-400 italic whitespace-nowrap">
                    Kanal bağlandıktan sonra
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Integration summary line */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <Plug size={12} className="text-slate-400" />
            <span>
              {activeChannelCount}/5 kanal aktif
              {workflowSummary && <> · {workflowSummary}</>}
            </span>
            <button
              onClick={() => setActiveTab('integrations')}
              className="ml-auto text-brand-600 hover:text-brand-700 font-medium"
            >
              Detaylar →
            </button>
          </div>
        </div>
      ) : (
        /* Entegrasyonlar Tab */
        <div className="px-5 py-4">
          {/* Channel grid */}
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

          {/* Go to integrations page */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {activeChannelCount}/5 kanal bağlı
            </span>
            <Link
              href="/dashboard/integrations"
              className="text-xs font-medium px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              Entegrasyonları Yönet →
            </Link>
          </div>

          {/* Blocked workflows warning */}
          {healthData.blocked_workflow_count > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">
                    {healthData.blocked_workflow_count} iş akışı eksik entegrasyon nedeniyle çalışamaz
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {healthData.blocked_workflows.map((bw, i) => (
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

          {/* Healthy workflows */}
          {healthData.blocked_workflow_count === 0 && healthData.active_workflow_count > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="text-xs text-slate-500">
                {healthData.active_workflow_count} aktif iş akışı sorunsuz çalışıyor
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
