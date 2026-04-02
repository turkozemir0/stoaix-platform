import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, Wrench } from 'lucide-react'

export default async function BillingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Faturalama</h1>
        <p className="text-sm text-slate-500 mt-0.5">Abonelik ve ödeme yönetimi</p>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="flex items-center justify-center mb-4 gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
              <Wrench size={24} className="text-amber-600" />
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
              <CreditCard size={24} className="text-amber-600" />
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Sayfa Bakımda</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Faturalama modülümüz şu anda hazırlanıyor. Yakında Stripe entegrasyonu ile abonelik ve ödeme yönetimini bu ekrandan yapabileceksiniz.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-medium text-amber-700">Çok yakında</span>
          </div>
        </div>
      </div>
    </div>
  )
}
