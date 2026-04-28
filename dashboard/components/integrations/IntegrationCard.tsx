'use client'

import { type ReactNode } from 'react'
import { Settings, ChevronRight, Clock } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  CHANNELS: 'bg-sky-100 text-sky-700',
  CALENDAR: 'bg-violet-100 text-violet-700',
  CRM: 'bg-amber-100 text-amber-700',
  AUTOMATION: 'bg-emerald-100 text-emerald-700',
  OTHER: 'bg-slate-100 text-slate-600',
}

export interface IntegrationCardProps {
  icon: ReactNode
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'loading' | 'coming_soon' | 'action_needed'
  statusLabel?: string
  badge?: string
  helperText?: string
  category?: string
  onClick?: () => void
  onDisconnect?: () => void
}

export function IntegrationCard({
  icon,
  name,
  description,
  status,
  statusLabel,
  badge,
  helperText,
  category,
  onClick,
  onDisconnect,
}: IntegrationCardProps) {
  const isDisabled = status === 'coming_soon'

  return (
    <div
      className={`rounded-2xl border text-left transition-all group w-full flex flex-col ${
        isDisabled
          ? 'bg-slate-50/80 border-slate-200 opacity-75'
          : status === 'connected'
            ? 'bg-white border-green-200 hover:border-green-300 hover:shadow-md'
            : 'bg-white border-slate-200 hover:border-sky-200 hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className="p-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
            {icon}
          </div>
          <div className="min-w-0 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-800 text-sm">{name}</h3>
              {badge && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  <Clock size={9} />
                  {badge}
                </span>
              )}
            </div>
            {category && (
              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER}`}>
                {category}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Status pill */}
        <div className="flex-shrink-0">
          {status === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          ) : status === 'coming_soon' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
              Yakında
            </span>
          ) : status === 'action_needed' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
              {statusLabel ?? 'Eylem gerekli'}
            </span>
          ) : status === 'loading' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-400 border border-slate-200">
              ...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
              Available
            </span>
          )}
        </div>
      </div>

      {helperText && (
        <p className="px-5 text-[11px] text-slate-400 leading-relaxed">{helperText}</p>
      )}

      {/* Footer */}
      <div className="mt-auto border-t border-slate-100 px-5 py-3 flex items-center justify-between">
        {status === 'loading' ? (
          <span className="text-xs text-slate-400">Yükleniyor...</span>
        ) : status === 'coming_soon' ? (
          <span className="text-xs text-slate-400">Yakında kullanılabilir</span>
        ) : status === 'connected' ? (
          <div className="flex items-center gap-3">
            <button
              onClick={onClick}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Settings size={13} />
              Configure
            </button>
            {onDisconnect && (
              <button
                onClick={onDisconnect}
                className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={isDisabled ? undefined : onClick}
            disabled={isDisabled}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isDisabled
                ? 'text-slate-300 cursor-default'
                : 'text-brand-600 hover:text-brand-700'
            }`}
          >
            Connect
            {!isDisabled && <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />}
          </button>
        )}
      </div>
    </div>
  )
}
