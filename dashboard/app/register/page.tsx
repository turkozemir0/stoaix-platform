'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [orgName, setOrgName] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenError('Geçersiz veya eksik davet linki.')
      setTokenChecked(true)
      return
    }
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setTokenError(data.error)
        else setOrgName(data.org_name)
        setTokenChecked(true)
      })
      .catch(() => {
        setTokenError('Token doğrulanamadı.')
        setTokenChecked(true)
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalı.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    // Mevcut session varsa (ör. admin test ediyor) önce çıkış yap
    await supabase.auth.signOut()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: { invite_token: token },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setError('Kayıt tamamlanamadı.')
      setLoading(false)
      return
    }

    // Email onayı gerekiyorsa session gelmez
    if (!data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, user_id: userId }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Kayıt tamamlanamadı.')
      setLoading(false)
      return
    }

    const d = await res.json()
    router.push(d.redirect ?? '/onboarding')
  }

  if (!tokenChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
        <p className="text-slate-500 text-sm">Davet doğrulanıyor...</p>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <p className="text-red-600 font-medium">{tokenError}</p>
          <p className="text-slate-500 text-sm mt-2">Lütfen geçerli bir davet linki kullanın.</p>
        </div>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">E-postanızı kontrol edin</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            <span className="font-medium text-slate-700">{email}</span> adresine doğrulama linki gönderdik.
            Linke tıkladıktan sonra hesabınız aktif hale gelecek.
          </p>
          <p className="text-xs text-slate-400 mt-4">Gelen kutunuzda görmüyorsanız spam klasörünü kontrol edin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-brand-500 rounded-2xl px-4 py-2 inline-flex items-center justify-center mb-4">
            <img src="/stoaixlogo-tight.png" alt="stoaix" className="h-12 w-auto brightness-0 invert" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">stoaix</h1>
          <p className="text-slate-500 text-sm mt-1">
            <span className="font-medium text-slate-700">{orgName}</span> için hesap oluştur
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Şifre Tekrar</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Kaydediliyor...' : 'Hesap Oluştur'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
