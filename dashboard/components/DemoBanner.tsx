'use client'

import { useIsDemo } from '@/lib/demo-context'
import { useLang } from '@/lib/lang-context'

export default function DemoBanner() {
  const isDemo = useIsDemo()
  const { lang } = useLang()

  if (!isDemo) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-sm font-medium text-amber-800">
      {lang === 'tr'
        ? 'Demo Hesap — Ses ve chatbot testini deneyebilirsiniz'
        : 'Demo Account — You can try voice and chatbot testing'}
    </div>
  )
}
