'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CalendarDays, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { moneyL, perUnit, monthLabel, shiftMonth, useCosting } from '../../../lib/costing-store'
import { useInventory, TODAY, PROJECTS, COMPLETED_PROJECTS, RIGS, countLosses } from '../../../lib/inventory-store'
import { IS_DEMO } from '../../../lib/company'
import { useAdminOverview, financeLink } from '../../../lib/admin-overview'
import { companyToday } from '../../../lib/company-overview'
import { stockBySite } from '../../../lib/stores-overview'
import { num } from '../../../lib/client-record'
import { useInbox } from '../../components/inbox'
import {
  Page, Card, Btn, Table, Status, Legend, Tip, Delta, Empty,
  th, thR, td, tdR, rowLine, T, tint, display, axisTick, gridStroke,
} from '../../components/kit'

/* DASHBOARD — the company at a glance.
 *
 * Figures only; what needs doing lives in Tasks. Read top to bottom the way
 * an owner asks: what happened today, in what ground, at what cost a metre
 * on each rig, how the projects stand, the rigs' health, whether the logs
 * are in, what the contractors did, and what sits in the stores. */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (d?: string) => d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}` : ''
const GROUND_COLOR: Record<string, string> = { Soft: 'color-mix(in srgb, var(--x-green) 70%, white)', Medium: 'var(--x-amber)', Hard: 'var(--x-orange)', 'Very Hard': 'var(--x-red)' }

function StartHere() {
  const { state } = useCosting()
  const { state: inv } = useInventory()
  if (IS_DEMO || state.shiftLogs.length > 0) return null
  const steps: { done: boolean | null; title: string; detail: string; href: string; action: string }[] = [
    { done: null, title: 'Change your password', detail: 'You were given it by XPLORIX. Make it your own.', href: '/admin/settings', action: 'Open Settings' },
    { done: (state.rigRegister ?? []).length > 0, title: 'Add your rigs', detail: 'Each rig once: its name as written on the log, its type and core sizes.', href: '/admin/rigs', action: 'Open Rigs' },
    { done: (state.crew ?? []).length > 0, title: 'Add your drillers and supervisors', detail: 'So they can be picked on projects and drill logs.', href: '/admin/people', action: 'Open Drillers & crew' },
    { done: state.projects.length > 0, title: 'Create your first project', detail: 'The client, the contract rates, the rigs and crew on it, and the holes to drill.', href: '/admin/projects/new', action: 'New project' },
    { done: state.ownership.length + state.operating.length > 0, title: 'Enter what each rig costs', detail: 'The rig cost on each rig under Rigs; fuel and crew when a rig is put on a project.', href: '/admin/rigs', action: 'Open Rigs' },
    { done: inv.catalogue.length > 0, title: 'Count what is on each rig', detail: 'Can wait. Needed for parts cost on each metre and stock warnings.', href: '/admin/inventory', action: 'Open Stores' },
  ]
  return (
    <Card title="Start here" subtitle="Each step is ticked when it is done." pad={false}>
      {steps.map((s, i) => (
        <Link key={s.title} href={s.href} className="xpl-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderTop: i ? rowLine : undefined, textDecoration: 'none' }}>
          <span aria-hidden style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, background: s.done ? tint(T.green, 16) : 'rgba(var(--x-ov),0.05)', color: s.done ? T.green : T.muted }}>{s.done ? '✓' : i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.title}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{s.detail}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.orange, whiteSpace: 'nowrap' }}>{s.action} →</span>
        </Link>
      ))}
    </Card>
  )
}

export default function AdminDashboard() {
  const o = useAdminOverview()
  const { state: costing } = useCosting()
  const { state: inv } = useInventory()
  const inbox = useInbox()
  const c = useMemo(() => companyToday(costing, inv, TODAY), [costing, inv])
  const stock = useMemo(() => {
    const used = (rig: string, project: string) => {
      const out: { itemId: string; qty: number }[] = []
      costing.shiftLogs.filter(l => l.rig === rig && l.project === project && !l.contractor).forEach(l => (l.partsUsed ?? []).forEach(u => {
        const e = out.find(x => x.itemId === u.itemId); if (e) e.qty += u.qty ?? 0; else out.push({ itemId: u.itemId, qty: u.qty ?? 0 })
      }))
      return [...out, ...countLosses(inv.rigCounts ?? [], rig, project)]
    }
    const rigsOn = (p: string) => RIGS.filter(r => costing.shiftLogs.some(l => l.rig === r && l.project === p) || inv.rigKit.some(k => k.rig === r && k.project === p))
    const sites = stockBySite(inv.pos, inv.catalogue, inv.rigKit, PROJECTS, COMPLETED_PROJECTS, rigsOn, used, TODAY, inv.alerts)
    return { store: sites.reduce((s, x) => s + x.store, 0), rigs: sites.reduce((s, x) => s + x.onRigs, 0), idle: sites.reduce((s, x) => s + x.idle, 0) }
  }, [costing.shiftLogs, inv])
  const lastMonth = monthLabel(shiftMonth(o.month, -1)).split(' ')[0]
  const prevPerDay = o.prev.rigDays ? o.prev.metres / o.dayOfMonth : 0
  const groundMax = Math.max(1, ...c.lithology.map(g => g.month))
  const dueToday = inbox.open.filter(u => u.severity === 'act').length

  return (
    <Page>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 26, fontWeight: 700, color: T.text }}>Your company today</h1>
          <p style={{ margin: '5px 0 0', fontSize: 13.5, color: T.muted }}>{day(TODAY)} · from today&apos;s drill logs, the maintenance log, costing and stores.{IS_DEMO ? ' Demo data.' : ''}</p>
        </div>
        <Link href="/admin/tasks" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }}>
          <CalendarDays size={16} aria-hidden style={{ color: T.orange }} />Tasks{dueToday ? <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: T.red, borderRadius: 99, padding: '1px 8px' }}>{dueToday} today</span> : null}<ArrowRight size={14} aria-hidden style={{ color: T.faint }} />
        </Link>
      </div>

      <StartHere />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Kpi label="Metres today" value={`${num(c.today.metres)} m`} note={prevPerDay ? <>{lastMonth} averaged {prevPerDay.toFixed(0)} m a day</> : undefined} />
        <Kpi label="Rigs drilling" value={`${c.today.rigsActive} of ${c.today.rigsOnProjects}`} note={`${c.today.ownActive} yours, ${c.today.rigsActive - c.today.ownActive} contractors'`} href="/admin/rigs" />
        <Kpi label="Drillers on shift" value={String(c.today.drillers)} note="Your own, named on today's logs" href="/admin/people" />
        <Kpi label="Downtime today" value={`${num(c.today.downtime)} h`} note={`${num(c.today.ownDowntime)} h your side or the contractor's, the rest client standby`} bad={c.today.ownDowntime > 0} />
        <Kpi label="Cost a metre today" value={c.today.cpm != null ? perUnit(c.today.cpm) : '—'} note="Your own rigs, all-in" href="/admin/finance" />
        <Kpi label="Stock you hold" value={moneyL(stock.store + stock.rigs)} note={`${moneyL(stock.store)} in stores, ${moneyL(stock.rigs)} on rigs`} href="/admin/inventory" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        <Card title={`Metres per day, ${monthLabel(o.month)}`} subtitle="All rigs, yours and contractors'">
          {prevPerDay > 0 && <div style={{ marginBottom: 10 }}><Legend items={[{ color: T.bar, label: 'Metres drilled' }, { color: T.muted, label: `${lastMonth} average, ${prevPerDay.toFixed(0)} m a day`, line: true }]} /></div>}
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={o.daily} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={{ stroke: T.border }} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v} m`} />
              <Tooltip cursor={{ fill: 'rgba(var(--x-ov),0.03)' }} content={({ active, payload, label }) => active && payload?.length ? <Tip active label={`${label} ${monthLabel(o.month).split(' ')[0]}`} unit=" m" payload={[{ dataKey: 'metres', name: 'Metres drilled', value: payload[0].value as number, color: T.bar }]} /> : null} />
              {prevPerDay > 0 && <ReferenceLine y={prevPerDay} stroke={T.muted} />}
              <Bar dataKey="metres" fill={T.bar} maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Metres by ground" subtitle={`${monthLabel(o.month)} so far, and today`}>
          {c.lithology.length === 0 ? <Empty>No metres logged this month.</Empty> : (
            <div style={{ display: 'grid', gap: 14 }}>
              {c.lithology.map(g => (
                <div key={g.name} style={{ display: 'grid', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.text }}>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span><b>{num(g.month)} m</b> <span style={{ color: T.faint }}>· {num(g.today)} m today</span></span>
                  </div>
                  <div aria-hidden style={{ height: 10, borderRadius: 99, background: 'rgba(var(--x-ov),0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(g.month / groundMax) * 100}%`, background: GROUND_COLOR[g.name] ?? T.bar, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
              <span style={{ fontSize: 12, color: T.faint }}>{Math.round((c.lithology.filter(g => g.name === 'Hard' || g.name === 'Very Hard').reduce((s, g) => s + g.month, 0) / Math.max(1, c.lithology.reduce((s, g) => s + g.month, 0))) * 100)}% of this month&apos;s metres in hard or very hard ground.</span>
            </div>
          )}
        </Card>
      </div>

      <Card title="Every rig today" subtitle="Cost a metre is all-in for your rigs, and what the work order pays for a contractor's. Where today is not costed yet, the latest costed day is named." pad={false}
        right={<Link href="/admin/finance" style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Finance →</Link>}>
        {c.rigs.length === 0 ? <Empty>No rig has logged a shift this month.</Empty> : (
          <Table>
            <thead><tr><th style={th}>Rig</th><th style={th}>Project and hole</th><th style={thR}>Metres today</th><th style={thR}>Downtime today</th><th style={thR}>Cost a metre</th><th style={thR}>Earned a metre</th><th style={thR}>This month</th><th style={thR}>Month cost a metre</th><th style={th} /></tr></thead>
            <tbody>
              {c.rigs.map(r => (
                <tr key={`${r.project}|${r.rig}`} style={{ borderTop: rowLine }}>
                  <td style={td}><div style={{ color: T.text, fontWeight: 700, fontFamily: display }}>{r.rig}</div><div style={{ fontSize: 11.5, color: T.faint }}>{r.contractor ?? 'Your rig'}</div></td>
                  <td style={td}><div style={{ color: T.text }}>{r.hole ?? '—'}</div><div style={{ fontSize: 11.5, color: T.faint }}>{r.project}</div></td>
                  <td style={{ ...tdR, color: T.text, fontWeight: 600 }}>{r.reported ? `${num(r.metresToday)} m` : <span style={{ color: 'var(--x-bad-text)' }}>No log</span>}{r.unchecked ? <div style={{ fontSize: 11.5, color: T.faint, fontWeight: 400 }}>reported, not checked</div> : null}</td>
                  <td style={{ ...tdR, color: r.ownDowntimeToday ? 'var(--x-bad-text)' : T.muted }}>{r.downtimeToday ? `${num(r.downtimeToday)} h` : '0'}{r.downtimeToday && !r.ownDowntimeToday ? <div style={{ fontSize: 11.5, color: T.faint }}>client standby</div> : null}</td>
                  <td style={{ ...tdR, color: T.text, fontWeight: 700 }}>{r.cpm != null ? perUnit(r.cpm) : '—'}{r.cpmDate && <div style={{ fontSize: 11.5, color: T.faint, fontWeight: 400 }}>on {day(r.cpmDate)}</div>}</td>
                  <td style={tdR}>{r.rate != null ? perUnit(r.rate) : '—'}</td>
                  <td style={tdR}>{num(r.monthMetres)} m</td>
                  <td style={tdR}>{r.monthCpm != null ? perUnit(r.monthCpm) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}><Btn size="sm" href={financeLink({ project: r.project, rig: r.rig, month: o.month })}>Costing</Btn></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        <Card title="Projects" subtitle="Metres drilled against the metres planned." right={<Link href="/admin/projects" style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, textDecoration: 'none' }}>All projects →</Link>}>
          <div style={{ display: 'grid', gap: 16 }}>
            {c.projects.map(p => (
              <Link key={p.id} href={`/admin/projects/${p.id}`} style={{ display: 'grid', gap: 6, textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p.name} <span style={{ fontWeight: 400, color: T.faint, fontSize: 12.5 }}>· {p.client}</span></span>
                  {p.status === 'completed' ? <Status tone="neutral">Completed</Status> : <span style={{ fontSize: 13, color: T.text }}><b>{num(p.drilled)}</b> of {num(p.planned)} m</span>}
                </div>
                {p.status !== 'completed' && <div aria-hidden style={{ height: 10, borderRadius: 99, background: 'rgba(var(--x-ov),0.06)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${p.pct ?? 0}%`, background: T.green, borderRadius: 99 }} /></div>}
                <span style={{ fontSize: 12, color: T.faint }}>{p.status === 'completed' ? 'Finished before this month' : `${(p.pct ?? 0).toFixed(0)}% · ${p.holesDone} of ${p.holes} holes finished · ${p.rigs} ${p.rigs === 1 ? 'rig' : 'rigs'} this month · ${num(p.monthMetres)} m this month`}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card title="Maintenance" subtitle={`${monthLabel(o.month)}, your own rigs`} right={<Link href="/admin/logs/maintenance" style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Maintenance log →</Link>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            <Mini label="Services" value={String(c.maintenance.services)} />
            <Mini label="Breakdowns" value={String(c.maintenance.breakdowns)} bad={c.maintenance.breakdowns > 0} />
            <Mini label="Hours down" value={`${num(c.maintenance.hours)} h`} />
            <Mini label="Repair cost" value={moneyL(c.maintenance.cost)} />
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: T.text, lineHeight: 1.55 }}>
            {c.maintenance.down.length || c.maintenance.repair.length
              ? <>Down now: <b style={{ color: 'var(--x-bad-text)' }}>{Array.from(new Set([...c.maintenance.down, ...c.maintenance.repair])).join(', ')}</b>.</>
              : 'Every rig is running today.'}
          </div>
          {c.maintenance.recent.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              {c.maintenance.recent.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, color: T.muted }}>
                  <span><b style={{ color: T.text }}>{m.rig}</b> · {m.maintenanceType} · {m.component}</span><span style={{ whiteSpace: 'nowrap' }}>{day(m.date)} · {m.hours} h</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        <Card title="Drill logs in today" subtitle="Two shifts a rig: day and night." right={<Link href="/admin/logs/drill" style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Drill logs →</Link>}>
          <LogBar label="Your rigs" n={c.logsIn.ownIn} of={c.logsIn.ownExpected} note={c.logsIn.missing.length ? `Missing from ${c.logsIn.missing.join(', ')}` : 'All in'} />
          <div style={{ height: 14 }} />
          <LogBar label="Contractors" n={c.logsIn.ctrReported} of={c.logsIn.ctrExpected} note={c.logsIn.ctrUnchecked ? `${c.logsIn.ctrUnchecked} reported, waiting to be checked` : 'All checked'} />
        </Card>
        <Card title="Contractors" subtitle="Today, and their cost a metre this month." pad={false} right={<Link href="/admin/contractors" style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, textDecoration: 'none', marginRight: 2 }}>Contractors →</Link>}>
          {c.contractors.length === 0 ? <Empty>No contractor rigs this month.</Empty> : (
            <Table>
              <thead><tr><th style={th}>Contractor</th><th style={thR}>Metres today</th><th style={thR}>Downtime today</th><th style={thR}>Cost a metre</th><th style={thR}>This month</th></tr></thead>
              <tbody>
                {c.contractors.map(x => (
                  <tr key={x.id} style={{ borderTop: rowLine }}>
                    <td style={td}><div style={{ color: T.text, fontWeight: 600 }}>{x.name}</div><div style={{ fontSize: 11.5, color: T.faint }}>{x.rigs.join(', ')}</div></td>
                    <td style={tdR}>{num(x.metresToday)} m{x.uncheckedToday ? <div style={{ fontSize: 11.5, color: T.faint }}>not checked yet</div> : null}</td>
                    <td style={{ ...tdR, color: x.downtimeToday ? 'var(--x-bad-text)' : T.muted }}>{x.downtimeToday ? `${num(x.downtimeToday)} h` : '0'}</td>
                    <td style={{ ...tdR, color: T.text, fontWeight: 700 }}>{x.cpm != null ? perUnit(x.cpm) : '—'}</td>
                    <td style={tdR}>{num(x.monthMetres)} m</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        <Card title={`${monthLabel(o.month)} so far`} subtitle={`Against the first ${o.dayOfMonth} days of ${lastMonth}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 14 }}>
            <Fig label="Metres" value={`${num(o.now.metres)} m`} note={<Delta now={o.now.metres} before={o.prev.metres} />} />
            <Fig label="Billable value" value={moneyL(o.now.revenue)} note={<Delta now={o.now.revenue} before={o.prev.revenue} />} />
            <Fig label="Cost a metre" value={perUnit(o.now.costPerMetre)} note={<Delta now={o.now.costPerMetre} before={o.prev.costPerMetre} goodWhenUp={false} />} />
            <Fig label="Margin" value={`${o.now.marginPct.toFixed(1)}%`} note={<Delta now={o.now.marginPct} before={o.prev.marginPct} unit="pts" />} />
          </div>
        </Card>
        <Card title="Stores" subtitle="What you hold, and what is not moving." right={<Link href="/admin/inventory" style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Stores →</Link>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <Mini label="In the stores" value={moneyL(stock.store)} />
            <Mini label="On the rigs" value={moneyL(stock.rigs)} />
            <Mini label={`Idle ${inv.alerts.idleDays}+ days`} value={moneyL(stock.idle)} bad={stock.idle > 0} />
          </div>
        </Card>
      </div>
    </Page>
  )
}

function Kpi({ label, value, note, href, bad }: { label: string; value: string; note?: React.ReactNode; href?: string; bad?: boolean }) {
  const inner = <>
    <span style={{ fontSize: 12.5, color: T.muted, fontWeight: 600 }}>{label}</span>
    <span style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: bad ? 'var(--x-bad-text)' : T.text, lineHeight: 1.15 }}>{value}</span>
    {note && <span style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.4 }}>{note}</span>}
  </>
  const style: React.CSSProperties = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '13px 15px', display: 'grid', gap: 4, alignContent: 'start', boxShadow: 'var(--x-card-shadow)', textDecoration: 'none' }
  return href ? <Link href={href} className="xpl-row" style={style}>{inner}</Link> : <div style={style}>{inner}</div>
}
function Mini({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return <div style={{ padding: '10px 12px', borderRadius: 10, background: bad ? tint(T.red, 7) : 'rgba(var(--x-ov),0.035)', display: 'grid', gap: 3 }}>
    <span style={{ fontSize: 12, color: bad ? 'var(--x-bad-text)' : T.muted, fontWeight: 600 }}>{label}</span>
    <span style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: bad ? 'var(--x-bad-text)' : T.text }}>{value}</span>
  </div>
}
function Fig({ label, value, note }: { label: string; value: string; note: React.ReactNode }) {
  return <div style={{ display: 'grid', gap: 3 }}>
    <span style={{ fontSize: 12.5, color: T.muted }}>{label}</span>
    <span style={{ fontFamily: display, fontSize: 21, fontWeight: 700, color: T.text }}>{value}</span>
    <span style={{ fontSize: 12 }}>{note}</span>
  </div>
}
function LogBar({ label, n, of, note }: { label: string; n: number; of: number; note: string }) {
  const full = of > 0 && n >= of
  return <div style={{ display: 'grid', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: T.text }}><b>{label}</b><span><b>{n}</b> of {of} shifts</span></div>
    <div aria-hidden style={{ height: 10, borderRadius: 99, background: 'rgba(var(--x-ov),0.06)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${of ? Math.min(100, (n / of) * 100) : 0}%`, background: full ? T.green : T.amber, borderRadius: 99 }} /></div>
    <span style={{ fontSize: 12, color: full ? T.faint : 'var(--x-bad-text)' }}>{note}</span>
  </div>
}
