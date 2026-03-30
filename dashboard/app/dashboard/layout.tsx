import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import { LangProvider } from '@/lib/lang-context'
import type { Lang } from '@/lib/i18n'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: orgUser } = await supabase
    .from('org_users')
    .select('organization_id, role, organization:organizations(id, name, slug, sector)')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: superAdmin } = await supabase
    .from('super_admin_users')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const orgName = (orgUser?.organization as any)?.name ?? (superAdmin ? 'stoaix Admin' : '')

  const cookieLang = cookies().get('lang')?.value as Lang | undefined
  const initialLang: Lang = cookieLang === 'en' ? 'en' : 'tr'

  return (
    <LangProvider initialLang={initialLang}>
      <div className="relative flex min-h-screen [min-height:100dvh] bg-transparent">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-12rem] top-[-10rem] h-[24rem] w-[24rem] rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute right-[-10rem] top-[8rem] h-[22rem] w-[22rem] rounded-full bg-teal-200/25 blur-3xl" />
        </div>
        <Sidebar orgName={orgName} isSuperAdmin={!!superAdmin} />
        <main className="relative flex-1 min-w-0 overflow-auto pt-16 md:pt-0">
          {children}
        </main>
      </div>
    </LangProvider>
  )
}
