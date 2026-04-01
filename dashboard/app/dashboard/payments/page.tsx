import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Wallet } from 'lucide-react'

export default async function PaymentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgUser } = await supabase
    .from('org_users')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!orgUser) redirect('/dashboard')

  const { data: payments } = await supabase
    .from('payment_schedules')
    .select(`
      id, amount, due_date, status, paid_at, notes, created_at,
      proposal:proposals(id, title, currency, lead:leads(id, contact:contacts(full_name, phone)))
    `)
    .eq('organization_id', orgUser.organization_id)
    .order('due_date', { ascending: true })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const totalPending = (payments ?? []).filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)
  const totalPaid = (payments ?? []).filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const overdueCount = (payments ?? []).filter(p => p.status === 'pending' && new Date(p.due_date) < today).length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ödemeler</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tüm taksit takvimleri</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bekleyen</p>
          <p className="text-2xl font-bold text-slate-900">{totalPending.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tahsil Edilen</p>
          <p className="text-2xl font-bold text-green-700">{totalPaid.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Gecikmiş</p>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{overdueCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Teklif</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tutar</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vade</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!payments?.length ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Wallet size={32} />
                    <p className="text-sm">Henüz ödeme kaydı yok.</p>
                  </div>
                </td>
              </tr>
            ) : payments.map((p: any) => {
              const isOverdue = p.status === 'pending' && new Date(p.due_date) < today
              const proposal = p.proposal
              const contact = proposal?.lead?.contact
              return (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{contact?.full_name || contact?.phone || '—'}</p>
                  </td>
                  <td className="px-5 py-3">
                    {proposal && (
                      <Link href={`/dashboard/proposals/${proposal.id}`} className="text-sm text-brand-600 hover:underline">
                        {proposal.title}
                      </Link>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">
                      {Number(p.amount).toLocaleString('tr-TR')} {proposal?.currency ?? ''}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <p className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                      {new Date(p.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && ' ⚠️'}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'paid' ? 'bg-green-100 text-green-700' :
                      isOverdue ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {p.status === 'paid' ? 'Ödendi' : isOverdue ? 'Gecikmiş' : 'Bekliyor'}
                    </span>
                    {p.paid_at && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(p.paid_at).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
