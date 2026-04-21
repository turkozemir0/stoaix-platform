'use client'

import { type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Clock } from 'lucide-react'

export interface IntegrationCardProps {
  icon: ReactNode
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'loading' | 'coming_soon'
  statusLabel?: string
  badge?: string
  helperText?: string
  onClick?: () => void
}

export function IntegrationCard({
  icon,
  name,
  description,
  status,
  statusLabel,
  badge,
  helperText,
  onClick,
}: IntegrationCardProps) {
  const isDisabled = status === 'coming_soon'

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      className={`rounded-xl border p-5 text-left transition-all group w-full ${
        isDisabled
          ? 'bg-slate-50 border-slate-200 cursor-default opacity-75'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-800 text-sm">{name}</h3>
              {badge && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  <Clock size={9} />
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        {!isDisabled && (
          <ChevronRight
            size={16}
            className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 mt-1"
          />
        )}
      </div>

      {helperText && (
        <p className="mt-2 text-[11px] text-slate-400 leading-relaxed pl-12">{helperText}</p>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100">
        {status === 'loading' ? (
          <span className="text-xs text-slate-400">Yukleniyor...</span>
        ) : status === 'coming_soon' ? (
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-amber-500" />
            <span className="text-xs font-medium text-amber-600">Yakinda</span>
          </div>
        ) : status === 'connected' ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-green-500" />
            <span className="text-xs font-medium text-green-700">
              {statusLabel ?? 'Bagli'}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Bagli degil</span>
        )}
      </div>
    </button>
  )
}
