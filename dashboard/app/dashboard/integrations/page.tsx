'use client'

import { useState, Suspense } from 'react'
import {
  Instagram, Plug, Ban,
} from 'lucide-react'
import TopBar from '@/components/TopBar'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import { ConfigDrawer } from '@/components/integrations/ConfigDrawer'
import { WhatsAppConfig } from '@/components/integrations/WhatsAppConfig'
import { InstagramConfig } from '@/components/integrations/InstagramConfig'
import { CalendarConfig } from '@/components/integrations/CalendarConfig'
import { DentSoftConfig } from '@/components/integrations/DentSoftConfig'
import { ExcludedPhonesConfig } from '@/components/integrations/ExcludedPhonesConfig'
import { VoiceProviderConfig } from '@/components/integrations/VoiceProviderConfig'
import { VOICE_PROVIDERS, PROVIDER_LIST } from '@/lib/voice-providers'
import { useIsDemo } from '@/lib/demo-context'
import {
  WhatsAppIcon,
  NetgsmIcon,
  VerimorIcon,
  TwilioIcon,
  TelnyxIcon,
  GoogleCalendarIcon,
  DentSoftIcon,
} from '@/components/integrations/ProviderIcons'

type DrawerId =
  | 'whatsapp'
  | 'instagram'
  | 'calendar'
  | 'dentsoft'
  | 'excluded-phones'
  | 'netgsm'
  | 'verimor'
  | 'twilio'
  | 'telnyx'
  | null

const VOICE_ICON_MAP: Record<string, React.ReactNode> = {
  netgsm: <NetgsmIcon size={16} />,
  verimor: <VerimorIcon size={16} />,
  twilio: <TwilioIcon size={16} />,
  telnyx: <TelnyxIcon size={16} />,
}

