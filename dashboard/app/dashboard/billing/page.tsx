'use client'

import { useState, useEffect } from 'react'
import { Check, X, Zap, Star, Building2, Rocket } from 'lucide-react'
import DunningBanner from '@/components/billing/DunningBanner'
import TrialBanner from '@/components/billing/TrialBanner'

// ─── Plan definitions ───────────────────────────────────────────────────────

type Interval = 'monthly' | 'annual'

interface Plan {
  id: string
  name: string
  monthlyPrice: number
  annualPrice: number
  icon: React.ReactNode
  color: string
  features: { label: string; value: string | boolean }[]
}

const PLANS: Plan[] = [
  {
    id: 'lite',
    name: 'Lite',
    monthlyPrice: 79,
    annualPrice: 63,
    icon: <Zap size={18} />,
    color: 'text-slate-600',
    features: [
      { label: 'WhatsApp mesajı', value: '500/ay' },
      { label: 'Voice agent', value: false },
      { label: 'Kanban board', value: true },
      { label: 'CSV import', value: false },
      { label: 'Instagram DM', value: false },
      { label: 'Gelismis analitik', value: false },
      { label: 'Outbound webhook', value: false },
      { label: 'Ekip üyesi', value: '1' },
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 149,
    annualPrice: 119,
    icon: <Star size={18} />,
    color: 'text-brand-500',
    features: [
      { label: 'WhatsApp mesajı', value: '2.000/ay' },
      { label: 'Voice agent', value: '60 dk/ay' },
      { label: 'Kanban board', value: true },
      { label: 'CSV import', value: true },
      { label: 'Instagram DM', value: true },
      { label: 'Gelismis analitik', value: false },
      { label: 'Outbound webhook', value: false },
      { label: 'Ekip üyesi', value: '3' },
    ],
  },
  {
    id: 'advanced',
    name: 'Advanced',
    monthlyPrice: 299,
    annualPrice: 239,
    icon: <Rocket size={18} />,
    color: 'text-purple-500',
    features: [
      { label: 'WhatsApp mesajı', value: '5.000/ay' },
      { label: 'Voice agent', value: '200 dk/ay' },
      { label: 'Kanban board', value: true },
      { label: 'CSV import', value: true },
      { label: 'Instagram DM', value: true },
      { label: 'Gelismis analitik', value: true },
      { label: 'Outbound webhook', value: true },
      { label: 'Ekip üyesi', value: '10' },
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 499,
    annualPrice: 399,
    icon: <Building2 size={18} />,
    color: 'text-emerald-500',
    features: [
      { label: 'WhatsApp mesajı', value: 'Sınırsız' },
      { label: 'Voice agent', value: 'Sınırsız' },
      { label: 'Kanban board', value: true },
      { label: 'CSV import', value: true },
      { label: 'Instagram DM', value: true },
      { label: 'Gelismis analitik', value: true },
      { label: 'Outbound webhook', value: true },
      { label: 'Ekip üyesi', value: 'Sınırsız' },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [interval, setInterval] = useState<Interval>('monthly')
  const [limitsData, setLimitsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectingPlan, setSelectingPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const currentPlanId: string | null = limitsData?.plan_id ?? null
  const status: string = limitsData?.status ?? ''
  const trialEndsAt: string | null = limitsData?.trial_ends_at ?? null
  const isLegacy = currentPlanId === 'legacy'
  const hasNoPlan = currentPlanId === null

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/billing/limits')
        if (res.ok) {
          const data = await res.json()
          setLimitsData(data)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSelect(planId: string) {
    setSelectingPlan(planId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) window.location.href = data.url
      }
    } catch {
      // ignore
    } finally {
      setSelectingPlan(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.url) window.location.href = data.url
      }
    } catch {
      // ignore
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plan & Faturalandırma</h1>
        <p className="mt-1 text-sm text-slate-500">Planınızı görüntüleyin ve yönetin.</p>
      </div>

      {/* Dunning + Trial banners */}
      {!loading && (
        <div className="space-y-3">
          <DunningBanner status={status} />
          <TrialBanner trialEndsAt={trialEndsAt} planId={currentPlanId} />
        </div>
      )}

      {/* Legacy customer notice */}
      {isLegacy && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-5">
          <p className="text-sm font-semibold text-slate-700">Mevcut müşteri — Özel fiyatlandırma</p>
          <p className="mt-1 text-sm text-slate-500">
            Özel fiyatlandırmadan yararlanıyorsunuz. Planınızı güncellemek için bizimle iletişime geçin.
          </p>
          <a
            href="mailto:destek@stoaix.com"
            className="mt-3 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            İletişime Geç
          </a>
        </div>
      )}

      {/* Interval toggle */}
      {(!isLegacy || hasNoPlan) && (
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setInterval('monthly')}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                interval === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Aylık
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                interval === 'annual'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Yıllık
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                %20 indirim
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Plans grid */}
      {(!isLegacy || hasNoPlan) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlanId
            const price = interval === 'annual' ? plan.annualPrice : plan.monthlyPrice
            const isBusy = selectingPlan === plan.id

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border bg-white p-5 transition-shadow hover:shadow-md ${
                  isCurrent
                    ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                    : 'border-slate-200'
                }`}
              >
                {/* Active badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-semibold text-white shadow">
                      Aktif Plan
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={plan.color}>{plan.icon}</span>
                  <h3 className="text-base font-semibold text-slate-800">{plan.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-slate-900">${price}</span>
                    <span className="mb-1 text-sm text-slate-400">/ay</span>
                  </div>
                  {interval === 'annual' && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Yıllık ödeme (${price * 12}/yıl)
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      {f.value === false ? (
                        <X size={13} className="mt-0.5 shrink-0 text-slate-300" />
                      ) : (
                        <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                      )}
                      <span className={f.value === false ? 'text-slate-400' : 'text-slate-700'}>
                        <span className="font-medium">{f.label}</span>
                        {typeof f.value === 'string' && (
                          <span className="text-slate-500"> — {f.value}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-center text-sm font-medium text-emerald-700">
                    Mevcut Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelect(plan.id)}
                    disabled={isBusy || !!selectingPlan}
                    className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
                  >
                    {isBusy ? 'Yükleniyor...' : 'Seç'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Manage subscription */}
      {!loading && currentPlanId && !isLegacy && !hasNoPlan && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm font-semibold text-slate-800">Mevcut aboneliği yönet</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Fatura bilgileri, ödeme yöntemi ve abonelik detayları.
            </p>
          </div>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {portalLoading ? 'Yükleniyor...' : 'Abonelik Portalı'}
          </button>
        </div>
      )}

      {/* Skeleton while loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="h-5 w-24 bg-slate-100 rounded" />
              <div className="h-8 w-20 bg-slate-100 rounded" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="h-3 bg-slate-100 rounded" />
                ))}
              </div>
              <div className="h-9 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
