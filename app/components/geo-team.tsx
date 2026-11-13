'use client'

import Link from 'next/link'
import { useTeam, fmtHours, type GeologistStats } from '../../lib/core/team'
import { Card, Empty, T, mono, rowLine } from './kit'

/* A geologist's score out of 100, split into its three parts, each in its own
 * colour and named in the label, so it reads without the colours. */
export function ScoreBar({ s }: { s: GeologistStats }) {
  if (!s.ranked) return <span style={{ fontSize: 12.5, color: T.faint }}>Too little to rank</span>
  const seg = (v: number, c: string, label: string) => <span title={`${label}: ${Math.round(v)}`} style={{ width: `${v}%`, background: c }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 170 }}>
      <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 15, color: T.text, width: 28 }}>{s.score}</span>
      <div aria-label={`Score ${s.score}: output ${Math.round(s.parts.output)} of 40, speed ${Math.round(s.parts.speed)} of 30, care ${Math.round(s.parts.care)} of 30`}
        style={{ display: 'flex', flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(var(--x-ov),0.06)' }}>
        {seg(s.parts.output, 'var(--x-orange)', 'Output')}{seg(s.parts.speed, 'var(--x-blue)', 'Speed')}{seg(s.parts.care, 'var(--x-teal)', 'Care')}
      </div>
    </div>
  )
}


/* The management scorecard's view of the geologists: the top of the ranking,
 * and a way into the full team screen. */
export function GeologistsCard() {
  const team = useTeam('30')
  const ranked = team.list.filter(s => s.ranked)
  return (
    <Card title="Geologists" subtitle={`Last 30 days: ${Math.round(team.totalMetres).toLocaleString('en-US')} m of core signed off, ${fmtHours(team.turnaround)} from photo to check, ${team.waiting} trays waiting.`} pad={false}
      right={<Link href="/admin/geology/geologists" style={{ fontSize: 13, fontWeight: 600, color: T.orange, textDecoration: 'none' }}>The whole team →</Link>}>
      {!team.ready ? <Empty>Loading the core record…</Empty> : team.list.length === 0 ? <Empty>No geologist logins yet.</Empty> : team.list.slice(0, 4).map((s, i) => (
        <Link key={s.user.id} href={`/admin/geology/geologists/${s.user.id}`} className="xpl-row" style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(170px, 220px)', gap: 12, alignItems: 'center', padding: '10px 18px', borderTop: i ? rowLine : 'none', textDecoration: 'none' }}>
          <span style={{ fontFamily: mono, fontWeight: 700, color: T.faint }}>{s.rank ?? '–'}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: T.text }}>{s.name}</span>
            <span style={{ display: 'block', fontSize: 12, color: T.faint }}>{Math.round(s.metres)} m · {fmtHours(s.turnaround)} to check{ranked.length && s.rank === 1 ? ' · leads the team' : ''}</span>
          </span>
          <ScoreBar s={s} />
        </Link>
      ))}
    </Card>
  )
}
