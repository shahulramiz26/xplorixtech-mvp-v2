'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { moneyL, perUnit, monthLabel, shiftMonth, projectCode, monthOf, useCosting } from '../../../lib/costing-store'
import { useInventory } from '../../../lib/inventory-store'
import { IS_DEMO } from '../../../lib/company'
import { useAdminOverview, financeLink, RIG_STATUS_LABEL, type RigStatus, type Attention } from '../../../lib/admin-overview'
import { num } from '../../../lib/client-record'
import { buildFindings, deptLabel, SEVERITY_LABEL } from '../../../lib/findings'
import {
  Page, Head, Card, Split, Btn, Table, Status, Legend, Tip, DepthBar, Spark, Delta, Empty,
  th, thR, td, tdR, rowLine, T, display, toneColor, axisTick, gridStroke, type Tone,
} from '../../components/kit'

/* DASHBOARD — the contractor's day on one screen.
 *
 * Nothing on this page is typed in. Rigs, metres and stoppages come from the
 * shift logs; cost, revenue and margin from the same costing call Finance
 * uses; stock problems from Inventory. Every figure links to the screen that
 * explains it.
 *
 * It is laid out in the order an owner asks his questions each morning:
 * what needs me, are the rigs turning, are we making money. */

const statusTone: Record<RigStatus, Tone> = { drilling: 'good', standby: 'warn', breakdown: 'bad', 'no-shift': 'neutral', 'to-check': 'warn', idle: 'neutral' }

/* A new company opens on an empty Dashboard. This says what to do first, in
 * the order it has to be done, and ticks each step off from the record
 * itself. It goes away once the first shift is logged. */
function StartHere() {
  const { state } = useCosting()
  const { state: inv } = useInventory()
  if (IS_DEMO || state.shiftLogs.length > 0) return null
  const hasProject = state.projects.length > 0
  const steps: { done: boolean | null; title: string; detail: string; href: string; action: string }[] = [
    { done: null, title: 'Change your password', detail: 'You were given it by XPLORIX. Make it your own.', href: '/admin/settings', action: 'Open Settings' },
    { done: hasProject, title: 'Create your first project', detail: 'The client, the contract rates, the rigs and crew on it, and the holes to drill.', href: '/admin/projects/new', action: 'New project' },
    { done: state.ownership.length + state.operating.length > 0, title: 'Enter what each rig costs', detail: 'Fuel, crew and the rig itself, in Finance under Set costs. Without it Finance shows what you bill, and no cost or margin.', href: '/admin/finance', action: 'Open Finance' },
    { done: state.users.length > 0, title: 'Create the logins', detail: 'One for each supervisor, and for a contractor or your client if you want them to sign in.', href: '/admin/users', action: 'Open Users' },
    { done: inv.catalogue.length > 0, title: 'Add your bits and parts', detail: 'Can wait. Needed when you want parts cost on each metre and stock warnings.', href: '/admin/inventory', action: 'Open inventory' },
    { done: false, title: 'Log the first shift', detail: 'A supervisor signs in and saves a drill log. From then on this Dashboard fills itself.', href: '/admin/logs/drill', action: 'Open drill logs' },
  ]
  return (
    <Card title="Start here" subtitle="Six steps to your first day on XPLORIX. Each one is ticked when it is done." pad={false}>
      {steps.map((s, i) => (
        <Link key={s.title} href={s.href} className="xpl-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderTop: i ? rowLine : undefined, textDecoration: 'none' }}>
          <span aria-hidden style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700,
            background: s.done ? 'color-mix(in srgb, var(--x-green) 16%, transparent)' : 'rgba(var(--x-ov),0.05)', color: s.done ? T.green : T.muted,
            border: `1px solid ${s.done ? 'color-mix(in srgb, var(--x-green) 40%, transparent)' : T.border}`,
          }}>{s.done ? '✓' : i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.title}{s.done && <span style={{ fontWeight: 400, color: T.faint }}> · done</span>}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2, lineHeight: 1.5 }}>{s.detail}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.orange, whiteSpace: 'nowrap' }}>{s.action} →</span>
        </Link>
      ))}
    </Card>
  )
}

