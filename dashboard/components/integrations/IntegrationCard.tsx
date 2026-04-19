'use client'

import { type ReactNode } from 'react'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export interface IntegrationCardProps {
  icon: ReactNode
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'loading'
  statusLabel?: string
  onClick: () => void
}

export function IntegrationCard({
  icon,
  name,
  description,
  status,
  statusLabel,
  onClick,
}: IntegrationCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-slate-300 hover:shadow-sm transition-all group w-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-slate-800 text-sm">{name}</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 mt-1"
        />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        {status === 'loading' ? (
          <span className="text-xs text-slate-400">Yukleniyor...</span>
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
