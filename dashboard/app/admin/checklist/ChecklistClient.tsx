'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Org {
  id: string
  name: string
  slug: string
  sector: string
  status: string
}

interface CheckItem {
  id: string
  label: string
  note?: string
  code?: string
  voiceOnly?: boolean
}

interface Phase {
  title: string
  items: CheckItem[]
}

// ─── Checklist Definition ─────────────────────────────────────────────────────

const PHASES: Phase[] = [
  {
    title: '1 — Platform Kurulumu',
    items: [
      { id: 'p1', label: 'Admin panelinden "Yeni Müşteri Ekle" yapıldı → org + invite token oluşturuldu' },
      { id: 'p2', label: 'Müşteri invite link ile register oldu' },
      { id: 'p3', label: 'Müşteri onboarding\'i tamamladı (işletme bilgileri, hizmetler, SSS, ek bilgiler)' },
      {
        id: 'p4',
        label: 'Agent Playbook kontrol edildi / AI persona güncellendi',
        note: 'Dashboard → AI Asistan → Chat sekmesinden sistem promptu ve persona ayarla',
      },
    ],
  },
  {
    title: '2 — GHL Kurulumu',
    items: [
      { id: 'g1', label: 'GHL\'de müşteri için yeni sub-account açıldı' },
      {
        id: 'g2',
        label: 'GHL Snapshot import edildi (7 aşamalı pipeline + inbound webhook workflow)',
        note: 'GHL → Settings → Snapshots → "stoaix Standart" snapshot\'ı import et',
      },
      {
        id: 'g3',
        label: 'WhatsApp Business hesabı GHL sub-account\'a QR ile bağlandı',
        note: 'GHL → Settings → Integrations → WhatsApp → QR kodunu müşteriye gönder',
      },
      { id: 'g4', label: 'Instagram hesabı bağlandı (opsiyonel)' },
      {
        id: 'g5',
        label: 'crm_config Supabase\'e girildi (location_id, pit_token, pipeline_id, stage_mapping)',
        note: 'GHL → Settings → Business Profile → Location ID\nGHL → Settings → Integrations → Private Integration Token',
        code: `UPDATE public.organizations
SET crm_config = '{
  "provider":     "ghl",
  "location_id":  "GHL_LOCATION_ID",
  "pit_token":    "GHL_PIT_TOKEN",
  "pipeline_id":  "GHL_PIPELINE_ID",
  "stage_mapping": {
    "ai_qualifying":      "STAGE_ID_AI_QUALIFYING",
    "nurturing":          "STAGE_ID_NURTURING",
    "appointment_booked": "STAGE_ID_APPOINTMENT",
    "won":                "STAGE_ID_WON",
    "lost":               "STAGE_ID_LOST"
  }
}'::jsonb
WHERE id = 'ORG_ID_BURAYA';`,
      },
      {
        id: 'g6',
        label: 'GHL Inbound Webhook URL edge function\'a yönlendirildi',
        note: 'GHL Workflow → Trigger: "Customer Replied" → Action: Webhook POST',
        code: `https://ablntzdbsrzbqyrnfwpl.supabase.co/functions/v1/whatsapp-inbound`,
      },
      {
        id: 'g7',
        label: '✓ Test: WhatsApp\'tan mesaj gönderildi → chatbot 3–5 sn içinde yanıtladı',
        note: 'Konuşma Dashboard → Conversations\'ta görünmeli',
      },
    ],
  },
  {
    title: '3 — Follow-up & Re-engagement (n8n)',
    items: [
      {
        id: 'f1',
        label: 'n8n WF_followup_sequence "Active" durumda',
        note: 'Tek workflow tüm org\'lar için çalışıyor — zaten aktifse tekrar ayar gerekmez',
      },
      {
        id: 'f2',
        label: 'GHL Re-engagement Workflow kuruldu',
        note: 'GHL → Automations → New Workflow\nTrigger: "Tag Added" → tag = "reengagement"\nAction: Webhook POST → n8n WF_reengagement_import URL',
        code: `n8n WF_reengagement_import → "GHL Webhook" node → webhook URL'i kopyala`,
      },
      {
        id: 'f3',
        label: '✓ Test: GHL\'de bir contact\'a "reengagement" tag\'i ekle → Supabase follow_up_tasks\'ta re_contact_1 task oluştu mu?',
      },
    ],
  },
  {
    title: '4 — Voice Agent',
    items: [
      {
        id: 'v1',
        label: 'Twilio\'dan yeni telefon numarası alındı (veya müşterinin numarası aktarıldı)',
        voiceOnly: true,
      },
      {
        id: 'v2',
        label: 'LiveKit SIP Trunk\'a telefon numarası eklendi',
        note: 'LiveKit Cloud → SIP → Inbound Trunk → Number ekle',
        voiceOnly: true,
      },
      {
        id: 'v3',
        label: 'voice-agent/agent.py\'de org konfigürasyonu eklendi ve deploy edildi',
        note: 'organization_id ile yeni org route\'u tanımlandı',
        voiceOnly: true,
      },
      {
        id: 'v4',
        label: '✓ Test: Telefon numarasını ara → LiveKit agent yanıtladı, AI konuştu',
        voiceOnly: true,
      },
    ],
  },
]