/* XPLORIX Intelligence on the Dashboard: the five things to act on first,
 * and whether the drill logs underneath every figure can be trusted. The full
 * list, with who does what and by when, is on Intelligence > Today. */
function IntelligenceCard({ intel, handled }: { intel: ReturnType<typeof buildFindings>; handled: Record<string, { status: string }> }) {
  const open = intel.findings.filter(f => !handled[f.id] || handled[f.id].status === 'assigned')
  const act = open.filter(f => f.severity === 'act')
  const top = (act.length ? act : open).slice(0, 5)
  const atStake = open.reduce((s, f) => s + (f.money ?? 0), 0)
  const clean = intel.audits.filter(a => a.checks.length === 0).length
  const pct = intel.audits.length ? Math.round((clean / intel.audits.length) * 100) : 100
  const pctTone: Tone = pct >= 90 ? 'good' : pct >= 70 ? 'warn' : 'bad'
  const sevTone: Record<string, Tone> = { act: 'bad', plan: 'warn', watch: 'neutral' }
  return (
    <Card title="XPLORIX Intelligence" pad={false}
      subtitle={open.length ? `${open.length} open across the company · ${act.length} to act on now · ${moneyL(atStake)} at stake` : 'Nothing in the record needs action today.'}
      right={<Btn href="/admin/intelligence">Open Today</Btn>}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: T.muted }}>Drill logs that pass every check</span>
        <b style={{ fontSize: 15, color: toneColor[pctTone] }}>{pct}%</b>
        <Link href="/admin/intelligence/drill-logs" style={{ fontSize: 12.5, color: T.orange, textDecoration: 'none', fontWeight: 600, marginLeft: 'auto' }}>
          {intel.audits.length - clean} of {intel.audits.length} shifts to look at →
        </Link>
      </div>
      {top.length === 0
        ? <Empty>Nothing to act on. New findings appear here as each shift comes in.</Empty>
        : top.map((f, i) => {
          const body = (
            <div style={{ display: 'flex', gap: 12, padding: '12px 18px', borderTop: i ? `1px solid ${T.line}` : 'none', alignItems: 'flex-start' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: toneColor[sevTone[f.severity]], flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 3 }}>
                  {SEVERITY_LABEL[f.severity]} · {deptLabel(f.dept)} · {f.owner}{f.money ? ` · ${moneyL(f.money)}` : ''}
                </div>
              </div>
              {f.href && <ChevronRight size={16} style={{ color: T.faint, flexShrink: 0, marginTop: 3 }} />}
            </div>
          )
          return f.href
            ? <Link key={f.id} href={f.href} className="xpl-row" style={{ display: 'block', textDecoration: 'none' }}>{body}</Link>
            : <div key={f.id}>{body}</div>
        })}
    </Card>
  )
}

