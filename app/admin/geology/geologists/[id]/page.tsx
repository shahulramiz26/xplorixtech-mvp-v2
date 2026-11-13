'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useCosting } from '../../../../../lib/costing-store'
import { useTeam, fmtHours, colourOf, MIN_METRES, PERIOD_LABEL, type Period, type Activity } from '../../../../../lib/core/team'
import { Page, PageHead, Grid, Tile, Card, Btn, Table, Status, Empty, Seg, Tip, Meter, Split, th, td, tdStrong, rowLine, T, axisTick, gridStroke, mono } from '../../../../components/kit'
import { ScoreBar } from '../../../../components/geo-team'

/* ONE GEOLOGIST — what they signed off, how fast, how carefully, and every
 * check and correction behind those numbers, with a link to the tray. */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dshort = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`
const when = (at: string) => `${dshort(at)} ${at.slice(11, 16)}`
const m = (v: number) => `${Math.round(v).toLocaleString('en-US')} m`
const KIND: Record<Activity['kind'], { label: string; tone: 'good' | 'info' | 'neutral' | 'warn' }> = {
  check: { label: 'Checked', tone: 'good' }, correction: { label: 'Review', tone: 'info' }, note: { label: 'Geology note', tone: 'warn' }, other: { label: 'Other', tone: 'neutral' },
}

export default function Geologist() {
  const { id } = useParams<{ id: string }>()
  const { state } = useCosting()
  const [period, setPeriod] = useState<Period>('30')
  const [kind, setKind] = useState<'all' | Activity['kind']>('all')
  const team = useTeam(period)
  const s = team.list.find(x => x.user.id === id)
  const user = state.users.find(u => u.id === id && u.role === 'geologist')

  if (!user) return <Page><Card><Empty>No geologist login with this id. <Link href="/admin/geology/geologists" style={{ color: T.orange }}>Back to the geologists</Link></Empty></Card></Page>
  if (!team.ready || !s) return <Page><Card><Empty>Loading the core record…</Empty></Card></Page>

  const ranked = team.list.filter(x => x.ranked).length
  const shown = s.activity.filter(a => kind === 'all' || a.kind === kind)
  const part = (label: string, v: number, max: number, color: string, note: string) => (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.text }}><span>{label}</span><span style={{ fontFamily: mono }}>{Math.round(v)} / {max}</span></div>
      <Meter value={v} max={max} color={color} />
      <div style={{ fontSize: 12, color: T.faint }}>{note}</div>
    </div>
  )

  return (
    <Page>
      <PageHead question={s.name}
        tone={s.ranked ? (s.rank === 1 ? 'good' : 'neutral') : 'info'}
        answer={<>{user.employer ?? 'Geologist'} · {(user.projects ?? []).join(', ') || 'no project yet'}. {s.ranked ? <>Ranked <b>{s.rank} of {ranked}</b> with a score of <b>{s.score}</b> ({PERIOD_LABEL[period].toLowerCase()}).</> : <>Signed off {m(s.metres)}: under {MIN_METRES} m, so not ranked yet.</>}</>}
        right={<><Seg<Period> value={period} onChange={setPeriod} options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: 'all', label: 'All time' }]} /><Btn href="/admin/geology/geologists">All geologists</Btn></>} />

      <Grid>
        <Tile label="Score" value={s.ranked ? s.score : '–'} note={s.ranked ? `Rank ${s.rank} of ${ranked}` : 'Too little to rank'} />
        <Tile label="Core signed off" value={m(s.metres)} note={`${s.trays} trays on ${s.holes.length} holes`} />
        <Tile label="Photo to check" value={fmtHours(s.turnaround)} note="Average for their trays" tone={s.turnaround != null && s.turnaround > 48 ? 'warn' : 'good'} />
        <Tile label="Unsure breaks reviewed" value={s.unsure ? `${Math.round(s.care)}%` : '–'} note={`${s.reviewed} of ${s.unsure} · ${s.notes} geology notes`} />
        <Tile label="Waiting on their projects" value={s.backlog} note="Trays not checked yet" tone={s.backlog ? 'warn' : 'good'} />
      </Grid>

      <Split left={2} right={1}>
        <Card title="Core signed off by week" subtitle="Metres of core checked, week by week.">
          {s.weekly.length === 0 ? <Empty>No trays checked in this period.</Empty> : (
            <div style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.weekly} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={dshort} minTickGap={16} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={v => `${v} m`} />
                  <Tooltip content={<Tip unit=" m" names={{ metres: 'Signed off' }} />} cursor={{ fill: 'rgba(var(--x-ov),0.04)' }} labelFormatter={l => `Week of ${dshort(String(l))}`} />
                  <Bar dataKey="metres" fill={colourOf(state.users, s.user.id)} radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="How the score is made" subtitle="Each part against the best in the team, same period.">
          <div style={{ display: 'grid', gap: 14 }}>
            <ScoreBar s={s} />
            {part('Output', s.parts.output, 40, 'var(--x-orange)', `${m(s.metres)} signed off`)}
            {part('Speed', s.parts.speed, 30, 'var(--x-blue)', `${fmtHours(s.turnaround)} from photo to check`)}
            {part('Care', s.parts.care, 30, 'var(--x-teal)', `${Math.round(s.care)}% of unsure breaks reviewed, ${s.notes} notes`)}
          </div>
        </Card>
      </Split>

      <Card title="Their work" subtitle={`Every check and correction ${s.name} made, newest first. ${PERIOD_LABEL[period]}.`} pad={false}
        right={<Seg<'all' | Activity['kind']> value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'check', label: 'Checks' }, { value: 'correction', label: 'Reviews' }, { value: 'note', label: 'Notes' }]} />}>
        {shown.length === 0 ? <Empty>Nothing of this kind in the period.</Empty> : (
          <Table>
            <thead><tr><th style={th}>When</th><th style={th}>What</th><th style={th}>Hole</th><th style={th}>Tray</th><th style={th} /></tr></thead>
            <tbody>
              {shown.slice(0, 80).map((a, i) => (
                <tr key={`${a.at}-${i}`} className="xpl-row" style={{ borderBottom: rowLine }}>
                  <td style={{ ...td, fontFamily: mono, fontSize: 12.5 }}>{when(a.at)}</td>
                  <td style={{ ...td, whiteSpace: 'normal', color: T.text }}><Status tone={KIND[a.kind].tone}>{KIND[a.kind].label}</Status> <span style={{ marginLeft: 6 }}>{a.what}</span></td>
                  <td style={tdStrong}>{a.hole ?? '—'}</td>
                  <td style={{ ...td, fontFamily: mono, fontSize: 12.5 }}>{a.tray ? a.tray.replace(`${a.hole}-`, '') : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{a.tray && <Link href={`/admin/geology/trays/${a.tray}`} style={{ color: T.orange, fontWeight: 600, textDecoration: 'none' }}>See the tray →</Link>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {shown.length > 80 && <div style={{ padding: '10px 18px', fontSize: 12.5, color: T.faint, borderTop: rowLine }}>Showing the newest 80 of {shown.length}.</div>}
      </Card>
    </Page>
  )
}
