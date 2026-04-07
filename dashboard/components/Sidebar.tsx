'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, MessageSquare, Phone, BookOpen, Settings, LogOut, ShieldCheck, LifeBuoy, Bot, RefreshCw, ClipboardList, Menu, X, Target, HeartHandshake, FileText, Wallet } from 'lucide-react'
import { useT, useLang } from '@/lib/lang-context'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from './NotificationBell'

interface Props {
  orgName: string
  isSuperAdmin?: boolean
  userRole?: string | null
  userId?: string | null
  orgId?: string | null
}

export default function Sidebar({ orgName, isSuperAdmin, userRole, userId, orgId }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = useT()
  const { lang, setLang } = useLang()

  const allNavItems = [
    { href: '/dashboard',               label: t.overview,       icon: LayoutDashboard, roles: null },
    { href: '/dashboard/leads',         label: 'Leads',          icon: Target,          roles: null },
    { href: '/dashboard/conversations', label: t.conversations,  icon: MessageSquare,   roles: ['admin','viewer','yönetici','satisci'] },
    { href: '/dashboard/calls',         label: t.calls,          icon: Phone,           roles: ['admin','viewer','yönetici','satisci'] },
    { href: '/dashboard/proposals',     label: lang === 'tr' ? 'Teklifler' : 'Proposals', icon: FileText, roles: ['admin','yönetici','satisci','muhasebe'] },
    { href: '/dashboard/payments',      label: lang === 'tr' ? 'Ödemeler' : 'Payments',   icon: Wallet,   roles: ['admin','yönetici','muhasebe'] },
    { href: '/dashboard/knowledge',     label: t.knowledge,      icon: BookOpen,        roles: ['admin','viewer','yönetici','satisci'] },
    { href: '/dashboard/agent',         label: 'AI Assistant',   icon: Bot,             roles: ['admin','yönetici','satisci'] },
    { href: '/dashboard/followup',      label: 'Follow-up',      icon: RefreshCw,       roles: ['admin','yönetici','satisci'] },
    { href: '/dashboard/support',       label: t.tickets,        icon: LifeBuoy,        roles: ['admin','viewer','yönetici'] },
    { href: '/dashboard/settings',      label: lang === 'tr' ? 'Ayarlar' : 'Settings', icon: Settings, roles: ['admin','yönetici','satisci'] },
  ]

  const navItems = allNavItems.filter(item =>
    isSuperAdmin || item.roles === null || (userRole && item.roles.includes(userRole))
  )

  // Sayfa değişince mobil menüyü kapat
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobil hamburger butonu */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 rounded-xl border border-slate-200/80 bg-white/90 p-2.5 shadow-lg backdrop-blur"
        onClick={() => setMobileOpen(true)}
        aria-label="Menüyü aç"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      {/* Mobil backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-72 flex-shrink-0 border-r border-slate-800/80 bg-slate-950 text-white flex flex-col
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        md:sticky md:top-0 md:h-screen md:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_transparent_70%)]" />

        {/* Logo + Notification Bell */}
        <div className="relative border-b border-white/10 px-4 py-5 flex items-start justify-between">
          <div className="flex-1">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-2xl bg-gradient-to-br from-brand-400 via-brand-500 to-accent-500 px-3 py-2 shadow-lg shadow-brand-500/20">
                  <img src="/stoaixlogo-tight.png" alt="stoaix" className="h-7 w-auto brightness-0 invert" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Platform</p>
                  <p className="text-sm font-medium text-white truncate">{orgName}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Workspace</p>
                <p className="mt-1 text-xs font-medium text-slate-200">Active</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Mode</p>
                <p className="mt-1 text-xs font-medium text-slate-200">Managed AI</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2 mt-1">
            {/* Notification Bell — only for org users */}
            {userId && orgId && (
              <NotificationBell userId={userId} orgId={orgId} />
            )}
            {/* Mobil kapat butonu */}
            <button
              className="md:hidden p-1 text-slate-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Menüyü kapat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto px-3 py-5">
          <div className="px-3 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workspace</p>
          </div>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`group mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-brand-500/22 to-accent-400/12 text-white shadow-lg shadow-brand-900/20 ring-1 ring-inset ring-brand-400/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                  active
                    ? 'border-brand-300/30 bg-brand-400/15 text-brand-100'
                    : 'border-white/10 bg-white/5 text-slate-400 group-hover:border-white/15 group-hover:text-white'
                }`}>
                  <Icon size={16} />
                </span>
                {label}
                {active && <span className="ml-auto h-2 w-2 rounded-full bg-brand-300 shadow-[0_0_12px_rgba(125,211,252,0.9)]" />}
              </Link>
            )
          })}

          {isSuperAdmin && (
            <>
              <div className="px-3 pb-2 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Admin</p>
              </div>
              <Link
                href="/admin"
                className={`group mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                  pathname.startsWith('/admin')
                    ? 'bg-gradient-to-r from-brand-500/22 to-accent-400/12 text-white shadow-lg shadow-brand-900/20 ring-1 ring-inset ring-brand-400/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all group-hover:border-white/15 group-hover:text-white">
                  <ShieldCheck size={16} />
                </span>
                {t.admin}
              </Link>
              <Link
                href="/admin/tickets"
                className={`group mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                  pathname === '/admin/tickets'
                    ? 'bg-gradient-to-r from-brand-500/22 to-accent-400/12 text-white shadow-lg shadow-brand-900/20 ring-1 ring-inset ring-brand-400/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all group-hover:border-white/15 group-hover:text-white">
                  <Settings size={16} />
                </span>
                {t.tickets}
              </Link>
              <Link
                href="/admin/checklist"
                className={`group mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                  pathname === '/admin/checklist'
                    ? 'bg-gradient-to-r from-brand-500/22 to-accent-400/12 text-white shadow-lg shadow-brand-900/20 ring-1 ring-inset ring-brand-400/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all group-hover:border-white/15 group-hover:text-white">
                  <ClipboardList size={16} />
                </span>
                Kurulum Checklist
              </Link>
              <Link
                href="/admin/customer-success"
                className={`group mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                  pathname === '/admin/customer-success'
                    ? 'bg-gradient-to-r from-brand-500/22 to-accent-400/12 text-white shadow-lg shadow-brand-900/20 ring-1 ring-inset ring-brand-400/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all group-hover:border-white/15 group-hover:text-white">
                  <HeartHandshake size={16} />
                </span>
                Customer Success
              </Link>
            </>
          )}
        </nav>

        {/* Language toggle + Logout */}
        <div className="relative space-y-3 border-t border-white/10 px-3 pb-4 pt-4">
          {/* TR / EN toggle */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
            <div className="mb-2 px-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Language</p>
            </div>
            <div className="flex items-center gap-1">
            <button
              onClick={() => { setLang('tr'); router.refresh() }}
              className={`flex-1 min-h-[44px] rounded-xl py-2.5 text-xs font-medium transition-colors ${
                lang === 'tr'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              TR
            </button>
            <button
              onClick={() => { setLang('en'); router.refresh() }}
              className={`flex-1 min-h-[44px] rounded-xl py-2.5 text-xs font-medium transition-colors ${
                lang === 'en'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              EN
            </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
            {t.logout}
          </button>
        </div>
      </aside>
    </>
  )
}
