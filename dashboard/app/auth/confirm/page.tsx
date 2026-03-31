'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function ConfirmContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const token_hash = params.get('token_hash')
    const type = params.get('type') ?? 'email'

    if (!token_hash) {
      setError('Geçersiz doğrulama linki.')
      return
    }

    const supabase = createClient()

    supabase.auth.verifyOtp({ token_hash, type: type as any })
      .then(async ({ data, error: verifyError }) => {
        if (verifyError || !data.user) {
          setError('Link geçersiz veya süresi dolmuş. Lütfen tekrar kayıt olmayı deneyin.')
          return
        }

        const inviteToken = data.user.user_metadata?.invite_token as string | undefined

        if (!inviteToken) {
          // Zaten kayıtlı kullanıcı (ör. email değişikliği)
          router.push('/dashboard')
          return
        }

        // Kayıt işlemini tamamla
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteToken, user_id: data.user.id }),
        })

        const d = await res.json()

        if (!res.ok) {
          // Token zaten kullanılmış olabilir — dashboard'a yönlendir
          router.push('/dashboard')
          return
        }

        router.push(d.redirect ?? '/onboarding')
      })
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <p className="text-red-600 font-medium mb-2">Doğrulama başarısız</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <Loader2 size={32} className="animate-spin text-brand-500 mx-auto mb-4" />
        <p className="text-slate-700 font-medium">Hesabınız doğrulanıyor...</p>
        <p className="text-slate-400 text-sm mt-1">Lütfen bekleyin</p>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  )
}
