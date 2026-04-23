'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function DemoRedirect() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref') || ''
    const url = `/api/demo/session${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`
    window.location.href = url
  }, [searchParams])

  return null
}

export default function DemoPage() {
  return (
    <Suspense fallback={null}>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
          <p className="text-lg font-medium text-slate-700">Demo Hesabına Bağlanıyor...</p>
          <p className="mt-1 text-sm text-slate-400">Lütfen bekleyin</p>
        </div>
      </div>
      <DemoRedirect />
    </Suspense>
  )
}
