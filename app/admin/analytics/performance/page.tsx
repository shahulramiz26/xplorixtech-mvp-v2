'use client'

import { useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { holeShifts, type Insight } from '../../../../lib/analytics'
import { projectHoles } from '../../../../lib/projects'
import { useInventory } from '../../../../lib/inventory-store'
import { Page, PageHead, Card, Tile, Grid, Table, Empty, Status, Tip, inputStyle, axisTick, gridStroke, th, thR, td, tdR, tdStrong, rowLine, T } from '../../../components/kit'
import { useAnalytics, BoardTabs, FilterBar, InsightsCard, n1 } from '../shared'

/* HOLE BY HOLE — what happened in this hole, shift by shift?
 * Depth against plan, every shift's metres, stops and parts, read from the
 * drill logs of whichever rigs worked the hole. */

export default function HoleByHole() {
  const { state, f } = useAnalytics()
  const { state: inv } = useInventory()
  const projects = (state.projects ?? []).filter(p => f.project === 'all' || p.name === f.project)
  const holes = useMemo(() => projects.flatMap(p => projectHoles(state, p.name).filter(h => h.status !== 'planned').map(h => ({ ...h, project: p.name }))), [state, projects])
  const [pick, setPick] = useState('')
  const hole = holes.find(h => h.id === pick) ?? holes[0]
  const rows = useMemo(() => hole ? holeShifts(state, hole.id) : [], [state, hole])
  const partName = (id: string) => inv.catalogue.find(p => p.id === id)?.name ?? 'Part'

  const metres = rows.reduce((s, r) => s + r.l.metresDrilled, 0)
  const core = rows.reduce((s, r) => s + r.l.coreRecovery, 0)
  const hours = rows.filter(r => !r.l.segmentOf).reduce((s, r) => s + r.l.drillingHours, 0)
  const own = rows.reduce((s, r) => s + r.own, 0), client = rows.reduce((s, r) => s + r.client, 0)
  const days = new Set(rows.map(r => r.l.date)).size
  const switchAt = rows.find((r, i) => i > 0 && r.l.metresDrilled > 0 && r.l.holeSize !== rows[i - 1].l.holeSize)
  const chart = rows.filter(r => !r.l.segmentOf || r.l.metresDrilled > 0).map(r => ({ label: r.label, depth: r.to }))

  const insights: Insight[] = []
  if (rows.length) {
    const drilled = rows.filter(r => r.l.metresDrilled > 0)
    const best = [...drilled].sort((a, b) => b.l.metresDrilled - a.l.metresDrilled)[0]
    if (best) insights.push({ id: 'best', tone: 'good', title: `Best shift: ${n1(best.l.metresDrilled)} m on ${best.label}`, detail: `${best.l.driller ?? 'Driller not named'} on ${best.l.rig}, ${best.l.holeSize} in ${best.l.formationType.toLowerCase()}. The hole averaged ${n1(metres / Math.max(1, drilled.length))} m a drilling shift.` })
    const longest = [...rows].sort((a, b) => (b.own + b.client) - (a.own + a.client))[0]
    if (longest && longest.own + longest.client > 0) insights.push({ id: 'stop', tone: longest.own ? 'warn' : 'info', title: `Longest stop: ${n1(longest.own + longest.client)} h on ${longest.label}`, detail: `${longest.reasons.join(', ')}. ${n1(own)} h of the hole's stops were your own, ${n1(client)} h the client's.` })
    const bits = rows.flatMap(r => (r.l.partsUsed ?? []).filter(u => /bit/i.test(partName(u.itemId))))
    insights.push({ id: 'bits', tone: 'info', title: bits.length ? `${bits.length} bit ${bits.length === 1 ? 'change' : 'changes'} logged` : 'No bit change logged', detail: bits.length ? `${n1(metres / bits.length)} m a bit on this hole.` : 'If a bit was changed, the driller should add it under Accessories, so stock and bit life stay right.' })
    if (hole?.planned && metres < hole.planned && hole.status === 'drilling') insights.push({ id: 'left', tone: 'info', title: `${n1(hole.planned - metres)} m to planned depth`, detail: `At this hole's ${n1(metres / Math.max(1, days))} m a day, about ${Math.ceil((hole.planned - metres) / Math.max(0.1, metres / Math.max(1, days)))} more days.` })
  }

  return (
    <Page>
      <PageHead question="What happened in this hole, shift by shift?"
        answer={hole ? <>{hole.id}: {n1(metres)} m of {hole.planned ? `${hole.planned} m planned` : 'no planned depth'}, in {days} days on {Array.from(new Set(rows.map(r => r.l.rig))).join(' and ')}.</> : <>No hole has been drilled for these filters.</>}
        right={<FilterBar withPeriod={false} />} />
      <BoardTabs />
      {!hole ? <Card><Empty>No hole drilled yet for these filters.</Empty></Card> : <>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select aria-label="Hole" value={hole.id} onChange={e => setPick(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12.5, cursor: 'pointer' }}>
            {holes.map(h => <option key={h.id} value={h.id}>{h.id} · {h.project} · {h.status === 'drilling' ? 'drilling' : 'finished'}</option>)}
          </select>
          <Status tone={hole.status === 'drilling' ? 'info' : 'good'}>{hole.status === 'drilling' ? 'Drilling' : 'Finished'}</Status>
        </div>
        <InsightsCard insights={insights} />
        <Grid min={160}>
          <Tile label="Depth" value={`${n1(metres)} m`} note={hole.planned ? `of ${hole.planned} m planned` : 'No planned depth'} />
          <Tile label="Days on the hole" value={days} note={`${rows.filter(r => !r.l.segmentOf).length} shifts`} />
          <Tile label="Metres an hour" value={hours ? (metres / hours).toFixed(2) : '—'} note={`${n1(hours)} h on bottom`} />
          <Tile label="Core recovery" value={metres ? `${((core / metres) * 100).toFixed(1)}%` : '—'} />
          <Tile label="Stopped" value={`${n1(own + client)} h`} note={`${n1(own)} h yours · ${n1(client)} h client`} />
        </Grid>
        <Card title="Depth, shift by shift" subtitle={switchAt ? `The size changed to ${switchAt.l.holeSize} at ${n1(switchAt.from)} m, on ${switchAt.label}.` : 'Depth at the end of each shift.'}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chart} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: T.border }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v} m`} />
              <Tooltip content={<Tip unit=" m" names={{ depth: "Depth" }} />} />
              {hole.planned ? <ReferenceLine y={hole.planned} stroke={T.muted} strokeDasharray="4 3" label={{ value: `${hole.planned} m planned`, fill: T.faint, fontSize: 11, position: 'insideTopLeft' }} /> : null}
              {switchAt && <ReferenceLine y={switchAt.from} stroke={T.orangeD} strokeDasharray="2 3" label={{ value: `${switchAt.l.holeSize} from ${n1(switchAt.from)} m`, fill: T.orangeD, fontSize: 11, position: 'insideBottomRight' }} />}
              <Line dataKey="depth" stroke={T.bar} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Every shift" pad={false}>
          <Table>
            <thead><tr><th style={th}>Shift</th><th style={th}>Rig</th><th style={th}>Driller</th><th style={th}>Size</th><th style={th}>Ground</th><th style={thR}>From</th><th style={thR}>To</th><th style={thR}>Metres</th><th style={thR}>Core</th><th style={thR}>Drilling h</th><th style={th}>Stops</th><th style={th}>Parts used</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.l.id} style={{ borderBottom: rowLine }}>
                  <td style={tdStrong}>{r.label}</td><td style={td}>{r.l.rig}</td><td style={td}>{r.l.driller ?? '—'}</td><td style={td}>{r.l.holeSize}</td>
                  <td style={td}>{r.l.formationType.replace(' Formation', '')}</td><td style={tdR}>{r.from}</td><td style={tdR}>{r.to}</td>
                  <td style={{ ...tdR, color: T.text }}>{r.l.metresDrilled ? n1(r.l.metresDrilled) : '—'}</td>
                  <td style={tdR}>{r.l.metresDrilled ? `${Math.round((r.l.coreRecovery / r.l.metresDrilled) * 100)}%` : '—'}</td>
                  <td style={tdR}>{r.l.segmentOf ? '—' : r.l.drillingHours}</td>
                  <td style={{ ...td, whiteSpace: 'normal', minWidth: 140 }}>{r.own + r.client ? `${n1(r.own + r.client)} h · ${r.reasons.join(', ')}` : '—'}</td>
                  <td style={{ ...td, whiteSpace: 'normal', minWidth: 120 }}>{(r.l.partsUsed ?? []).map(u => `${u.qty} × ${partName(u.itemId)}`).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </>}
    </Page>
  )
}
