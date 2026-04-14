'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Phone, BookOpen, Settings, LogOut,
  ShieldCheck, LifeBuoy, Bot, RefreshCw, ClipboardList, Menu, X,
  Target, HeartHandshake, FileText, Wallet, Calendar, Inbox, LayoutTemplate,
  ChevronLeft, ChevronRight, CreditCard, Zap,
} from 'lucide-react'
import { useT, useLang } from '@/lib/lang-context'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from './NotificationBell'
import UsageWidget from './billing/UsageWidget'

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
  const [collapsed, setCollapsed] = useState(false)
  const t = useT()
  const { lang, setLang } = useLang()

  // Persist collapsed state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved === 'true') setCollapsed(true)
    } catch {}
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
  }

  const allNavItems = [
    { href: '/dashboard',               label: t.overview,                                  icon: LayoutDashboard, roles: null },
    { href: '/dashboard/leads',         label: 'Leads',                                     icon: Target,          roles: null },
    { href: '/dashboard/inbox',         label: lang === 'tr' ? 'Gelen Kutusu' : 'Inbox',   icon: Inbox,           roles: ['admin','viewer','yönetici','satisci'] },
    { href: '/dashboard/conversations', label: t.conversations,                             icon: MessageSquare,   roles: ['admin','viewer','yönetici','satisci'] },
    { href: '/dashboard/calls',         label: t.calls,                                     icon: Phone,           roles: ['admin','viewer','yönetici','satisci'] },
    { href: '/dashboard/proposals',     label: lang === 'tr' ? 'Teklifler' : 'Proposals',  icon: FileText,        roles: ['admin','yönetici','satisci','muhasebe'] },
    { href: '/dashboard/payments',      label: lang === 'tr' ? 'Ödemeler' : 'Payments',    icon: Wallet,          roles: ['admin','yönetici','muhasebe'] },
    { href: '/dashboard/knowledge',     label: t.knowledge,                                 icon: BookOpen,        roles: ['admin','viewer','yönetici','satisci'] },
    { href: '/dashboard/agent',         label: 'AI Assistant',                              icon: Bot,             roles: ['admin','yönetici','satisci'] },
    { href: '/dashboard/followup',      label: 'Follow-up',                                 icon: RefreshCw,       roles: ['admin','yönetici','satisci'] },
    { href: '/dashboard/calendar',      label: lang === 'tr' ? 'Takvim' : 'Calendar',      icon: Calendar,        roles: ['admin','yönetici','satisci'] },
    { href: '/dashboard/support',       label: t.tickets,                                   icon: LifeBuoy,        roles: ['admin','viewer','yönetici'] },
    { href: '/dashboard/workflows',      label: lang === 'tr' ? 'İş Akışları' : 'Workflows', icon: Zap,             roles: ['admin','yönetici'] },
    { href: '/dashboard/templates',      label: lang === 'tr' ? 'Templateler' : 'Templates', icon: LayoutTemplate,  roles: ['admin','yönetici','satisci'] },
    { href: '/dashboard/settings',      label: lang === 'tr' ? 'Ayarlar' : 'Settings',     icon: Settings,        roles: ['admin','yönetici','satisci'] },
    { href: '/dashboard/billing',       label: lang === 'tr' ? 'Plan & Fatura' : 'Billing', icon: CreditCard,      roles: ['admin','yönetici'] },
  ]

  const navItems = allNavItems.filter(item =>
    isSuperAdmin || item.roles === null || (userRole && item.roles.includes(userRole))
  )

  useEffect(() => { setMobileOpen(false) }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobil hamburger */}
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
        flex-shrink-0 border-r border-slate-800/80 bg-slate-950 text-white flex flex-col
        fixed inset-y-0 left-0 z-50
        transition-[width,transform] duration-200 ease-in-out
        md:sticky md:top-0 md:h-screen md:translate-x-0
        ${mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72 md:translate-x-0'}
        ${collapsed ? 'md:w-16' : 'md:w-[220px]'}
      `}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_transparent_70%)]" />

        {/* Header — Logo + Bell */}
        <div className={`relative border-b border-white/10 py-4 flex items-center transition-all duration-200 ${collapsed ? 'px-3 justify-center' : 'px-4 justify-between'}`}>
          {collapsed ? (
            /* Collapsed: sadece logo ikonu */
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-accent-500 p-2 shadow-lg shadow-brand-500/20">
                <img src="/stoaixlogo-tight.png" alt="stoaix" className="h-5 w-auto brightness-0 invert" />
              </div>
              {userId && orgId && <NotificationBell userId={userId} orgId={orgId} />}
            </div>
          ) : (
            /* Expanded: tam header */
            <>
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur">
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0 rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-accent-500 px-2.5 py-1.5 shadow-lg shadow-brand-500/20">
                      <img src="/stoaixlogo-tight.png" alt="stoaix" className="h-5 w-auto brightness-0 invert" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Platform</p>
                      <p className="text-xs font-medium text-white truncate">{orgName}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                {userId && orgId && <NotificationBell userId={userId} orgId={orgId} />}
                <button
                  className="md:hidden p-1 text-slate-400 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Menüyü kapat"
                >
                  <X size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
          {!collapsed && (
            <div className="px-2 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            </div>
          )}

          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`group mb-1 flex items-center rounded-xl transition-all ${
                  collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2.5'
                } ${
                  active
                    ? 'bg-gradient-to-r from-brand-500/22 to-accent-400/12 text-white ring-1 ring-inset ring-brand-400/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`flex shrink-0 items-center justify-center rounded-lg border transition-all ${
                  collapsed ? 'h-8 w-8' : 'h-7 w-7'
                } ${
                  active
                    ? 'border-brand-300/30 bg-brand-400/15 text-brand-100'
                    : 'border-white/10 bg-white/5 text-slate-400 group-hover:border-white/15 group-hover:text-white'
                }`}>
                  <Icon size={15} />
                </span>
                {!collapsed && (
                  <>
                    <span className="text-[13px] font-medium truncate">{label}</span>
                    {active && <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-brand-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]" />}
                  </>
                )}
              </Link>
            )
          })}

          {isSuperAdmin && (
            <>
              {!collapsed && (
                <div className="px-2 pb-2 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
                </div>
              )}
              {[
                { href: '/admin',                   label: t.admin,             icon: ShieldCheck },
                { href: '/admin/tickets',           label: t.tickets,           icon: Settings },
                { href: '/admin/checklist',         label: 'Kurulum Checklist', icon: ClipboardList },
                { href: '/admin/customer-success',  label: 'Customer Success',  icon: HeartHandshake },
              ].map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`group mb-1 flex items-center rounded-xl transition-all ${
                      collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2.5'
                    } ${
                      active
                        ? 'bg-gradient-to-r from-brand-500/22 to-accent-400/12 text-white ring-1 ring-inset ring-brand-400/25'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`flex shrink-0 items-center justify-center rounded-lg border transition-all ${
                      collapsed ? 'h-8 w-8' : 'h-7 w-7'
                    } ${
                      active
                        ? 'border-brand-300/30 bg-brand-400/15 text-brand-100'
                        : 'border-white/10 bg-white/5 text-slate-400 group-hover:border-white/15 group-hover:text-white'
                    }`}>
                      <Icon size={15} />
                    </span>
                    {!collapsed && <span className="text-[13px] font-medium truncate">{label}</span>}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Usage Widget */}
        {orgId && <UsageWidget orgId={orgId} collapsed={collapsed} />}

        {/* Footer — Lang + Logout + Collapse toggle */}
        <div className={`relative border-t border-white/10 pt-3 pb-3 space-y-1.5 ${collapsed ? 'px-2' : 'px-2'}`}>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title={collapsed ? (lang === 'tr' ? 'Genişlet' : 'Expand') : (lang === 'tr' ? 'Küçült' : 'Collapse')}
          >
            {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span className="text-[11px]">{lang === 'tr' ? 'Küçült' : 'Collapse'}</span></>}
          </button>

          {/* Language toggle */}
          {collapsed ? (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => { setLang('tr'); router.refresh() }}
                className={`w-full rounded-lg py-1.5 text-[10px] font-semibold transition-colors ${lang === 'tr' ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >TR</button>
              <button
                onClick={() => { setLang('en'); router.refresh() }}
                className={`w-full rounded-lg py-1.5 text-[10px] font-semibold transition-colors ${lang === 'en' ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >EN</button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-1.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 px-1 mb-1.5">Language</p>
              <div className="flex gap-1">
                <button
                  onClick={() => { setLang('tr'); router.refresh() }}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${lang === 'tr' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >TR</button>
                <button
                  onClick={() => { setLang('en'); router.refresh() }}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${lang === 'en' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >EN</button>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={collapsed ? (lang === 'tr' ? 'Çıkış' : 'Logout') : undefined}
            className={`flex w-full items-center rounded-xl border border-white/10 bg-white/5 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
              collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2.5'
            }`}
          >
            <LogOut size={15} />
            {!collapsed && t.logout}
          </button>
        </div>
      </aside>
    </>
  )
}
