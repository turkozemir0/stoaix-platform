'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Loader2, Plus, Trash2, Bot, Sparkles, Mic, MessageSquare, ListChecks, FlaskConical, PhoneForwarded, Clock, ToggleLeft, ToggleRight, Lightbulb, ArrowUpRight, CheckCircle2, BookOpen } from 'lucide-react'
import AgentTestPanel from '@/components/agent/AgentTestPanel'

type Channel = 'voice' | 'whatsapp'
type PageTab = 'settings' | 'routing' | 'test'

interface RoutingRule {
  id: string
  type: 'kb_fallback' | 'intent' | 'topic_note' | 'sentiment_note'
  tier: 1 | 2
  active: boolean
  priority: number
  keywords?: string[]
  transition_message?: string
  after_hours_message?: string
  note_message?: string
}

interface RoutingConfig {
  transfer_numbers: { primary?: string; voice_agent?: string }
  rules: RoutingRule[]
}

interface WorkingHours {
  weekdays?: string
  saturday?: string
  sunday?: string | null
  timezone?: string
}

interface PlaybookState {
  id?: string
  systemPrompt: string
  openingMessage: string
  blocks: { keywords: string; response: string }[]
  features: { calendar_booking: boolean; voice_language?: string; tts_voice_id?: string }
}

interface IntakeField {
  key: string
  label: string
  type: string
  priority: 'must' | 'should'
  voice_prompt?: string
}

const EMPTY: PlaybookState = { systemPrompt: '', openingMessage: '', blocks: [], features: { calendar_booking: false, voice_language: '', tts_voice_id: '' } }

const VOICE_LANGUAGES = [
  { value: '',   label: 'Varsayılan (ai_persona dilinden alınır)' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'ar', label: '🇸🇦 العربية' },
  { value: 'nl', label: '🇳🇱 Nederlands' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'pt', label: '🇵🇹 Português' },
  { value: 'pl', label: '🇵🇱 Polski' },
]

interface ImprovementTip {
  id: string
  title: string
  body: string
  badge: string
  tone: 'info' | 'success' | 'warning'
  action?: { label: string; onClick: () => void }
}

const tipToneStyles: Record<ImprovementTip['tone'], string> = {
  info: 'border-sky-200 bg-sky-50/80 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50/80 text-amber-700',
}

