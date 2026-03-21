'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Loader2, Plus, Trash2, Bot, Sparkles, Mic, MessageSquare } from 'lucide-react'

type Channel = 'voice' | 'whatsapp'

interface PlaybookState {
  id?: string
  systemPrompt: string
  blocks: { keywords: string; response: string }[]
  features: { calendar_booking: boolean }
}

const EMPTY: PlaybookState = { systemPrompt: '', blocks: [], features: { calendar_booking: false } }

export default function AgentPage() {
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeChannel, setActiveChannel] = useState<Channel>('voice')

  const [voice, setVoice] = useState<PlaybookState>(EMPTY)
  const [whatsapp, setWhatsapp] = useState<PlaybookState>(EMPTY)

  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedChannel, setSavedChannel] = useState<Channel | null>(null)
  const [error, setError] = useState('')

  const current = activeChannel === 'voice' ? voice : whatsapp
  const setCurrent = (fn: (prev: PlaybookState) => PlaybookState) =>
    activeChannel === 'voice' ? setVoice(fn) : setWhatsapp(fn)

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
        .select('id, channel, system_prompt_template, hard_blocks, features')
        .eq('organization_id', resolvedOrgId)
        .eq('is_active', true)
        .in('channel', ['voice', 'whatsapp', 'chat', 'all'])
        .order('version', { ascending: false })

      const parsePlaybook = (pb: any): PlaybookState => ({
        id: pb.id,
        systemPrompt: pb.system_prompt_template || '',
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

  const isSaved = savedChannel === activeChannel

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot size={20} className="text-brand-500" />
            AI Asistan Ayarları
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Sesli ve yazışma kanalları için asistan davranışını ayrı ayrı yönetin.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isSaved ? 'Kaydedildi ✓' : 'Kaydet'}
        </button>
      </div>

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
    </div>
  )
}
