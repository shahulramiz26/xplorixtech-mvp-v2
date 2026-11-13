'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useCosting } from '../../../../lib/costing-store'
import { useTeam, fmtHours, colourOf, MIN_METRES, PERIOD_LABEL, type Period } from '../../../../lib/core/team'
import { Page, PageHead, Grid, Tile, Card, Btn, Table, Status, Empty, Seg, Legend, Tip, Note, th, thR, td, tdR, tdStrong, rowLine, T, axisTick, gridStroke } from '../../../components/kit'
import { ScoreBar } from '../../../components/geo-team'

/* GEOLOGISTS — the Company Admin's view of who checks the core, and how well.
 *
 * Ranked by a score out of 100: output, speed and care, each against the best
 * in the team. Every number comes from the checks and corrections carrying
 * the geologist's name; click a geologist for their work, tray by tray. */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dshort = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`
const m = (v: number) => `${Math.round(v).toLocaleString('en-US')} m`

export default function Geologists() {
  const { state } = useCosting()
  const [period, setPeriod] = useState<Period>('30')
  const team = useTeam(period)

  if (!team.ready) return <Page><Card><Empty>Loading the core record…</Empty></Card></Page>
  const ranked = team.list.filter(s => s.ranked)
  const top = ranked[0]
  const geos = state.users.filter(u => u.role === 'geologist')

  return (
    <Page>
      <PageHead question="Who is checking the core, and how well?"
        tone={team.waiting > 50 ? 'warn' : 'good'}
        answer={geos.length === 0 ? 'No geologist logins yet. Create one under Users, and give it the projects it logs core on.'
          : <>{ranked.length} of {geos.length} geologists signed off <b>{m(team.totalMetres)}</b> of core ({PERIOD_LABEL[period].toLowerCase()}). {top ? <><b>{top.name}</b> leads with a score of {top.score}.</> : null} Average time from photo to check: {fmtHours(team.turnaround)}. {team.waiting} trays still wait.</>}
        right={<><Seg<Period> value={period} onChange={setPeriod} options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: 'all', label: 'All time' }]} /><Btn kind="primary" href="/admin/users?new=geologist">Geologist login</Btn></>} />

      <Grid>
        <Tile label="Geologists" value={geos.filter(g => g.active).length} note={`${ranked.length} ranked, ${team.list.length - ranked.length} with too little to rank`} />
        <Tile label="Core signed off" value={m(team.totalMetres)} note={PERIOD_LABEL[period]} />
        <Tile label="Photo to check" value={fmtHours(team.turnaround)} note="Average, weighted by trays" tone={team.turnaround != null && team.turnaround > 48 ? 'warn' : 'good'} />
        <Tile label="Trays waiting" value={team.waiting} note="On every project" tone={team.waiting ? 'warn' : 'good'} />
      </Grid>

      <Card title="Ranking" subtitle={`Score out of 100: output 40, speed 30, care 30 (unsure breaks reviewed, and geology notes), each against the best in the team. Under ${MIN_METRES} m signed off in the period is shown but not ranked.`} pad={false}>
        {team.list.length === 0 ? <Empty>No geologist logins yet.</Empty> : (
          <Table>
            <thead><tr>
              <th style={th}>#</th><th style={th}>Geologist</th><th style={th}>Score</th><th style={thR}>Signed off</th><th style={thR}>Trays</th>
              <th style={thR}>Photo to check</th><th style={thR}>Unsure breaks reviewed</th><th style={thR}>Notes</th><th style={thR}>Waiting on projects</th><th style={th}>Projects</th><th style={th} />
            </tr></thead>
            <tbody>
              {team.list.map(s => (
                <tr key={s.user.id} className="xpl-row" style={{ borderBottom: rowLine }}>
                  <td style={{ ...tdStrong, width: 34 }}>{s.rank ?? '–'}</td>
                  <td style={tdStrong}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: colourOf(state.users, s.user.id) }} />
                      <Link href={`/admin/geology/geologists/${s.user.id}`} style={{ color: T.text, textDecoration: 'none' }}>{s.name}</Link>
                    </span>
                    <div style={{ fontSize: 12, color: T.faint, fontWeight: 400, marginTop: 2 }}>{s.user.employer ?? '—'}{!s.user.active ? ' · switched off' : ''}</div>
                  </td>
                  <td style={td}><ScoreBar s={s} /></td>
                  <td style={tdR}>{m(s.metres)}</td>
                  <td style={tdR}>{s.trays}</td>
                  <td style={tdR}>{fmtHours(s.turnaround)}</td>
                  <td style={tdR}>{s.unsure ? `${Math.round(s.care)}%` : '–'}</td>
                  <td style={tdR}>{s.notes}</td>
                  <td style={tdR}>{s.backlog ? <Status tone="warn">{s.backlog} trays</Status> : <Status tone="good">None</Status>}</td>
                  <td style={{ ...td, whiteSpace: 'normal', minWidth: 150 }}>{(s.user.projects ?? []).join(', ') || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}><Link href={`/admin/geology/geologists/${s.user.id}`} style={{ color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Their work →</Link></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div style={{ display: 'flex', gap: 16, padding: '12px 18px', borderTop: rowLine, flexWrap: 'wrap' }}>
          <Legend items={[{ color: 'var(--x-orange)', label: 'Output: metres signed off' }, { color: 'var(--x-blue)', label: 'Speed: photo to check' }, { color: 'var(--x-teal)', label: 'Care: unsure breaks reviewed, and geology notes' }]} />
        </div>
      </Card>

      <Card title="Core signed off by week" subtitle="Metres of core each geologist checked, week by week.">
        {team.chart.length === 0 ? <Empty>No trays checked in this period.</Empty> : (
          <div style={{ display: 'grid', gap: 10 }}>
            <Legend items={team.list.map(s => ({ color: colourOf(state.users, s.user.id), label: s.name }))} />
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={team.chart} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={dshort} minTickGap={16} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={v => `${v} m`} />
                  <Tooltip content={<Tip unit=" m" names={Object.fromEntries(team.list.map(s => [s.user.id, s.name]))} />} cursor={{ fill: 'rgba(var(--x-ov),0.04)' }} labelFormatter={l => `Week of ${dshort(String(l))}`} />
                  {team.list.map((s, i) => <Bar key={s.user.id} dataKey={s.user.id} stackId="w" fill={colourOf(state.users, s.user.id)} isAnimationActive={false} radius={i === team.list.length - 1 ? [3, 3, 0, 0] : undefined} maxBarSize={40} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      <Note>
        <b style={{ color: T.text }}>Reading the ranking fairly.</b> Speed alone would reward rushing, so care counts as much as speed: a geologist who checks trays without reviewing the breaks the photo step was unsure of, or adding what the photo cannot show, scores low on care. Care is a share, so a hole with many unsure breaks does not count for or against anyone.
        Ground differs between projects, so compare geologists on the same project first. Each geologist&apos;s page shows the trays behind every number.
      </Note>
    </Page>
  )
}
