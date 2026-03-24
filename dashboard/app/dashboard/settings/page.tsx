'use client'

import { useState, useEffect } from 'react'
import { Settings, Trash2, Plus, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [phones, setPhones] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/settings/excluded-phones')
      .then((r) => r.json())
      .then((d) => setPhones(d.phones ?? []))
      .catch(() => setError('Yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  async function save(updated: string[]) {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch('/api/settings/excluded-phones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: updated }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPhones(data.phones)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (e: any) {
      setError(e.message ?? 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  function addPhones() {
    if (!input.trim()) return
    // Split by commas, newlines, or spaces — allow bulk paste
    const parsed = input
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const merged = Array.from(new Set([...phones, ...parsed]))
    setInput('')
    save(merged)
  }

  function remove(phone: string) {
    save(phones.filter((p) => p !== phone))
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={22} className="text-brand-600" />
        <h1 className="text-xl font-semibold text-slate-800">Ayarlar</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-1">Hariç Tutulan Numaralar</h2>
        <p className="text-sm text-slate-500 mb-4">
          Bu numaralara gelen mesajlara AI yanıt vermez. Numaraları ülke kodu ile girin (ör. <span className="font-mono">4915123456789</span> veya <span className="font-mono">+4915123456789</span>). Virgülle, boşlukla veya alt alta yapıştırabilirsiniz.
        </p>

        {/* Input area */}
        <div className="flex gap-2 mb-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addPhones() } }}
            placeholder="+4915123456789&#10;4915123456789, +90 555 000 00 00"
            rows={3}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={addPhones}
            disabled={saving || !input.trim()}
            className="self-start flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Ekle
          </button>
        </div>

        {/* Feedback */}
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        {success && <p className="text-sm text-green-600 mb-3">Kaydedildi.</p>}

        {/* Existing phones */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 size={14} className="animate-spin" /> Yükleniyor...
          </div>
        ) : phones.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Henüz hariç tutulan numara yok.</p>
        ) : (
          <ul className="space-y-1">
            {phones.map((phone) => (
              <li key={phone} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                <span className="font-mono text-slate-700">{phone}</span>
                <button
                  onClick={() => remove(phone)}
                  disabled={saving}
                  className="text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
