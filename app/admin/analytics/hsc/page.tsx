'use client'

import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { safety, safetyInsights } from '../../../../lib/analytics'
import { day } from '../../../../lib/projects'
import { Page, PageHead, Card, Tile, Grid, Split, Table, Meter, Empty, Tip, Status, axisTick, gridStroke, th, td, tdR, tdStrong, rowLine, T } from '../../../components/kit'
import { useAnalytics, BoardTabs, FilterBar, n0, InsightsCard } from '../shared'
import { MIDDAY_BAN, OUTCOME_LABEL, RECORDABLE, type HseGroup } from '../../../../lib/hse'

/* HEALTH AND SAFETY — is everyone working safely?
 * Every incident and near miss the supervisors logged on a drill log, the
 * man-hours behind them (crew × shift hours), injury rates per million
 * man-hours, the Saudi midday ban on day shifts, and shifts with no rest. */

const f1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US')
function RateTable({ rows, label }: { rows: HseGroup[]; label: string }) {
  return (
    <Table>
      <thead><tr><th style={th}>{label}</th><th style={{ ...th, textAlign: 'right' }}>Man-hours</th><th style={{ ...th, textAlign: 'right' }}>Events</th><th style={{ ...th, textAlign: 'right' }}>Recordable</th><th style={{ ...th, textAlign: 'right' }}>LTI</th><th style={{ ...th, textAlign: 'right' }}>TRIFR</th></tr></thead>
      <tbody>
        {rows.map(g => (
          <tr key={g.name} style={{ borderBottom: rowLine }}>
            <td style={tdStrong}>{g.name}</td><td style={tdR}>{n0(g.manHours)}</td><td style={tdR}>{g.events}</td><td style={tdR}>{g.recordable}</td><td style={tdR}>{g.lti}</td>
            <td style={tdR}>{g.recordable ? <Status tone="warn">{f1(g.trifr)}</Status> : '0'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export default function SafetyDashboard() {
  const { state, f } = useAnalytics()
  const x = useMemo(() => safety(state, f), [state, f])
  const h = x.h
  const insights = useMemo(() => safetyInsights(x).filter(i => i.id !== 'count'), [x])
  const topType = Math.max(1, ...x.byType.map(t => t.value))
  const sevTone = (s: string) => /high|serious|major|critical/i.test(s) ? 'bad' as const : /medium|moderate/i.test(s) ? 'warn' as const : 'info' as const

  return (
    <Page>
      <PageHead question="Is everyone working safely?" tone={x.incidents.some(i => sevTone(i.severity) === 'bad') ? 'bad' : x.incidents.length ? 'warn' : 'neutral'}
        answer={x.shifts
          ? <>{x.incidents.length ? `${x.incidents.length} ${x.incidents.length === 1 ? 'incident' : 'incidents'}` : 'No incidents'} logged in {n0(x.shifts)} shifts {x.s.label}.</>
          : <>No shifts logged for these filters.</>}
        right={<FilterBar />} />
      <BoardTabs />

      <Grid min={170}>
        <Tile label="Man-hours" value={n0(h.manHours)} note={`${n0(x.shifts)} shifts · crew × shift hours`} />
        <Tile label="LTIFR" value={f1(h.ltifr)} note={`${h.lti} lost-time ${h.lti === 1 ? 'injury' : 'injuries'} · per million man-hours`} tone={h.lti ? 'bad' : 'good'} />
        <Tile label="TRIFR" value={f1(h.trifr)} note={`${h.recordable} recordable · per million man-hours`} tone={h.recordable ? 'warn' : 'good'} />
        <Tile label="Days since a lost-time injury" value={h.daysSinceLti ?? (h.shifts ? 'None' : '—')} note={h.daysSinceRecordable != null ? `${h.daysSinceRecordable} days since a recordable` : 'No recordable injury'} tone={h.lti ? undefined : 'good'} />
        <Tile label="Midday ban kept" value={h.banCompliance != null ? `${h.banCompliance}%` : '—'} note={h.ban.length ? `${h.banWorked.length} worked through · ${h.banMissing.length} not recorded · ${h.ban.length} day shifts` : 'No day shift in the ban window'} tone={h.banWorked.length ? 'bad' : h.banMissing.length ? 'warn' : h.ban.length ? 'good' : undefined} />
        <Tile label="Incidents and near misses" value={x.incidents.length} note={`${x.incidents.filter(i => /near miss/i.test(i.type)).length} near misses`} tone={x.incidents.length ? 'warn' : undefined} />
      </Grid>
      {h.manHours > 0 && h.manHours < 200000 && <div style={{ fontSize: 12.5, color: T.faint, margin: '-4px 2px 12px' }}>Rates are per million man-hours. On {n0(h.manHours)} hours one injury moves them a lot: read the counts beside them.</div>}

      <InsightsCard insights={insights} empty="No safety finding for these filters." />

      <Split>
        <Card title="By rig" subtitle="TRIFR per million man-hours." pad={false}><RateTable rows={h.byRig} label="Rig" /></Card>
        <Card title="Own crews and sub-contractors" subtitle="The same measures for every company on site." pad={false}><RateTable rows={h.byCompany} label="Company" /></Card>
      </Split>

      <Card title="Saudi midday ban" subtitle={`No work under direct sun ${MIDDAY_BAN.start}–${MIDDAY_BAN.end}, 15 June to 15 September (${MIDDAY_BAN.who}). Every day shift drilled in that window, from the heat lines on the drill log.`} pad={false}>
        {h.ban.length === 0 ? <Empty>No day shift drilled in the ban window for these filters.</Empty> : <>
          <div style={{ display: 'flex', gap: 24, padding: '14px 18px', borderBottom: rowLine, fontSize: 13.5, flexWrap: 'wrap' }}>
            <span><b>{h.ban.filter(b => b.status === 'stopped').length}</b> stopped for the ban</span>
            <span style={{ color: h.banWorked.length ? T.red : undefined }}><b>{h.banWorked.length}</b> worked through</span>
            <span style={{ color: h.banMissing.length ? T.amber : undefined }}><b>{h.banMissing.length}</b> not recorded</span>
            <span><b>{Math.max(0, ...h.ban.map(b => b.maxTempC ?? 0)) || '—'}</b> °C hottest logged</span>
          </div>
          <Table>
            <thead><tr><th style={th}>Date</th><th style={th}>Rig</th><th style={th}>Driller</th><th style={th}>Midday stop</th><th style={{ ...th, textAlign: 'right' }}>Max °C</th><th style={th}>Water</th><th style={th}>Shade</th></tr></thead>
            <tbody>
              {[...h.ban.filter(b => b.status !== 'stopped' || b.shade === false || b.water === false), ...h.ban.filter(b => b.status === 'stopped' && b.shade !== false && b.water !== false)].slice(0, 12).map(b => (
                <tr key={b.id} style={{ borderBottom: rowLine }}>
                  <td style={tdStrong}>{day(b.date)}</td><td style={td}>{b.rig}</td><td style={td}>{b.driller ?? '—'}</td>
                  <td style={td}><Status tone={b.status === 'stopped' ? 'good' : b.status === 'worked' ? 'bad' : 'warn'}>{b.status === 'stopped' ? 'Stopped 12–3' : b.status === 'worked' ? 'Worked through' : 'Not recorded'}</Status></td>
                  <td style={tdR}>{b.maxTempC ?? '—'}</td><td style={td}>{b.water == null ? '—' : b.water ? 'Yes' : <Status tone="warn">No</Status>}</td><td style={td}>{b.shade == null ? '—' : b.shade ? 'Yes' : <Status tone="warn">No</Status>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {h.ban.length > 12 && <div style={{ padding: '10px 18px', fontSize: 12.5, color: T.faint }}>Problems first, then the latest of {h.ban.length} shifts.</div>}
        </>}
      </Card>

      <Card title="Fatigue" subtitle="Shifts over 12 hours, and a night shift followed straight by a day shift. Long runs of days are on the Driller and crew board." pad={false}>
        {h.fatigue.length === 0 ? <Empty>No long shift or night-to-day turnaround for these filters.</Empty> : (
          <Table>
            <thead><tr><th style={th}>Date</th><th style={th}>Who</th><th style={th}>Rig</th><th style={th}>What</th></tr></thead>
            <tbody>
              {h.fatigue.map(f => (
                <tr key={f.id} style={{ borderBottom: rowLine }}>
                  <td style={tdStrong}>{day(f.date)}</td><td style={td}>{f.who}</td><td style={td}>{f.rig}</td><td style={{ ...td, whiteSpace: 'normal' }}>{f.detail}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {x.incidents.length === 0 ? <Card><Empty>No incident or near miss is logged for these filters. Supervisors add them on the drill log, under Incidents.</Empty></Card> : <>
        <Split>
          <Card title="By type" pad={false}>
            <Table>
              <tbody>
                {x.byType.map(t => (
                  <tr key={t.name} style={{ borderBottom: rowLine }}>
                    <td style={tdStrong}>{t.name}</td><td style={{ ...td, width: '45%' }}><Meter value={t.value} max={topType} color={T.amber} /></td><td style={tdR}>{t.value}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card title="By severity" pad={false}>
            <Table>
              <tbody>
                {x.bySeverity.map(t => (
                  <tr key={t.name} style={{ borderBottom: rowLine }}>
                    <td style={td}><Status tone={sevTone(t.name)}>{t.name}</Status></td><td style={tdR}>{t.value}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Split>
        <Card title="Week by week">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={x.trend} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<Tip names={{ incidents: 'Incidents' }} />} />
              <Bar dataKey="incidents" fill={T.amber} maxBarSize={30} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Every incident" subtitle="Newest first." pad={false}>
          <Table>
            <thead><tr><th style={th}>Date</th><th style={th}>Rig</th><th style={th}>Shift</th><th style={th}>Type</th><th style={th}>Severity</th><th style={th}>Counts as</th><th style={th}>What happened</th></tr></thead>
            <tbody>
              {x.incidents.map(i => (
                <tr key={i.id} style={{ borderBottom: rowLine }}>
                  <td style={tdStrong}>{day(i.date)}</td><td style={td}>{i.rig}</td><td style={td}>{i.shift}</td><td style={td}>{i.type}</td>
                  <td style={td}><Status tone={sevTone(i.severity)}>{i.severity}</Status></td>
                  <td style={td}>{(() => { const e = h.events.find(ev => ev.id === i.id); return e ? (RECORDABLE.includes(e.outcome) ? <Status tone="warn">{OUTCOME_LABEL[e.outcome]}</Status> : OUTCOME_LABEL[e.outcome]) : '—' })()}</td>
                  <td style={{ ...td, whiteSpace: 'normal' }}>{i.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </>}
      <Card title="Where these figures come from" subtitle="Nothing here is typed twice: every number is read from what supervisors and sub-contractors already log." pad={false}>
        <Table>
          <thead><tr><th style={th}>Figure</th><th style={th}>Read from</th><th style={th}>Entered by</th></tr></thead>
          <tbody>
            {[
              ['Man-hours', 'Drill log: crew on site × shift hours, every shift (a sub-contractor\'s own crew included)', 'Supervisor, sub-contractor'],
              ['Incidents, near misses', 'Drill log › Incidents: type, severity, what happened', 'Supervisor, sub-contractor'],
              ['LTIFR, TRIFR, days since', 'Drill log › Incidents › Counts as (first aid, medical, restricted, lost time) and days lost', 'Supervisor, sub-contractor'],
              ['Midday ban', 'Drill log › Heat (day shifts 15 Jun–15 Sep): stopped 12–3, max °C, water, shade', 'Supervisor, sub-contractor'],
              ['Fatigue', 'Drill log: driller, date, day or night, shift hours', 'Supervisor'],
              ['Own crews vs sub-contractors', 'Work orders: which rigs belong to which company', 'Company admin'],
            ].map(([a, b, c]) => (
              <tr key={a} style={{ borderBottom: rowLine }}><td style={tdStrong}>{a}</td><td style={{ ...td, whiteSpace: 'normal' }}>{b}</td><td style={td}>{c}</td></tr>
            ))}
          </tbody>
        </Table>
      </Card>

    </Page>
  )
}