export default function IntegrationsPage() {
  const isDemo = useIsDemo()
  const [activeDrawer, setActiveDrawer] = useState<DrawerId>(null)

  function openDrawer(id: DrawerId) {
    if (isDemo) return
    setActiveDrawer(id)
  }

  // Status tracking for cards
  const [waStatus, setWaStatus] = useState<{ connected: boolean; label?: string }>({ connected: false })
  const [igStatus, setIgStatus] = useState<{ connected: boolean; label?: string }>({ connected: false })
  const [calStatus, setCalStatus] = useState<{ connected: boolean }>({ connected: false })
  const [dsStatus, setDsStatus] = useState<{ connected: boolean }>({ connected: false })
  const [voiceStatus, setVoiceStatus] = useState<Record<string, boolean>>({})
  const [activeCategory, setActiveCategory] = useState<'all' | 'messaging' | 'voice' | 'calendar' | 'other'>('all')

  const categories = [
    { key: 'all' as const, label: 'Tümü' },
    { key: 'messaging' as const, label: 'Mesajlaşma' },
    { key: 'voice' as const, label: 'Ses/PBX' },
    { key: 'calendar' as const, label: 'Takvim' },
    { key: 'other' as const, label: 'Diğer' },
  ]

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <TopBar title="Entegrasyonlar" subtitle="Üçüncü parti bağlantılar" />

      {/* Category filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Mesajlasma ────────────────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'messaging') && <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Mesajlasma
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<WhatsAppIcon size={16} />}
              name="WhatsApp API"
              description="Sadece API uzerinden baglanti (Manuel)"
              helperText="Meta Business Suite'ten Phone Number ID ve Access Token ile baglanin."
              status={waStatus.connected ? 'connected' : 'disconnected'}
              statusLabel={waStatus.label}
              onClick={() => openDrawer('whatsapp')}
            />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<WhatsAppIcon size={16} />}
              name="WhatsApp Business"
              description="Telefonunuzda ve platform uzerinde tam kontrol"
              helperText="Meta Embedded Signup ile tek tikla baglanti. Numara yonetimi tamamen platform uzerinden yapilir."
              badge="1 hafta sonra"
              status="coming_soon"
            />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<Instagram size={16} className="text-pink-500" />}
              name="Instagram DM"
              description="Instagram Direct mesajlari"
              status={igStatus.connected ? 'connected' : 'disconnected'}
              statusLabel={igStatus.label}
              onClick={() => openDrawer('instagram')}
            />
          </Suspense>
        </div>
      </section>}

      {/* ── Ses / Sanal Santral ───────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'voice') && <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Ses / Sanal Santral
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDER_LIST.map((p) => (
            <IntegrationCard
              key={p.id}
              icon={VOICE_ICON_MAP[p.id]}
              name={p.name}
              description={p.description}
              status={voiceStatus[p.id] ? 'connected' : 'disconnected'}
              onClick={() => openDrawer(p.id)}
            />
          ))}
        </div>
      </section>}

      {/* ── Takvim ────────────────────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'calendar') && <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Takvim
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<GoogleCalendarIcon size={16} />}
              name="Google Takvim"
              description="Randevu yonetimi"
              status={calStatus.connected ? 'connected' : 'disconnected'}
              onClick={() => openDrawer('calendar')}
            />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<DentSoftIcon size={16} />}
              name="DentSoft"
              description="Dis klinigi takvim entegrasyonu"
              status={dsStatus.connected ? 'connected' : 'disconnected'}
              onClick={() => openDrawer('dentsoft')}
            />
          </Suspense>
        </div>
      </section>}

      {/* ── Diger ─────────────────────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'other') && <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Diger
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <IntegrationCard
            icon={<Ban size={16} className="text-slate-500" />}
            name="Haric Numaralar"
            description="AI yanit vermesin istediginiz numaralar"
            status="disconnected"
            onClick={() => openDrawer('excluded-phones')}
          />
        </div>
      </section>}

      {/* ── Drawer'lar ────────────────────────────────────────────── */}

      <ConfigDrawer
        open={activeDrawer === 'whatsapp'}
        onClose={() => setActiveDrawer(null)}
        title="WhatsApp API"
        icon={<WhatsAppIcon size={18} />}
      >
        <Suspense fallback={<DrawerSkeleton />}>
          <WhatsAppConfig
            onStatusChange={(c, phone) => setWaStatus({ connected: c, label: phone ? `Bagli — ${phone}` : undefined })}
          />
        </Suspense>
      </ConfigDrawer>

      <ConfigDrawer
        open={activeDrawer === 'instagram'}
        onClose={() => setActiveDrawer(null)}
        title="Instagram DM"
        icon={<Instagram size={18} className="text-pink-500" />}
      >
        <Suspense fallback={<DrawerSkeleton />}>
          <InstagramConfig
            onStatusChange={(c, username) => setIgStatus({ connected: c, label: username ? `@${username}` : undefined })}
          />
        </Suspense>
      </ConfigDrawer>

      <ConfigDrawer
        open={activeDrawer === 'calendar'}
        onClose={() => setActiveDrawer(null)}
        title="Google Takvim"
        icon={<GoogleCalendarIcon size={18} />}
      >
        <Suspense fallback={<DrawerSkeleton />}>
          <CalendarConfig
            onStatusChange={(c) => setCalStatus({ connected: c })}
          />
        </Suspense>
      </ConfigDrawer>

      <ConfigDrawer
        open={activeDrawer === 'dentsoft'}
        onClose={() => setActiveDrawer(null)}
        title="DentSoft"
        icon={<DentSoftIcon size={18} />}
      >
        <Suspense fallback={<DrawerSkeleton />}>
          <DentSoftConfig
            onStatusChange={(c) => setDsStatus({ connected: c })}
          />
        </Suspense>
      </ConfigDrawer>

      <ConfigDrawer
        open={activeDrawer === 'excluded-phones'}
        onClose={() => setActiveDrawer(null)}
        title="Haric Numaralar"
        icon={<Ban size={18} className="text-slate-500" />}
      >
        <ExcludedPhonesConfig />
      </ConfigDrawer>

      {PROVIDER_LIST.map((p) => (
        <ConfigDrawer
          key={p.id}
          open={activeDrawer === p.id}
          onClose={() => setActiveDrawer(null)}
          title={p.name}
          icon={VOICE_ICON_MAP[p.id]}
        >
          <VoiceProviderConfig
            provider={p}
            onStatusChange={(c) => setVoiceStatus((prev) => ({ ...prev, [p.id]: c }))}
          />
        </ConfigDrawer>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-slate-100 rounded w-20" />
          <div className="h-2 bg-slate-50 rounded w-32" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="h-2 bg-slate-50 rounded w-16" />
      </div>
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-8">
      <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      Yukleniyor...
    </div>
  )
}
