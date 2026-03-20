'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Loader2, Plus, Trash2, Bot } from 'lucide-react'

interface Playbook {
  id: string
  name: string
  system_prompt_template: string
  hard_blocks: { trigger_id: string; keywords: string[]; response: string }[]
  working_hours?: string
}

export default function AgentPage() {
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [systemPrompt, setSystemPrompt] = useState('')
  const [blocks, setBlocks] = useState<{ keywords: string; response: string }[]>([])
  const [workingHours, setWorkingHours] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return

      // Org bul: önce org_users, yoksa super_admin → ilk aktif org
      let resolvedOrgId = ''
      const { data: ou } = await supabase
        .from('org_users')
        .select('organization_id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (ou) {
        resolvedOrgId = ou.organization_id
      } else {
        // Super admin: ilk aktif org'u göster
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

      const { data: pb } = await supabase
        .from('agent_playbooks')
        .select('id, name, system_prompt_template, hard_blocks')
        .eq('organization_id', resolvedOrgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pb) {
        setPlaybook(pb)
        setSystemPrompt(pb.system_prompt_template || '')
        const hb = Array.isArray(pb.hard_blocks) ? pb.hard_blocks : []
        setBlocks(hb.map((b: any) => ({
          keywords: Array.isArray(b.keywords) ? b.keywords.join(', ') : '',
          response: b.response || '',
        })))
        const match = pb.system_prompt_template?.match(/Çalışma saatleri[^.]+\./i)
        setWorkingHours(match ? match[0] : '')
      }
      setLoading(false)
    })
  }, [])

  function addBlock() {
    setBlocks(prev => [...prev, { keywords: '', response: '' }])
  }

  function removeBlock(i: number) {
    setBlocks(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateBlock(i: number, field: 'keywords' | 'response', val: string) {
    setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }

  async function handleSave() {
    if (!playbook) return
    setSaving(true)
    setError('')

    const hard_blocks = blocks
      .filter(b => b.keywords.trim())
      .map((b, i) => ({
        trigger_id: `block_${i}`,
        action: 'soft_block',
        keywords: b.keywords.split(',').map(k => k.trim()).filter(Boolean),
        response: b.response.trim(),
      }))

    const supabase = createClient()
    const { error: err } = await supabase
      .from('agent_playbooks')
      .update({
        system_prompt_template: systemPrompt,
        hard_blocks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', playbook.id)

    setSaving(false)
    if (err) {
      setError('Kaydedilemedi. Lütfen tekrar deneyin.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Yükleniyor...
      </div>
    )
  }

  if (!playbook) {
    return (
      <div className="p-6 text-slate-400 text-sm">AI asistan henüz yapılandırılmamış.</div>
    )
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot size={20} className="text-brand-500" />
            AI Asistan Ayarları
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Asistanınızın nasıl konuşacağını ve neleri konuşmayacağını buradan yönetin.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Kaydedildi ✓' : 'Kaydet'}
        </button>
      </div>

      {/* Sistem Prompt */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Asistan Talimatları</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Asistanınızın kimliğini, görevini ve genel davranış kurallarını buraya yazın.
          </p>
        </div>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={12}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none font-mono leading-relaxed"
          placeholder="Asistanın kim olduğunu, ne yapacağını ve nasıl konuşacağını yazın..."
        />
      </div>

      {/* Hard Blocks */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Konuşulmaması Gereken Konular</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Bu anahtar kelimeler geçtiğinde asistan otomatik olarak belirlenen yanıtı verir.
          </p>
        </div>

        {blocks.length === 0 && (
          <p className="text-sm text-slate-400 py-2">Henüz kural eklenmemiş.</p>
        )}

        <div className="space-y-3">
          {blocks.map((b, i) => (
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