export default function AgentPage() {
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeChannel, setActiveChannel] = useState<Channel>('voice')

  const [voice, setVoice] = useState<PlaybookState>(EMPTY)
  const [whatsapp, setWhatsapp] = useState<PlaybookState>(EMPTY)

  const [voiceIntake, setVoiceIntake]       = useState<IntakeField[]>([])
  const [whatsappIntake, setWhatsappIntake] = useState<IntakeField[]>([])
  const [voiceIntakeId, setVoiceIntakeId]   = useState<string | null>(null)
  const [waIntakeId, setWaIntakeId]         = useState<string | null>(null)

  const [suggestions, setSuggestions]             = useState<IntakeField[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())
  const [suggesting, setSuggesting]               = useState(false)
  const [savingIntake, setSavingIntake]           = useState<boolean>(false)
  const [intakeSaved, setIntakeSaved]             = useState(false)

  const [kbCount, setKbCount] = useState(0)
  const [activeTipIndex, setActiveTipIndex] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedChannel, setSavedChannel] = useState<Channel | null>(null)
  const [voiceActive, setVoiceActive] = useState(false)
  const [error, setError] = useState('')
  const [pageTab, setPageTab] = useState<PageTab>('settings')

  // Routing state
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig>({ transfer_numbers: {}, rules: [] })
  const [workingHours, setWorkingHours] = useState<WorkingHours>({ weekdays: '09:30-19:00', saturday: '10:00-17:00', sunday: null, timezone: 'Europe/Istanbul' })
  const [savingRouting, setSavingRouting] = useState(false)
  const [routingSaved, setRoutingSaved] = useState(false)

  const current = activeChannel === 'voice' ? voice : whatsapp
  const setCurrent = (fn: (prev: PlaybookState) => PlaybookState) =>
    activeChannel === 'voice' ? setVoice(fn) : setWhatsapp(fn)

  const currentIntake    = activeChannel === 'voice' ? voiceIntake : whatsappIntake
  const setCurrentIntake = activeChannel === 'voice' ? setVoiceIntake : setWhatsappIntake
  const currentIntakeId  = activeChannel === 'voice' ? voiceIntakeId : waIntakeId

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return

      let resolvedOrgId = ''
      const { data: ou } = await supabase
        .from('org_users')
        .select('organization_id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (ou) {
        resolvedOrgId = ou.organization_id
      } else {
        const { data: firstOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (firstOrg) resolvedOrgId = firstOrg.id
      }

      if (!resolvedOrgId) { setLoading(false); return }
      setOrgId(resolvedOrgId)

      // Her iki kanalı da yükle
      const { data: playbooks } = await supabase
        .from('agent_playbooks')
        .select('id, channel, system_prompt_template, opening_message, hard_blocks, features')
        .eq('organization_id', resolvedOrgId)
        .eq('is_active', true)
        .in('channel', ['voice', 'whatsapp', 'chat', 'all'])
        .order('version', { ascending: false })

      const parsePlaybook = (pb: any): PlaybookState => ({
        id: pb.id,
        systemPrompt: pb.system_prompt_template || '',
        openingMessage: pb.opening_message || '',
        blocks: (Array.isArray(pb.hard_blocks) ? pb.hard_blocks : []).map((b: any) => ({
          keywords: Array.isArray(b.keywords) ? b.keywords.join(', ') : '',
          response: b.response || '',
        })),
        features: pb.features ?? { calendar_booking: false },
      })

      if (playbooks) {
        // channel'a özgün önce, 'all' fallback
        // chat kanalı için: 'whatsapp' önce (engine canonical), 'chat' legacy fallback
        const voicePb = playbooks.find(p => p.channel === 'voice') || playbooks.find(p => p.channel === 'all')
        const whatsappPb = playbooks.find(p => p.channel === 'whatsapp') || playbooks.find(p => p.channel === 'chat') || playbooks.find(p => p.channel === 'all')
        if (voicePb) setVoice(parsePlaybook(voicePb))
        if (whatsappPb) setWhatsapp(parsePlaybook(whatsappPb))
      }

      // Intake schema yükle
      const { data: schemas } = await supabase
        .from('intake_schemas')
        .select('id, channel, fields')
        .eq('organization_id', resolvedOrgId)
        .in('channel', ['voice', 'whatsapp'])

      if (schemas) {
        const vs = schemas.find(s => s.channel === 'voice')
        const ws = schemas.find(s => s.channel === 'whatsapp')
        if (vs) { setVoiceIntake(vs.fields ?? []); setVoiceIntakeId(vs.id) }
        if (ws) { setWhatsappIntake(ws.fields ?? []); setWaIntakeId(ws.id) }
      }

      // KB item sayısını çek
      const { count } = await supabase
        .from('knowledge_items')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', resolvedOrgId)
        .eq('is_active', true)
      setKbCount(count ?? 0)

      // Voice aktif mi?
      const { data: orgData } = await supabase
        .from('organizations')
        .select('channel_config')
        .eq('id', resolvedOrgId)
        .single()
      const cc = (orgData?.channel_config ?? {}) as Record<string, any>
      setVoiceActive(cc?.voice_inbound?.active === true || cc?.voice_outbound?.active === true)

      // Routing config yükle
      try {
        const rRes = await fetch('/api/agent/routing-rules')
        if (rRes.ok) {
          const rData = await rRes.json()
          if (rData.routing_rules) setRoutingConfig(rData.routing_rules)
          if (rData.working_hours && Object.keys(rData.working_hours).length) setWorkingHours(rData.working_hours)
        }
      } catch {}

      setLoading(false)
    })
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/agent/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: activeChannel }),
      })
      if (!res.ok) throw new Error('Üretim başarısız')
      const { system_prompt } = await res.json()
      setCurrent(prev => ({ ...prev, systemPrompt: system_prompt }))
    } catch {
      setError('Prompt üretilemedi. Lütfen tekrar deneyin.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    setError('')

    const hard_blocks = current.blocks
      .filter(b => b.keywords.trim())
      .map((b, i) => ({
        trigger_id: `block_${i}`,
        action: 'soft_block',
        keywords: b.keywords.split(',').map(k => k.trim()).filter(Boolean),
        response: b.response.trim(),
      }))

    const supabase = createClient()

    if (current.id) {
      const { error: err } = await supabase
        .from('agent_playbooks')
        .update({
          system_prompt_template: current.systemPrompt,
          opening_message: current.openingMessage || null,
          hard_blocks,
          features: current.features,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.id)
      if (err) { setError('Kaydedilemedi.'); setSaving(false); return }
    } else {
      const { data: inserted, error: err } = await supabase
        .from('agent_playbooks')
        .insert({
          organization_id: orgId,
          channel: activeChannel,
          name: activeChannel === 'voice' ? 'Sesli Asistan' : 'WhatsApp/Chat Asistanı',
          system_prompt_template: current.systemPrompt,
          opening_message: current.openingMessage || null,
          hard_blocks,
          features: current.features,
          version: 1,
          is_active: true,
        })
        .select('id')
        .single()
      if (err) { setError('Kaydedilemedi.'); setSaving(false); return }
      if (inserted) setCurrent(prev => ({ ...prev, id: inserted.id }))
    }

    setSaving(false)
    setSavedChannel(activeChannel)
    setTimeout(() => setSavedChannel(null), 3000)
  }

  async function handleSuggestIntake() {
    setSuggesting(true)
    setSuggestions([])
    setSelectedSuggestions(new Set())
    try {
      const res = await fetch('/api/agent/suggest-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: activeChannel }),
      })
      if (!res.ok) throw new Error()
      const { fields } = await res.json()
      setSuggestions(fields ?? [])
      setSelectedSuggestions(new Set((fields ?? []).map((f: IntakeField) => f.key)))
    } catch {
      setError('Öneri üretilemedi. Lütfen tekrar deneyin.')
    } finally {
      setSuggesting(false)
    }
  }

  function addSelectedSuggestions() {
    const existingKeys = new Set(currentIntake.map(f => f.key))
    const toAdd = suggestions.filter(f => selectedSuggestions.has(f.key) && !existingKeys.has(f.key))
    setCurrentIntake(prev => [...prev, ...toAdd])
    setSuggestions([])
    setSelectedSuggestions(new Set())
  }

  function removeIntakeField(i: number) {
    setCurrentIntake(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSaveIntake() {
    if (!orgId) return
    setSavingIntake(true)
    const supabase = createClient()
    const ch      = activeChannel
    const fields  = currentIntake

    if (currentIntakeId) {
      await supabase
        .from('intake_schemas')
        .update({ fields, updated_at: new Date().toISOString() })
        .eq('id', currentIntakeId)
    } else {
      const { data: inserted } = await supabase
        .from('intake_schemas')
        .insert({
          organization_id: orgId,
          channel: ch,
          name: `${ch === 'voice' ? 'Sesli' : 'WhatsApp'} Başvuru Formu`,
          fields,
        })
        .select('id')
        .single()
      if (inserted) {
        ch === 'voice' ? setVoiceIntakeId(inserted.id) : setWaIntakeId(inserted.id)
      }
    }
    setSavingIntake(false)
    setIntakeSaved(true)
    setTimeout(() => setIntakeSaved(false), 3000)
  }

  async function handleSaveRouting() {
    setSavingRouting(true)
    try {
      const res = await fetch('/api/agent/routing-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing_rules: routingConfig, working_hours: workingHours }),
      })
      if (!res.ok) throw new Error()
      setRoutingSaved(true)
      setTimeout(() => setRoutingSaved(false), 3000)
    } catch {
      setError('Kaydedilemedi.')
    } finally {
      setSavingRouting(false)
    }
  }

  function updateRule(idx: number, patch: Partial<RoutingRule>) {
    setRoutingConfig(prev => ({
      ...prev,
      rules: prev.rules.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }))
  }

  function addBlock() {
    setCurrent(prev => ({ ...prev, blocks: [...prev.blocks, { keywords: '', response: '' }] }))
  }

  function removeBlock(i: number) {
    setCurrent(prev => ({ ...prev, blocks: prev.blocks.filter((_, idx) => idx !== i) }))
  }

  function updateBlock(i: number, field: 'keywords' | 'response', val: string) {
    setCurrent(prev => ({
      ...prev,
      blocks: prev.blocks.map((b, idx) => idx === i ? { ...b, [field]: val } : b),
    }))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Yükleniyor...
      </div>
    )
  }

  const promptLength = current.systemPrompt.trim().length
  const intakeMustCount = currentIntake.filter(f => f.priority === 'must').length

  const improvementTips: ImprovementTip[] = [
    ...(kbCount < 12 ? [{
      id: 'kb-depth',
      title: 'Bilgi bankasını derinleştir',
      body: 'Asistanın güven veren cevaplar vermesi için hizmet, fiyat, süreç ve sık sorulan sorular tarafında daha fazla bilgi ekleyin. Az veriyle iyi görünür; çok veriyle etkileyici çalışır.',
      badge: 'Knowledge base',
      tone: 'warning' as const,
      action: { label: 'Knowledge base\'e geç', onClick: () => window.location.assign('/dashboard/knowledge') },
    }] : [{
      id: 'kb-healthy',
      title: 'Bilgi bankası iyi durumda',
      body: `${kbCount} aktif kayıt mevcut. Tekrar eden soruları knowledge base başlıklarına dönüştürmek kaliteyi daha da artırır.`,
      badge: `${kbCount} aktif kayıt`,
      tone: 'success' as const,
    }]),
    ...(promptLength < 500 ? [{
      id: 'prompt-depth',
      title: 'Talimatları biraz daha netleştir',
      body: 'Kısa promptlar çalışır ama "premium" his veren cevaplar için hedef, sınır, ton ve handoff kurallarını daha görünür yazmak fark yaratır.',
      badge: 'Prompt kalitesi',
      tone: 'warning' as const,
    }] : [{
      id: 'prompt-strong',
      title: 'Talimat katmanı güçlü',
      body: 'Talimat uzunluğu yeterli tarafta. Bir sonraki kalite artışı gerçek müşteri mesajlarından örnek konuşmalar eklemekten gelir.',
      badge: 'Prompt olgunluğu',
      tone: 'success' as const,
    }]),
    ...(currentIntake.length < 4 ? [{
      id: 'intake-missing',
      title: 'Veri toplama alanları eksik',
      body: 'Asistan ne kadar doğru veri toplarsa handoff o kadar kaliteli görünür. İsim, telefon, ihtiyaç gibi çekirdek alanlar tanımlı olsun.',
      badge: 'Intake schema',
      tone: 'warning' as const,
    }] : [{
      id: 'intake-strong',
      title: 'Veri toplama akışı kurulmuş',
      body: 'Alan sayısı iyi. Zorunlu alanları gözden geçirip kritik bilgileri "must" yapmanız kaliteyi yükseltir.',
      badge: `${currentIntake.length} alan`,
      tone: 'success' as const,
    }]),
    ...(current.blocks.length === 0 ? [{
      id: 'guardrails',
      title: 'Kırmızı çizgileri tanımla',
      body: 'Rakip, hukuki konu, net fiyat garantisi veya iade gibi hassas başlıklarda hazır sınırlar tanımlamak asistanı daha güvenli ve profesyonel gösterir.',
      badge: 'Risk kontrolü',
      tone: 'info' as const,
    }] : [{
      id: 'guardrails-ready',
      title: 'Kırmızı çizgiler tanımlı',
      body: 'Sınır blokları mevcut. Yeni kanallar veya güncel mevzuat değiştikçe bu listeyi güncel tutmak yeterli.',
      badge: `${current.blocks.length} blok`,
      tone: 'success' as const,
    }]),
  ]

  const quickWins = [
    { label: 'Knowledge base kapsamı', value: kbCount < 12 ? 'Geliştirilmeli' : 'İyi', icon: BookOpen },
    { label: 'Zorunlu intake alanı', value: `${intakeMustCount}`, icon: ListChecks },
    { label: 'Prompt uzunluğu', value: promptLength < 500 ? 'Geliştirilmeli' : 'İyi', icon: MessageSquare },
  ]

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (improvementTips.length <= 1) { setActiveTipIndex(0); return }
    const id = window.setInterval(() => setActiveTipIndex(p => (p + 1) % improvementTips.length), 6500)
    return () => window.clearInterval(id)
  }, [improvementTips.length])

  const activeTip = improvementTips[activeTipIndex] || improvementTips[0]

  const isSaved = savedChannel === activeChannel

  return (
    <div className="p-6 xl:grid xl:grid-cols-[1fr_300px] xl:gap-8 xl:items-start">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot size={20} className="text-brand-500" />
            AI Asistan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Asistanınızı yapılandırın ve doğrudan tarayıcıdan test edin.
          </p>
        </div>
        {pageTab === 'settings' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaved ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
        )}
        {pageTab === 'routing' && (
          <button
            onClick={handleSaveRouting}
            disabled={savingRouting}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {savingRouting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {routingSaved ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
        )}
      </div>

      {/* Page Tabs: Ayarlar / Arama Kuralları / Test */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setPageTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            pageTab === 'settings'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bot size={15} />
          Ayarlar
        </button>
        <button
          onClick={() => voiceActive && setPageTab('routing')}
          title={!voiceActive ? 'Voice hizmeti aktif değil' : undefined}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !voiceActive
              ? 'text-slate-300 cursor-not-allowed'
              : pageTab === 'routing'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <PhoneForwarded size={15} />
          Arama Kuralları
        </button>
        <button
          onClick={() => setPageTab('test')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            pageTab === 'test'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FlaskConical size={15} />
          Test Et
        </button>
      </div>

      {/* Routing Panel */}
      {pageTab === 'routing' && (
        <div className="space-y-5">

          {/* Transfer Numaraları */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <PhoneForwarded size={15} className="text-brand-500" />
                Transfer Numaraları
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tier 1 kurallar tetiklendiğinde arama bu numaraya aktarılır.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Call Center (Transfer)</label>
                <input
                  value={routingConfig.transfer_numbers.primary ?? ''}
                  onChange={e => setRoutingConfig(prev => ({
                    ...prev,
                    transfer_numbers: { ...prev.transfer_numbers, primary: e.target.value },
                  }))}
                  placeholder="02122446600"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Voice Agent Hattı</label>
                <input
                  value={routingConfig.transfer_numbers.voice_agent ?? ''}
                  onChange={e => setRoutingConfig(prev => ({
                    ...prev,
                    transfer_numbers: { ...prev.transfer_numbers, voice_agent: e.target.value },
                  }))}
                  placeholder="02127098709"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Mesai Saatleri */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Clock size={15} className="text-brand-500" />
                Mesai Saatleri
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Mesai içinde Tier 1 kurallar transfere, mesai dışında callback vaadiyle notlara yönlenir.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { key: 'weekdays',  label: 'Hafta içi (Pzt–Cum)' },
                { key: 'saturday', label: 'Cumartesi' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <label className="text-xs text-slate-600 w-40 flex-shrink-0">{label}</label>
                  <input
                    type="text"
                    value={(workingHours as any)[key] ?? ''}
                    onChange={e => setWorkingHours(prev => ({ ...prev, [key]: e.target.value || null }))}
                    placeholder="09:30-19:00"
                    className="w-36 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-xs text-slate-400">format: SS:DD-SS:DD</span>
                </div>
              ))}
              <div className="flex items-center gap-4">
                <label className="text-xs text-slate-600 w-40 flex-shrink-0">Pazar</label>
                <button
                  onClick={() => setWorkingHours(prev => ({ ...prev, sunday: prev.sunday ? null : '10:00-16:00' }))}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    workingHours.sunday
                      ? 'border-brand-200 bg-brand-50 text-brand-600'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  {workingHours.sunday ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {workingHours.sunday ? workingHours.sunday : 'Kapalı'}
                </button>
                {workingHours.sunday && (
                  <input
                    type="text"
                    value={workingHours.sunday}
                    onChange={e => setWorkingHours(prev => ({ ...prev, sunday: e.target.value }))}
                    className="w-36 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Kural Listesi */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Yönlendirme Kuralları</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tier 1 kurallar çağrıyı aktarır, Tier 2 kurallar not alıp geri arama yapar.
              </p>
            </div>

            {routingConfig.rules.length === 0 && (
              <p className="text-sm text-slate-400 py-2">Henüz yönlendirme kuralı eklenmemiş.</p>
            )}

            <div className="space-y-3">
              {routingConfig.rules.map((rule, idx) => {
                const tierLabel  = rule.tier === 1 ? 'Transfer' : 'Not Al'
                const tierColor  = rule.tier === 1 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                const typeLabels: Record<string, string> = {
                  kb_fallback:       'KB Fallback',
                  intent:            'Niyet',
                  topic_note:        'Konu',
                  sentiment_note:    'Duygu',
                }
                const isTier1 = rule.tier === 1

                return (
                  <div key={rule.id} className={`border rounded-xl p-4 space-y-3 transition-colors ${rule.active ? 'border-slate-100 bg-slate-50' : 'border-slate-100 bg-white opacity-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateRule(idx, { active: !rule.active })}
                          className={`relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0 ${rule.active ? 'bg-brand-500' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${rule.active ? 'translate-x-4' : ''}`} />
                        </button>
                        <span className="text-sm font-medium text-slate-800">
                          {typeLabels[rule.type] ?? rule.type}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{rule.id}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tierColor}`}>
                        Tier {rule.tier} — {tierLabel}
                      </span>
                    </div>

                    {rule.keywords && rule.keywords.length > 0 && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Anahtar kelimeler <span className="text-slate-400">(virgülle ayır)</span></label>
                        <input
                          value={rule.keywords.join(', ')}
                          onChange={e => updateRule(idx, {
                            keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean),
                          })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    )}

                    {isTier1 ? (
                      <>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Mesai içi mesajı</label>
                          <textarea
                            value={rule.transition_message ?? ''}
                            onChange={e => updateRule(idx, { transition_message: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Mesai dışı mesajı</label>
                          <textarea
                            value={rule.after_hours_message ?? ''}
                            onChange={e => updateRule(idx, { after_hours_message: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Geri arama mesajı</label>
                        <textarea
                          value={rule.note_message ?? ''}
                          onChange={e => updateRule(idx, { note_message: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
          )}
        </div>
      )}

      {/* Test Panel */}
      {pageTab === 'test' && orgId && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Asistan Playground</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mevcut bilgi bankası ve promptunuzla gerçek zamanlı test yapın. Hiçbir veri kaydedilmez.
            </p>
          </div>
          {/* Channel seçimi test modunda da */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-4">
            <button
              onClick={() => setActiveChannel('voice')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeChannel === 'voice'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Mic size={13} />
              Sesli
            </button>
            <button
              onClick={() => setActiveChannel('whatsapp')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeChannel === 'whatsapp'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageSquare size={13} />
              Chat
            </button>
          </div>
          <AgentTestPanel
            orgId={orgId}
            activeChannel={activeChannel}
            hasVoice={!!voice.id || !!voice.systemPrompt}
            hasChat={!!whatsapp.id || !!whatsapp.systemPrompt}
            kbCount={kbCount}
            promptLength={
              activeChannel === 'voice'
                ? voice.systemPrompt.length
                : whatsapp.systemPrompt.length
            }
          />
        </div>
      )}

      {/* Settings Panel */}
      {pageTab === 'settings' && (
        <>
      {/* Channel Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveChannel('voice')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeChannel === 'voice'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mic size={15} />
          Sesli Görüşme
          {voice.id && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Yapılandırıldı" />
          )}
        </button>
        <button
          onClick={() => setActiveChannel('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeChannel === 'whatsapp'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MessageSquare size={15} />
          Mesajlaşma
          {whatsapp.id && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Yapılandırıldı" />
          )}
        </button>
      </div>

      {/* Henüz yapılandırılmamış uyarısı */}
      {!current.id && !current.systemPrompt && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <Sparkles size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {activeChannel === 'voice' ? 'Sesli görüşme' : 'Mesajlaşma'} asistanı henüz yapılandırılmamış.
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Bilgi bankasındaki verilerden otomatik prompt oluşturmak için "AI ile Oluştur" butonuna basın.
            </p>
          </div>
        </div>
      )}

      {/* Karşılama Mesajı — sadece voice */}
      {activeChannel === 'voice' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">İlk Karşılama Mesajı</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Çağrı bağlandığında asistanın söyleyeceği ilk cümle. Boş bırakılırsa varsayılan mesaj kullanılır.
            </p>
          </div>
          <input
            type="text"
            value={current.openingMessage}
            onChange={e => setCurrent(prev => ({ ...prev, openingMessage: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Merhaba! Şirketinizi aradınız, ben Asistan. Nasıl yardımcı olabilirim?"
          />
        </div>
      )}

      {/* Sistem Prompt */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Asistan Talimatları</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeChannel === 'voice'
                ? 'Asistanın kimliğini, görevini ve sesli konuşma davranışını tanımlar.'
                : 'Asistanın kimliğini, görevini ve mesajlaşma davranışını tanımlar.'}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {generating
              ? <Loader2 size={13} className="animate-spin" />
              : <Sparkles size={13} />}
            {generating ? 'Üretiliyor...' : 'AI ile Oluştur'}
          </button>
        </div>
        <textarea
          value={current.systemPrompt}
          onChange={e => setCurrent(prev => ({ ...prev, systemPrompt: e.target.value }))}
          rows={14}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none font-mono leading-relaxed"
          placeholder={
            activeChannel === 'voice'
              ? 'Asistanın kim olduğunu, ne yapacağını ve sesli konuşma kurallarını yazın...'
              : 'Asistanın kim olduğunu, ne yapacağını ve mesajlaşma davranışını yazın...'
          }
        />
        {activeChannel === 'voice' && (
          <p className="text-xs text-slate-400">
            💡 Sayı okuma kuralları, bilgi bankası ve veri toplama talimatları runtime'da otomatik eklenir — buraya yazmanıza gerek yok.
          </p>
        )}
      </div>

      {/* Özellikler */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Özellikler</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Kanalı için açmak istediğiniz ek özellikleri etkinleştirin.
          </p>
        </div>
        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
          <div>
            <p className="text-sm font-medium text-slate-800">Randevu Alma</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Müşteri randevu talep edince GHL takviminizden uygun saatleri gösterir ve randevu oluşturur.
              <br />
              <span className="text-slate-300">Gerekli: Admin → CRM → Calendar ID doldurulmuş olmalı.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrent(prev => ({
              ...prev,
              features: { ...prev.features, calendar_booking: !prev.features.calendar_booking },
            }))}
            className={`relative inline-flex h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
              current.features.calendar_booking ? 'bg-brand-500' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              current.features.calendar_booking ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {/* Sesli Asistan Dil & Ses Ayarları — sadece voice kanalında */}
        {activeChannel === 'voice' && (
          <div className="space-y-3 pt-1 border-t border-slate-100 mt-1">
            <p className="text-xs font-semibold text-slate-500 pt-2">Sesli Asistan — Dil & Ses</p>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Konuşma Dili (STT + TTS)</label>
              <select
                value={current.features.voice_language ?? ''}
                onChange={e => setCurrent(prev => ({ ...prev, features: { ...prev.features, voice_language: e.target.value } }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {VOICE_LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Deepgram STT ve Cartesia TTS bu dili kullanır.</p>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Cartesia TTS Ses ID</label>
              <input
                value={current.features.tts_voice_id ?? ''}
                onChange={e => setCurrent(prev => ({ ...prev, features: { ...prev.features, tts_voice_id: e.target.value } }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Cartesia Voice Library'den kopyalayın:{' '}
                <a href="https://play.cartesia.ai" target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                  play.cartesia.ai
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Veri Toplama Alanları */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <ListChecks size={15} className="text-brand-500" />
              Veri Toplama Alanları
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Asistanın konuşma sırasında müşteriden topladığı bilgiler.
              {activeChannel === 'whatsapp' && ' Telefon numarası WhatsApp\'tan otomatik alınır.'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleSuggestIntake}
              disabled={suggesting}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {suggesting ? 'Üretiliyor...' : 'AI Öner'}
            </button>
            <button
              onClick={handleSaveIntake}
              disabled={savingIntake}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {savingIntake ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {intakeSaved ? 'Kaydedildi ✓' : 'Kaydet'}
            </button>
          </div>
        </div>

        {/* Mevcut alanlar */}
        {currentIntake.length === 0 ? (
          <p className="text-sm text-slate-400 py-1">Henüz alan eklenmemiş. AI Öner butonunu kullanın.</p>
        ) : (
          <div className="space-y-2">
            {currentIntake.map((field, i) => (
              <div key={field.key} className="flex items-center gap-3 px-3 py-2.5 border border-slate-100 rounded-lg bg-slate-50">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-700">{field.label}</span>
                  <span className="ml-2 text-xs text-slate-400">{field.key}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  field.priority === 'must'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {field.priority === 'must' ? 'Zorunlu' : 'Opsiyonel'}
                </span>
                <button
                  onClick={() => removeIntakeField(i)}
                  className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI Önerileri */}
        {suggestions.length > 0 && (
          <div className="border border-brand-100 rounded-xl p-4 bg-brand-50 space-y-3">
            <p className="text-xs font-semibold text-brand-700">
              AI Önerileri — eklemek istediklerini seç:
            </p>
            <div className="space-y-2">
              {suggestions.map(f => (
                <label key={f.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(f.key)}
                    onChange={e => {
                      const next = new Set(selectedSuggestions)
                      e.target.checked ? next.add(f.key) : next.delete(f.key)
                      setSelectedSuggestions(next)
                    }}
                    className="rounded border-brand-300 text-brand-600"
                  />
                  <span className="text-sm text-slate-700 flex-1">{f.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    f.priority === 'must'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {f.priority === 'must' ? 'Zorunlu' : 'Opsiyonel'}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={addSelectedSuggestions}
                disabled={selectedSuggestions.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus size={13} />
                Seçilenleri Ekle ({selectedSuggestions.size})
              </button>
              <button
                onClick={() => { setSuggestions([]); setSelectedSuggestions(new Set()) }}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium"
              >
                İptal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hard Blocks */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Konuşulmaması Gereken Konular</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Bu anahtar kelimeler geçtiğinde asistan otomatik olarak belirlenen yanıtı verir.
          </p>
        </div>

        {current.blocks.length === 0 && (
          <p className="text-sm text-slate-400 py-2">Henüz kural eklenmemiş.</p>
        )}

        <div className="space-y-3">
          {current.blocks.map((b, i) => (
            <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Tetikleyen kelimeler <span className="text-slate-400">(virgülle ayır)</span>
                    </label>
                    <input
                      value={b.keywords}
                      onChange={e => updateBlock(i, 'keywords', e.target.value)}
                      placeholder="örn: rakip firma, iade, hukuk"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Verilecek yanıt</label>
                    <input
                      value={b.response}
                      onChange={e => updateBlock(i, 'response', e.target.value)}
                      placeholder="Bu konuda yardımcı olamıyorum, danışmanımıza bağlayayım."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeBlock(i)}
                  className="text-slate-300 hover:text-red-400 transition-colors mt-1 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addBlock}
          className="flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:text-brand-700"
        >
          <Plus size={15} />
          Kural Ekle
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}
        </>
      )}
      </div>{/* end main column */}

      {/* Improvement tips sidebar */}
      <aside className="hidden xl:block sticky top-6 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-lg">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-sky-200">Canlı öneri</p>
                <h2 className="mt-2 text-base font-semibold">Asistanı daha iyi yap</h2>
              </div>
              <div className="rounded-xl bg-white/10 p-2.5">
                <Lightbulb size={16} className="text-sky-200" />
              </div>
            </div>
          </div>

          {activeTip && (
            <div className="p-5">
              <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${tipToneStyles[activeTip.tone]}`}>
                {activeTip.badge}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">{activeTip.title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-300">{activeTip.body}</p>
              {activeTip.action && (
                <button
                  onClick={activeTip.action.onClick}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:-translate-y-0.5 transition-transform"
                >
                  {activeTip.action.label}
                  <ArrowUpRight size={12} />
                </button>
              )}
              <div className="mt-4 flex gap-1.5">
                {improvementTips.map((tip, index) => (
                  <button
                    key={tip.id}
                    onClick={() => setActiveTipIndex(index)}
                    aria-label={tip.title}
                    className={`h-1 rounded-full transition-all ${index === activeTipIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900">Hızlı kalite özeti</h3>
          </div>
          <div className="space-y-3">
            {quickWins.map(item => {
              const Icon = item.icon
              return (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <Icon size={13} />
                  {item.label}
                </div>
                <span className={`font-semibold ${item.value === 'Geliştirilmeli' ? 'text-amber-600' : 'text-slate-800'}`}>
                  {item.value}
                </span>
              </div>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}