export default function AdminDashboard() {
  const o = useAdminOverview()
  const { state: costing } = useCosting()
  const { state: inv } = useInventory()
  // The same findings as XPLORIX Intelligence > Today, the most urgent first.
  const intel = useMemo(() => buildFindings(costing, inv), [costing, inv])
  const drilling = o.rigs.filter(r => r.status === 'drilling').length
  const working = o.rigs.filter(r => r.project).length
  const todayMetres = o.rigs.reduce((s, r) => s + (r.day ?? 0) + (r.night ?? 0), 0)
  const prevPerDay = o.prev.rigDays ? o.prev.metres / o.dayOfMonth : 0
  const lostOwn = o.lost.filter(l => l.own).reduce((s, l) => s + l.hours, 0)
  const lostClient = o.lost.filter(l => !l.own).reduce((s, l) => s + l.hours, 0)
  const lostMax = Math.max(...o.lost.map(l => l.hours), 1)
  const lastMonth = monthLabel(shiftMonth(o.month, -1)).split(' ')[0]

  return (
    <Page>
      <Head
        title="Dashboard"
        sub={<>
          {drilling} of {working} rigs are drilling today, {num(todayMetres)} m so far.{' '}
          {o.attention.length
            ? <><b style={{ color: T.text }}>{o.attention.length} {o.attention.length === 1 ? 'thing needs' : 'things need'} you.</b></>
            : <>Nothing needs you right now.</>}
        </>}
        right={<>
          <Btn href="/admin/projects">New project</Btn>
          <Btn href="/admin/finance" kind="primary">Open Finance</Btn>
        </>}
      />

      <StartHere />

      <Split left={3} right={2}>
        <Card title={`Needs you${o.attention.length ? ` · ${o.attention.length}` : ''}`} subtitle="Most urgent first. Each line opens the screen where you fix it." pad={false}>
          {o.attention.length === 0
            ? <Empty>Nothing is waiting. Breakdowns, returned holes, disputed invoices and stock problems appear here as they happen.</Empty>
            : o.attention.map((a, i) => <AttentionRow key={a.key} a={a} first={i === 0} />)}
        </Card>

        <Card title={`${monthLabel(o.month)} so far`} subtitle={`Against the first ${o.dayOfMonth} days of ${lastMonth}`}>
          <Figure label="Metres drilled" value={`${num(o.now.metres)} m`}
            note={<>{o.now.perRigDay.toFixed(1)} m per rig per day · <Delta now={o.now.perRigDay} before={o.prev.perRigDay} /></>} />
          <Figure label="Billable value" value={moneyL(o.now.revenue)}
            note={<>{perUnit(o.now.ratePerMetre)} earned · <Delta now={o.now.revenue} before={o.prev.revenue} /></>} />
          <Figure label="Cost per metre" value={perUnit(o.now.costPerMetre)}
            note={<Delta now={o.now.costPerMetre} before={o.prev.costPerMetre} goodWhenUp={false} />} />
          <Figure label="Margin" value={`${o.now.marginPct.toFixed(1)}%`} last
            note={<>{moneyL(o.now.margin)} · <Delta now={o.now.marginPct} before={o.prev.marginPct} unit="pts" /></>} />
        </Card>
      </Split>

      {costing.shiftLogs.length > 0 && <IntelligenceCard intel={intel} handled={costing.findingStatus ?? {}} />}

      <Card title="Rigs today" subtitle="Where each rig is, how deep its hole has gone, and what it did on today's two shifts" pad={false}
        right={<Link href="/admin/rigs" style={{ fontSize: 12.5, color: T.muted, textDecoration: 'none' }}>All rigs</Link>}>
        <Table>
          <thead>
            <tr>
              <th style={th}>Rig</th><th style={th}>Status</th><th style={th}>Project and hole</th><th style={th}>Hole depth</th>
              <th style={thR}>Day shift</th><th style={thR}>Night shift</th><th style={thR}>This month</th><th style={thR}>Hours lost</th>
              <th style={th}>Last 14 days</th><th style={th} />
            </tr>
          </thead>
          <tbody>
            {o.rigs.length === 0 && <tr><td colSpan={10} style={{ ...td, padding: 22, textAlign: 'center', whiteSpace: 'normal' }}>No rig is on a project yet. A rig appears here once it is on a project.</td></tr>}
            {o.rigs.map(r => (
              <tr key={r.rig} className="xpl-row" style={{ borderBottom: rowLine }}>
                <td style={{ ...td, color: T.text, fontWeight: 700, fontFamily: display, fontSize: 14 }}>
                  {r.rig}
                  {r.contractor && <div style={{ fontSize: 11.5, color: T.faint, fontWeight: 400, fontFamily: 'inherit', marginTop: 3 }}>{r.contractor}&apos;s rig</div>}
                </td>
                <td style={td}>
                  <Status tone={statusTone[r.status]}>{RIG_STATUS_LABEL[r.status]}</Status>
                  <div style={{ fontSize: 11.5, color: T.faint, marginTop: 5, whiteSpace: 'normal', maxWidth: 190 }}>{r.note}</div>
                </td>
                <td style={td}>
                  {r.project ? <>
                    <div style={{ color: T.text }}>{r.hole ?? 'No hole'}</div>
                    <div style={{ fontSize: 11.5, color: T.faint, marginTop: 3 }}>{projectCode(r.project)} · {r.project}</div>
                  </> : <span style={{ color: T.dim }}>Not assigned</span>}
                </td>
                <td style={td}>{r.hole ? <DepthBar drilled={r.holeDrilled} planned={r.holePlanned} /> : <span style={{ color: T.dim }}>—</span>}</td>
                <td style={tdR}>{r.day == null ? <span style={{ color: T.dim }}>not in</span> : `${r.day} m`}</td>
                <td style={tdR}>{r.night == null ? <span style={{ color: T.dim }}>not in</span> : `${r.night} m`}</td>
                <td style={tdR}>
                  <div style={{ color: T.text, fontWeight: 600 }}>{num(r.monthMetres)} m</div>
                  <div style={{ fontSize: 11.5, color: T.faint, marginTop: 3 }}>{r.monthDays ? (r.monthMetres / r.monthDays).toFixed(1) : '0'} m a day</div>
                  {r.target && r.monthDays > 0 && (
                    <div style={{ fontSize: 11.5, marginTop: 2, color: r.monthOnTarget < r.monthDays ? T.amber : T.green }}>{r.monthOnTarget} of {r.monthDays} days at {r.target} m</div>
                  )}
                </td>
                <td style={tdR}>{r.monthLostHours ? `${r.monthLostHours} h` : <span style={{ color: T.dim }}>0</span>}</td>
                <td style={td}><Spark values={r.last14} /></td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {r.status === 'to-check' && r.project
                    ? <Btn size="sm" kind="primary" href={`/admin/contractors?tab=reports&project=${encodeURIComponent(r.project)}`}>Check</Btn>
                    : r.project && <Btn size="sm" href={financeLink({ project: r.project, rig: r.rig, month: o.month })}>Costing</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Split left={3} right={2}>
        <Card title={`Metres per day, ${monthLabel(o.month)}`} subtitle="All rigs together">
          {prevPerDay > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Legend items={[
                { color: T.bar, label: 'Metres drilled' },
                { color: T.muted, label: `${lastMonth} average for the same days, ${prevPerDay.toFixed(0)} m a day`, line: true },
              ]} />
            </div>
          )}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={o.daily} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={{ stroke: T.border }} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v} m`} />
              <Tooltip cursor={{ fill: 'rgba(var(--x-ov),0.03)' }}
                content={({ active, payload, label }) => active && payload?.length
                  ? <Tip active label={`${label} ${monthLabel(o.month).split(' ')[0]}`} unit=" m" payload={[{ dataKey: 'metres', name: 'Metres drilled', value: payload[0].value as number, color: T.bar }]} />
                  : null} />
              {prevPerDay > 0 && <ReferenceLine y={prevPerDay} stroke={T.muted} />}
              <Bar dataKey="metres" fill={T.bar} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Hours lost this month" subtitle={`${lostOwn} h on your side (not billable) · ${lostClient} h client-side (billable standby)`}>
          {o.lost.length === 0 ? <Empty>No stoppages logged this month.</Empty> : <>
            <div style={{ marginBottom: 14 }}>
              <Legend items={[{ color: T.ownSide, label: 'Your side' }, { color: T.clientSide, label: 'Client side' }]} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {o.lost.map(l => (
                <div key={l.reason} title={`${l.reason}: ${l.hours} hours`} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 40px', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12.5, color: T.muted, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason}</span>
                  <div style={{ height: 16 }}>
                    <div style={{ width: `${(l.hours / lostMax) * 100}%`, minWidth: 3, height: '100%', background: l.own ? T.ownSide : T.clientSide, borderRadius: '0 4px 4px 0' }} />
                  </div>
                  <span style={{ fontSize: 12.5, color: T.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{l.hours} h</span>
                </div>
              ))}
            </div>
          </>}
        </Card>
      </Split>

      <Card title="Money waiting" subtitle="From the hole being closed to the invoice being paid">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 0 }}>
          <Stage n={o.money.toSend.length} label="Closed, not yet approved" value={o.money.toSendValue}
            href={o.money.toSend[0] ? financeLink({ project: o.money.toSend[0].project, rig: o.money.toSend[0].rig, month: monthOf(o.money.toSend[0].end ?? o.money.toSend[0].start), tab: 'Drillholes' }) : '/admin/finance'} unit="holes" />
          <Stage n={o.money.waitingOwner.length} label="With the client" value={o.money.waitingOwner.reduce((s, h) => s + h.value, 0)} href="/admin/finance" unit="holes" />
          <Stage n={o.money.readyToInvoice.length} label="Approved, ready to invoice" value={o.money.readyValue}
            href={o.money.readyToInvoice[0] ? financeLink({ project: o.money.readyToInvoice[0].project, rig: o.money.readyToInvoice[0].rig, month: monthOf(o.money.readyToInvoice[0].end ?? o.money.readyToInvoice[0].start), tab: 'Drillholes' }) : '/admin/finance'} unit="holes" />
          <Stage n={o.money.unpaid.length} label="Invoiced, not yet paid" value={o.money.outstanding} href="/admin/finance?tab=Tracker" unit="invoices"
            warn={o.money.overdue.length ? `${o.money.overdue.length} overdue` : undefined} last />
        </div>
      </Card>
    </Page>
  )
}

function AttentionRow({ a, first }: { a: Attention; first: boolean }) {
  return (
    <Link href={a.href} className="xpl-row" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 18px', textDecoration: 'none', borderTop: first ? 'none' : `1px solid ${T.line}` }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: toneColor[a.tone], flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{a.title}</div>
        <div style={{ fontSize: 12.5, color: T.faint, marginTop: 3, lineHeight: 1.45 }}>{a.detail}</div>
      </div>
      <span style={{ fontSize: 12.5, color: T.muted, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>{a.action}<ChevronRight size={14} /></span>
    </Link>
  )
}

function Figure({ label, value, note, last }: { label: string; value: string; note: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'baseline', padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${T.line}` }}>
      <div>
        <div style={{ fontSize: 13, color: T.muted }}>{label}</div>
        <div style={{ fontSize: 12, color: T.faint, marginTop: 4, lineHeight: 1.45 }}>{note}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: display, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

/* One step on the way from a closed hole to cash. The four sit in a row so the
 * place where money is stuck is the one with the big number. */
function Stage({ n, label, value, href, unit, warn, last }: { n: number; label: string; value: number; href: string; unit: string; warn?: string; last?: boolean }) {
  return (
    <Link href={href} className="xpl-row" style={{ display: 'block', padding: '4px 18px 6px', textDecoration: 'none', borderRight: last ? 'none' : `1px solid ${T.line}` }}>
      <div style={{ fontSize: 12.5, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: n ? T.text : T.dim, fontFamily: display, margin: '6px 0 4px' }}>{n ? moneyL(value) : '—'}</div>
      <div style={{ fontSize: 12, color: T.faint }}>
        {n} {n === 1 ? unit.replace(/s$/, '') : unit}
        {warn && <span style={{ color: T.amber, marginLeft: 8, fontWeight: 600 }}>! {warn}</span>}
      </div>
    </Link>
  )
}
