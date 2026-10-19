'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, FolderOpen, Settings, Truck, CreditCard, BarChart3, LogOut, Menu, Search,
  DollarSign, X, Boxes, FileText, Store, HardHat, Target, Bell, CornerDownLeft, Handshake,
  Activity, Wrench, GitCompare, ListChecks, ClipboardCheck, IndianRupee, Calculator, Flag, CalendarRange, ShieldAlert, Building2,
} from 'lucide-react'
import { CurrencyProvider } from '../components/currency-context'
import { CostingProvider, monthOf, projectCode } from '../../lib/costing-store'
import { useAdminOverview, financeLink, type Tone } from '../../lib/admin-overview'
import { T, display, toneColor } from '../components/kit'
import { ThemeScope, ThemeToggle } from '../components/theme'
import { Guard, SavedState } from '../components/guard'
import { useSession, signOut } from '../../lib/backend'
import { IS_DEMO, COMPANY_NAME } from '../../lib/company'

/* ==========================================================================
 * COMPANY ADMIN — the shell around every screen
 *
 * The menu is grouped by the job in hand rather than listed flat: run the
 * rigs, read the logs, win and bill the work, keep the stock, look ahead,
 * then the account itself.
 *
 * Three things here used to be decoration and now do something:
 *   - search opens a jump list of every page, rig, project and hole (Ctrl K);
 *   - the bell lists what actually needs the admin, from the live stores;
 *   - the badges on Finance and Inventory are real counts.
 *
 * The costing store is mounted here once, so every admin screen reads the same
 * copy and the badges stay true as work is done.
 * ========================================================================== */

/* `sample` marks a screen that still runs on sample data: shown for the demo
 * company only. `owner` is for the account that set XPLORIX up. */
