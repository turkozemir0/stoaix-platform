'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, Send, Trash2, RefreshCw, MessageSquare } from 'lucide-react'
import TemplateModal from '@/components/templates/TemplateModal'

type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected'

interface Template {
  id:               string
  name:             string
  language:         string
  category:         string
  components:       any[]
  status:           TemplateStatus
  meta_template_id: string | null
  rejection_reason: string | null
  created_at:       string
}

const STATUS_BADGE: Record<TemplateStatus, { label: string; className: string }> = {
  draft:    { label: 'Taslak',    className: 'bg-slate-100 text-slate-600' },
  pending:  { label: 'Beklemede', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Onaylı',    className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-600' },
}

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING:      'Pazarlama',
  UTILITY:        'Hizmet',
  AUTHENTICATION: 'Kimlik Doğrulama',
}

export default function TemplatesPage() {
  const [templates, setTemplates]   = useState<Template[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)  // template id being submitted
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      if (res.ok) setTemplates(data.templates ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function onSaved(template: Template, _submitted?: boolean) {
    setTemplates((prev) => [template, ...prev])
    setShowModal(false)
  }

  async function submit(id: string) {
    setSubmitting(id)
    setError('')
    try {
      const res = await fetch(`/api/templates/${id}/submit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gönderim başarısız')
      setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, status: 'pending' } : t))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Bu template silinsin mi?')) return
    setDeleting(id)
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  function getBodyText(template: Template): string {
    const body = template.components.find((c) => c.type === 'BODY')
    return body?.text ?? ''
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare size={22} className="text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800">WhatsApp Templateler</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Meta onaylı template mesajlar — 24 saat dışında da gönderebilirsiniz.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            title="Yenile"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus size={15} />
            Yeni Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
          <Loader2 size={18} className="animate-spin" /> Yükleniyor...
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={36} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Henüz template yok</p>
          <p className="text-sm text-slate-400 mt-1">
            "Yeni Template" butonuna tıklayarak ilk template&apos;i oluşturun.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            const badge  = STATUS_BADGE[t.status] ?? STATUS_BADGE.draft
            const isDraft   = t.status === 'draft'
            const isRejected = t.status === 'rejected'

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400 uppercase">{t.language}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-xs text-slate-400">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Body preview */}
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 line-clamp-3">
                  {getBodyText(t) || <span className="text-slate-300 italic">İçerik yok</span>}
                </p>

                {/* Rejection reason */}
                {isRejected && t.rejection_reason && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                    Red sebebi: {t.rejection_reason}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto">
                  {(isDraft || isRejected) && (
                    <button
                      onClick={() => submit(t.id)}
                      disabled={submitting === t.id}
                      className="flex items-center gap-1.5 text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {submitting === t.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Send size={12} />
                      }
                      Meta&apos;ya Gönder
                    </button>
                  )}
                  <button
                    onClick={() => remove(t.id)}
                    disabled={deleting === t.id || t.status === 'pending'}
                    className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                    title={t.status === 'pending' ? 'Onay bekleyen template silinemez' : 'Sil'}
                  >
                    {deleting === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Sil
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <TemplateModal
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
