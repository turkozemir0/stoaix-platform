import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { FileText, Plus } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  accepted: 'Kabul',
  rejected: 'Reddedildi',
  signed: 'İmzalandı',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  signed: 'bg-emerald-100 text-emerald-700',
}

export default async function ProposalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgUser } = await supabase
    .from('org_users')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!orgUser) redirect('/dashboard')

  const { data: proposals } = await supabase
    .from('proposals')
    .select(`
      id, title, total_amount, currency, status, created_at, updated_at,
      lead:leads(id, contact:contacts(full_name, phone))
    `)
    .eq('organization_id', orgUser.organization_id)
    .order('created_at', { ascending: false })

  const canCreate = ['admin', 'yönetici', 'satisci'].includes(orgUser.role)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Teklifler</h1>
          <p className="text-sm text-slate-500 mt-0.5">{proposals?.length ?? 0} teklif</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Teklif</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tutar</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarih</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!proposals?.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <FileText size={32} />
                    <p className="text-sm">Henüz teklif oluşturulmadı.</p>
                    <p className="text-xs">Lead sayfasından teklif oluşturabilirsiniz.</p>
                  </div>
                </td>
              </tr>
            ) : proposals.map((p: any) => {
              const contact = p.lead?.contact
              return (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{contact?.full_name || contact?.phone || 'Bilinmeyen'}</p>
                    {contact?.phone && contact?.full_name && (
                      <p className="text-xs text-slate-400">{contact.phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-700">{p.title}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">
                      {Number(p.total_amount).toLocaleString('tr-TR')} {p.currency}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(p.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/proposals/${p.id}`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Detay
                    </Link>
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