type NavItem = { href: string; label: string; icon: React.ElementType; badge?: 'finance' | 'inventory' | 'projects' | 'contractors' | number; sample?: true; owner?: true }
const NAV: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Operations',
    items: [
      { href: '/admin/projects', label: 'Projects', icon: FolderOpen, badge: 'projects' },
      { href: '/admin/contractors', label: 'Contractors', icon: Handshake, badge: 'contractors' },
      { href: '/admin/rigs', label: 'Rigs & equipment', icon: Truck },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/reports', label: 'Performance reports', icon: FileText, sample: true },
    ],
  },
  {
    title: 'Logs',
    items: [
      { href: '/admin/logs/drill', label: 'Drill logs', icon: Activity },
      { href: '/admin/logs/maintenance', label: 'Maintenance logs', icon: Wrench },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { href: '/admin/bid-intelligence', label: 'Bid Intelligence', icon: Target, sample: true },
      { href: '/admin/finance', label: 'Finance & costing', icon: DollarSign, badge: 'finance' },
    ],
  },
  {
    title: 'Stock',
    items: [{ href: '/admin/inventory', label: 'Parts & inventory', icon: Boxes, badge: 'inventory' }],
  },
  {
    title: 'XPLORIX Intelligence',
    items: [
      { href: '/admin/intelligence', label: 'Today', icon: ListChecks },
      { href: '/admin/intelligence/drill-logs', label: 'Drill log check', icon: ClipboardCheck },
      { href: '/admin/intelligence/money', label: 'Money checks', icon: IndianRupee },
      { href: '/admin/intelligence/pricing', label: 'Price a tender', icon: Calculator },
      { href: '/admin/intelligence/contractors', label: 'Contractor comparison', icon: GitCompare },
      { href: '/admin/intelligence/holes', label: 'Hole finish prediction', icon: Flag },
      { href: '/admin/intelligence/months', label: 'This month and next', icon: CalendarRange },
      { href: '/admin/intelligence/risks', label: 'Risk analysis', icon: ShieldAlert },
    ],
  },
  {
    title: 'Exchange',
    items: [
      { href: '/admin/marketplace', label: 'Marketplace', icon: Store, sample: true },
      { href: '/admin/crew', label: 'Crew & jobs', icon: HardHat, badge: 8, sample: true },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/billing', label: 'Billing', icon: CreditCard, sample: true },
      { href: '/admin/companies', label: 'Companies', icon: Building2, owner: true },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]
const ALL = NAV.flatMap(g => g.items)
/* The menu for this company and this person. */
function menuFor(demo: boolean, owner: boolean) {
  return NAV.map(g => ({ ...g, items: g.items.filter(i => (demo || !i.sample) && (owner || !i.owner)) })).filter(g => g.items.length > 0)
}

const SHELL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap');
  @media (max-width: 900px) { .xpl-split { grid-template-columns: minmax(0,1fr) !important; } .xpl-prow { grid-template-columns: minmax(0,1fr) !important; gap: 10px !important; } }
  .xpl-row:hover { background: rgba(var(--x-ov),0.025); }
  .xpl-nav:hover { background: rgba(var(--x-ov),0.04); color: var(--x-text) !important; }
  .xpl-hit:hover { background: rgba(var(--x-ov),0.05); }
`

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function longDate(d: string) {
  const [y, m, dd] = d.split('-').map(Number)
  return `${DAY[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]} ${dd} ${MON[m - 1]} ${y}`
}

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState(false)
  const [bell, setBell] = useState(false)
  const pathname = usePathname()
  const o = useAdminOverview()
  const session = useSession()

  const current = [...ALL].sort((a, b) => b.href.length - a.href.length)
    .find(n => pathname === n.href || pathname.startsWith(n.href + '/'))
  const demo = IS_DEMO
  const owner = session.status === 'in' && !!session.user.owner
  const menu = menuFor(demo, owner)
  // A screen on sample data, opened by its address in a real company: say so instead of showing someone else's numbers.
  const blocked = !!current && ((current.sample && !demo) || (current.owner && !owner))

  const financeCount = o.money.returned.length + o.money.disputed.length
  const badge = (b: NavItem['badge']) => b === 'finance' ? financeCount : b === 'inventory' ? o.urgentAlerts.length : b === 'projects' ? o.projectNews : b === 'contractors' ? o.contractorWork : b ?? 0
  const badgeTone = (b: NavItem['badge']) => (b === 'finance' && financeCount) || (b === 'inventory' && o.urgentAlerts.length) ? T.red : T.orange

  // Ctrl K or ⌘ K opens search from anywhere; so does "/" when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '')
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setPalette(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { setOpen(false); setBell(false) }, [pathname])

  return (
    <div className="min-h-screen flex xpl-app" style={{ background: T.bg, color: T.text }}>
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />

      {open && <div className="lg:hidden fixed inset-0 z-40" style={{ background: 'rgba(var(--x-shadow),0.7)' }} onClick={() => setOpen(false)} />}

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 flex flex-col w-60 lg:h-screen transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'var(--x-side)', borderRight: `1px solid ${T.border}` }}
      >
        <div className="flex items-center justify-between" style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${T.border}` }}>
          <Link href="/admin/dashboard" className="flex items-center gap-3" style={{ textDecoration: 'none', minWidth: 0 }}>
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
              <polygon points="50,50 5,5 5,95" fill="#1a1a1a" /><polygon points="50,50 5,5 30,5" fill="#2a2a2a" />
              <polygon points="50,50 5,95 30,95" fill="#2a2a2a" /><polygon points="50,50 95,5 95,95" fill="#F97316" />
              <polygon points="50,50 95,5 70,5" fill="#EA580C" /><polygon points="50,50 95,95 70,95" fill="#EA580C" />
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '0.05em', fontFamily: display }}>XPLORIX</div>
              <div style={{ fontSize: 11.5, color: T.faint, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{COMPANY_NAME}</div>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"
            style={{ color: T.faint, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto" style={{ padding: '8px 10px 14px', scrollbarWidth: 'none' }}>
          {menu.map((g, gi) => (
            <div key={g.title ?? 'top'} style={{ marginTop: gi === 0 ? 4 : 11 }}>
              {g.title && <div style={{ fontSize: 11.5, fontWeight: 600, color: T.dim, padding: '0 10px 5px' }}>{g.title}</div>}
              {g.items.map(item => {
                const active = current?.href === item.href
                const n = badge(item.badge)
                return (
                  <Link key={item.href} href={item.href} className={active ? '' : 'xpl-nav'} aria-current={active ? 'page' : undefined} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6.5px 10px', borderRadius: 8, marginBottom: 1,
                    textDecoration: 'none', fontSize: 13.5, fontWeight: active ? 600 : 500,
                    background: active ? 'color-mix(in srgb, var(--x-orange) 12%, transparent)' : 'transparent', color: active ? T.text : T.muted,
                  }}>
                    <item.icon size={16} style={{ color: active ? T.orange : T.faint, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    {n > 0 && (
                      <span aria-label={`${n} need attention`} style={{
                        minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: badgeTone(item.badge), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{n}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {demo && (
          <Link href="/admin/billing" className="xpl-hit" style={{
            display: 'block', padding: '9px 11px', borderRadius: 9, textDecoration: 'none',
            border: '1px solid color-mix(in srgb, var(--x-orange) 28%, transparent)', background: 'color-mix(in srgb, var(--x-orange) 6%, transparent)',
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>Free trial: 12 days left</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>See plans and upgrade</div>
          </Link>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 2px 2px 4px' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'var(--x-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, color: T.text }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.status === 'in' ? session.user.name : 'Admin User'}</div>
              <div style={{ fontSize: 11.5, color: T.faint }}>Company admin</div>
            </div>
            {session.status === 'in'
              ? <button type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="xpl-hit" style={{ padding: 7, color: T.faint, borderRadius: 8, display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={15} /></button>
              : <Link href="/auth/login" aria-label="Sign out" title="Sign out" className="xpl-hit" style={{ padding: 7, color: T.faint, borderRadius: 8, display: 'flex' }}><LogOut size={15} /></Link>}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'color-mix(in srgb, var(--x-bg) 92%, transparent)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${T.line}`, padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              {/* No inline display here: it would beat the class that hides this on a wide screen. */}
              <button onClick={() => setOpen(true)} className="lg:hidden flex" aria-label="Open menu"
                style={{ padding: 6, color: T.faint, background: 'none', border: 'none', cursor: 'pointer' }}><Menu size={20} /></button>
              <button onClick={() => setPalette(true)} className="xpl-hit" style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 9, cursor: 'pointer',
                background: 'rgba(var(--x-ov),0.03)', border: `1px solid ${T.border}`, color: T.faint, fontSize: 13,
                fontFamily: 'inherit', width: '100%', maxWidth: 380, textAlign: 'left',
              }}>
                <Search size={14} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search pages, rigs, projects, holes</span>
                <kbd className="hidden sm:inline" style={{ fontSize: 11, padding: '1px 6px', borderRadius: 5, border: `1px solid ${T.border}`, color: T.faint, fontFamily: 'inherit' }}>Ctrl K</kbd>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="hidden md:inline" style={{ fontSize: 12.5, color: T.faint, whiteSpace: 'nowrap' }}>{longDate(o.today)}</span>
              <SavedState />
              <ThemeToggle />
              <div style={{ position: 'relative' }}>
                <button onClick={() => setBell(b => !b)} aria-label={`${o.attention.length} things need attention`} aria-expanded={bell} className="xpl-hit"
                  style={{ position: 'relative', padding: 8, borderRadius: 9, background: 'none', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', display: 'flex' }}>
                  <Bell size={16} />
                  {o.attention.length > 0 && (
                    <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: T.orange, color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{o.attention.length}</span>
                  )}
                </button>
                {bell && (
                  <>
                    <div className="fixed inset-0" style={{ zIndex: 40 }} onClick={() => setBell(false)} />
                    <div role="dialog" aria-label="Needs attention" style={{
                      position: 'absolute', right: 0, top: 44, zIndex: 50, width: 'min(400px, calc(100vw - 32px))',
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 50px rgba(var(--x-shadow),0.55)',
                    }}>
                      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.line}`, fontSize: 13, fontWeight: 700, color: T.text }}>
                        Needs attention{o.attention.length ? ` · ${o.attention.length}` : ''}
                      </div>
                      {o.attention.length === 0
                        ? <div style={{ padding: 16, fontSize: 13, color: T.faint }}>Nothing needs you right now.</div>
                        : o.attention.map((a, i) => (
                          <Link key={a.key} href={a.href} className="xpl-row" style={{ display: 'flex', gap: 11, padding: '11px 14px', textDecoration: 'none', borderTop: i ? `1px solid ${T.line}` : 'none' }}>
                            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: toneColor[a.tone as Tone], flexShrink: 0, marginTop: 5 }} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{a.title}</span>
                              <span style={{ display: 'block', fontSize: 12, color: T.faint, marginTop: 2, lineHeight: 1.4 }}>{a.detail}</span>
                            </span>
                          </Link>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1" style={{ padding: '26px 28px' }}>
          {blocked ? (
            <div style={{ maxWidth: 620, margin: '40px auto', padding: 24, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text, fontFamily: display }}>{current?.owner ? 'Not for this login' : `${current?.label} is in development`}</div>
              <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6, margin: '8px 0 16px' }}>
                {current?.owner
                  ? 'Only the account that set XPLORIX up can open this screen.'
                  : 'This screen still runs on sample data, so it is shown in the demo company only. It will open here when it reads your own logs.'}
              </p>
              <Link href="/admin/dashboard" style={{ fontSize: 13.5, fontWeight: 600, color: T.orange, textDecoration: 'none' }}>Back to the Dashboard</Link>
            </div>
          ) : children}
        </div>
      </main>

      {palette && <Palette onClose={() => setPalette(false)} />}
    </div>
  )
}

/* Jump list. Type a few letters of a page, rig, project or hole and press
 * Enter. Holes and projects open Finance already on the right rig and month. */
function Palette({ onClose }: { onClose: () => void }) {
  const o = useAdminOverview()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])

  const items = useMemo(() => {
    const pages = ALL.filter(n => (IS_DEMO || !n.sample) && !n.owner).map(n => ({ kind: 'Page', label: n.label, sub: '', href: n.href }))
    const rigs = o.rigs.map(r => ({ kind: 'Rig', label: r.rig, sub: [r.project, r.hole ? `on ${r.hole}` : ''].filter(Boolean).join(' · '), href: '/admin/rigs' }))
    const projects = o.projects.map(p => ({ kind: 'Project', label: p.name, sub: `${p.code} · ${p.client}`, href: `/admin/projects/${p.id}` }))
    const holes = o.holes.map(h => ({
      kind: 'Hole', label: h.id, sub: `${h.project} · ${h.rig} · ${Math.round(h.drilled)} m`,
      href: financeLink({ project: h.project, rig: h.rig, month: monthOf(h.end ?? h.start), tab: h.status === 'drilling' ? 'Performance' : 'Drillholes' }),
    }))
    return [...pages, ...rigs, ...projects, ...holes]
  }, [o.rigs, o.holes, o.projects])

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items.filter(i => i.kind === 'Page').slice(0, 9)
    // A match in the name itself comes before a match in the small print, so
    // typing a hole number finds the hole before the rig that is drilling it.
    const rank = (i: typeof items[number]) => {
      const label = i.label.toLowerCase()
      return label.startsWith(s) ? 0 : label.includes(s) ? 1 : 2
    }
    return items
      .filter(i => `${i.label} ${i.sub} ${i.kind}`.toLowerCase().includes(s))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 9)
  }, [q, items])
  useEffect(() => { setAt(0) }, [q])

  const go = (href: string) => { onClose(); router.push(href) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setAt(a => Math.min(hits.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && hits[at]) go(hits[at].href)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(var(--x-shadow),0.7)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12vh 16px 0' }}>
      <div role="dialog" aria-label="Search" onClick={e => e.stopPropagation()} onKeyDown={onKey}
        style={{ width: '100%', maxWidth: 560, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 80px rgba(var(--x-shadow),0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${T.line}` }}>
          <Search size={16} style={{ color: T.faint }} />
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Type a page, rig, project or hole number"
            aria-label="Search" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.text, fontSize: 15, fontFamily: 'inherit' }} />
          <kbd style={{ fontSize: 11, padding: '1px 6px', borderRadius: 5, border: `1px solid ${T.border}`, color: T.faint, fontFamily: 'inherit' }}>Esc</kbd>
        </div>
        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
          {hits.length === 0 && <div style={{ padding: '18px 12px', fontSize: 13.5, color: T.faint }}>Nothing matches &ldquo;{q}&rdquo;. Try a rig number or a hole number.</div>}
          {hits.map((h, i) => (
            <button key={`${h.kind}_${h.label}`} onClick={() => go(h.href)} onMouseEnter={() => setAt(i)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
              border: 'none', textAlign: 'left', fontFamily: 'inherit', background: i === at ? 'color-mix(in srgb, var(--x-orange) 12%, transparent)' : 'transparent',
            }}>
              <span style={{ width: 58, fontSize: 11.5, color: T.faint, flexShrink: 0 }}>{h.kind}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{h.label}</span>
                {h.sub && <span style={{ fontSize: 12.5, color: T.faint, marginLeft: 9 }}>{h.sub}</span>}
              </span>
              {i === at && <CornerDownLeft size={14} style={{ color: T.faint }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <CostingProvider>
        <ThemeScope />
        <Guard role="admin"><Shell>{children}</Shell></Guard>
      </CostingProvider>
    </CurrencyProvider>
  )
}