// ─── Helper: copy to clipboard ────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
      title="Kopyala"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChecklistClient({ orgs }: { orgs: Org[] }) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [track, setTrack]                 = useState<'chatbot' | 'voice'>('chatbot')
  const [checked, setChecked]             = useState<Record<string, boolean>>({})
  const [expanded, setExpanded]           = useState<Record<string, boolean>>({ '0': true })

  // Load saved state from localStorage
  useEffect(() => {
    if (!selectedOrgId) return
    const key = `checklist_${selectedOrgId}_${track}`
    const saved = localStorage.getItem(key)
    setChecked(saved ? JSON.parse(saved) : {})
  }, [selectedOrgId, track])

  // Save to localStorage on change
  function toggle(itemId: string) {
    const next = { ...checked, [itemId]: !checked[itemId] }
    setChecked(next)
    if (selectedOrgId) {
      localStorage.setItem(`checklist_${selectedOrgId}_${track}`, JSON.stringify(next))
    }
  }

  function togglePhase(idx: number) {
    setExpanded(p => ({ ...p, [idx]: !p[idx] }))
  }

  // Progress
  const visiblePhases = track === 'voice' ? PHASES : PHASES.slice(0, 3)
  const allItems = visiblePhases.flatMap(ph =>
    ph.items.filter(item => track === 'voice' || !item.voiceOnly)
  )
  const doneCount  = allItems.filter(item => checked[item.id]).length
  const totalCount = allItems.length
  const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const selectedOrg = orgs.find(o => o.id === selectedOrgId)

  return (
    <div className="p-6 max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Yeni Müşteri Kurulum Checklist</h1>
        <p className="text-sm text-slate-500 mt-0.5">Her yeni müşteri için bu adımları sırayla tamamla</p>
      </div>

      {/* Org + Track selector */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</label>
          <select
            value={selectedOrgId}
            onChange={e => setSelectedOrgId(e.target.value)}
            className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— Müşteri seç —</option>
            {orgs.map(org => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.sector})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paket</label>
          <div className="flex gap-2 mt-1.5">
            {(['chatbot', 'voice'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTrack(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  track === t
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {t === 'chatbot' ? '💬 Chatbot' : '💬 Chatbot + 🎙 Voice'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress */}
      {selectedOrgId && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">
              {selectedOrg?.name} — İlerleme
            </span>
            <span className="text-sm font-bold text-brand-600">{doneCount} / {totalCount}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{pct}% tamamlandı</p>
        </div>
      )}

      {/* Checklist Phases */}
      {visiblePhases.map((phase, phaseIdx) => {
        const phaseItems = phase.items.filter(i => track === 'voice' || !i.voiceOnly)
        const phaseDone  = phaseItems.filter(i => checked[i.id]).length
        const isOpen     = expanded[phaseIdx] !== false

        return (
          <div key={phaseIdx} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Phase header */}
            <button
              onClick={() => togglePhase(phaseIdx)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  phaseDone === phaseItems.length
                    ? 'bg-green-100 text-green-600'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {phaseDone === phaseItems.length ? '✓' : phaseIdx + 1}
                </span>
                <span className="text-sm font-semibold text-slate-800">{phase.title}</span>
                <span className="text-xs text-slate-400">{phaseDone}/{phaseItems.length}</span>
              </div>
              {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {/* Phase items */}
            {isOpen && (
              <div className="divide-y divide-slate-50 border-t border-slate-50">
                {phaseItems.map(item => (
                  <div
                    key={item.id}
                    className={`px-5 py-4 space-y-2 transition-colors ${checked[item.id] ? 'bg-green-50/40' : ''}`}
                  >
                    <button
                      onClick={() => selectedOrgId && toggle(item.id)}
                      disabled={!selectedOrgId}
                      className="flex items-start gap-3 w-full text-left group"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {checked[item.id]
                          ? <CheckCircle2 size={18} className="text-green-500" />
                          : <Circle size={18} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                        }
                      </div>
                      <span className={`text-sm ${checked[item.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {item.label}
                      </span>
                    </button>

                    {item.note && (
                      <p className="ml-7 text-xs text-slate-400 whitespace-pre-line">{item.note}</p>
                    )}

                    {item.code && (
                      <div className="ml-7">
                        <div className="relative bg-slate-900 rounded-lg p-3 pr-8">
                          <pre className="text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap">{item.code}</pre>
                          <div className="absolute top-2 right-2">
                            <CopyButton text={item.code} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Not ready warning */}
      {!selectedOrgId && (
        <div className="text-center py-4 text-sm text-slate-400">
          Üstten bir müşteri seç, checklist ona özel kaydedilir.
        </div>
      )}

      {/* System notes */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 space-y-2">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">⚠ Şu an manuel yapılan adımlar</p>
        <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
          <li><strong>crm_config</strong> — Supabase SQL Editor'dan manuel UPDATE ile giriliyor (2. fazın 5. adımı). Admin UI henüz yok.</li>
          <li><strong>Voice agent org config</strong> — voice-agent/agent.py dosyası manuel güncelleniyor ve LiveKit'e yeniden deploy ediliyor.</li>
          <li><strong>GHL Snapshot</strong> — GHL tarafında bir kez manuel import edilmesi gerekiyor. Müşteri başına tekrar yapılıyor.</li>
        </ul>
      </div>

    </div>
  )
}
