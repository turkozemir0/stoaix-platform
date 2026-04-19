'use client'

import { useState, Suspense } from 'react'
import {
  MessageCircle, Instagram, Calendar, Phone, Plug, Ban,
} from 'lucide-react'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import { ConfigDrawer } from '@/components/integrations/ConfigDrawer'
import { WhatsAppConfig } from '@/components/integrations/WhatsAppConfig'
import { InstagramConfig } from '@/components/integrations/InstagramConfig'
import { CalendarConfig } from '@/components/integrations/CalendarConfig'
import { DentSoftConfig } from '@/components/integrations/DentSoftConfig'
import { ExcludedPhonesConfig } from '@/components/integrations/ExcludedPhonesConfig'
import { VoiceProviderConfig } from '@/components/integrations/VoiceProviderConfig'
import { VOICE_PROVIDERS, PROVIDER_LIST } from '@/lib/voice-providers'

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

// Provider icon component
function ProviderIcon({ id }: { id: string }) {
  return <Phone size={16} className={VOICE_PROVIDERS[id as keyof typeof VOICE_PROVIDERS]?.color ?? 'text-slate-500'} />
}

export default function IntegrationsPage() {
  const [activeDrawer, setActiveDrawer] = useState<DrawerId>(null)

  // Status tracking for cards
  const [waStatus, setWaStatus] = useState<{ connected: boolean; label?: string }>({ connected: false })
  const [igStatus, setIgStatus] = useState<{ connected: boolean; label?: string }>({ connected: false })
  const [calStatus, setCalStatus] = useState<{ connected: boolean }>({ connected: false })
  const [dsStatus, setDsStatus] = useState<{ connected: boolean }>({ connected: false })
  const [voiceStatus, setVoiceStatus] = useState<Record<string, boolean>>({})

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <Plug size={22} className="text-brand-600" />
        <h1 className="text-xl font-semibold text-slate-800">Entegrasyonlar</h1>
      </div>

      {/* ── Mesajlasma ────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Mesajlasma
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<MessageCircle size={16} className="text-green-500" />}
              name="WhatsApp"
              description="WhatsApp Business mesajlari"
              status={waStatus.connected ? 'connected' : 'disconnected'}
              statusLabel={waStatus.label}
              onClick={() => setActiveDrawer('whatsapp')}
            />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<Instagram size={16} className="text-pink-500" />}
              name="Instagram DM"
              description="Instagram Direct mesajlari"
              status={igStatus.connected ? 'connected' : 'disconnected'}
              statusLabel={igStatus.label}
              onClick={() => setActiveDrawer('instagram')}
            />
          </Suspense>
        </div>
      </section>

      {/* ── Ses / Sanal Santral ───────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Ses / Sanal Santral
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDER_LIST.map((p) => (
            <IntegrationCard
              key={p.id}
              icon={<ProviderIcon id={p.id} />}
              name={p.name}
              description={p.description}
              status={voiceStatus[p.id] ? 'connected' : 'disconnected'}
              onClick={() => setActiveDrawer(p.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Takvim ────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Takvim
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<Calendar size={16} className="text-brand-600" />}
              name="Google Takvim"
              description="Randevu yonetimi"
              status={calStatus.connected ? 'connected' : 'disconnected'}
              onClick={() => setActiveDrawer('calendar')}
            />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <IntegrationCard
              icon={<Calendar size={16} className="text-purple-500" />}
              name="DentSoft"
              description="Dis klinigi takvim entegrasyonu"
              status={dsStatus.connected ? 'connected' : 'disconnected'}
              onClick={() => setActiveDrawer('dentsoft')}
            />
          </Suspense>
        </div>
      </section>

      {/* ── Diger ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Diger
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <IntegrationCard
            icon={<Ban size={16} className="text-slate-500" />}
            name="Haric Numaralar"
            description="AI yanit vermesin istediginiz numaralar"
            status="disconnected"
            onClick={() => setActiveDrawer('excluded-phones')}
          />
        </div>
      </section>

      {/* ── Drawer'lar ────────────────────────────────────────────── */}

      <ConfigDrawer
        open={activeDrawer === 'whatsapp'}
        onClose={() => setActiveDrawer(null)}
        title="WhatsApp"
        icon={<MessageCircle size={18} className="text-green-500" />}
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
        icon={<Calendar size={18} className="text-brand-600" />}
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
        icon={<Calendar size={18} className="text-purple-500" />}
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
          icon={<ProviderIcon id={p.id} />}
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
