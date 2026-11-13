'use client'

import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { ShiftLog } from '../../lib/costing-store'
import type { CoreTray } from '../../lib/core/model'
import type { IntervalResult } from '../../lib/core/geotech'
import { holeLogs } from '../../lib/core/drill-link'
import { Card, Legend, Tip, Empty, T, axisTick, gridStroke } from './kit'

/* ==========================================================================
 * GEOLOGY TODAY — the two charts under the key numbers
 *
 * 1. Drilled, photographed and checked: running metres by day. The gap between
 *    drilled and checked is the core still waiting in the shed.
 * 2. Rock quality by hole: metres in each RQD class, with core recovery.
 *
 * Every colour is named in the legend and every value shows in the tooltip,
 * so nothing is read from colour alone.
 * ========================================================================== */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dshort = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`
const r1 = (v: number) => Math.round(v * 10) / 10

export interface ChartHole {
  hole: string
  trays: CoreTray[]
  rows: IntervalResult[]
  recovery: number
}

/* ── 1. drilled vs photographed vs checked ──────────────────────────────── */

export function LoggingPace({ holes, logs, checked }: {
  holes: ChartHole[]
  logs: ShiftLog[]
  checked: Record<string, { by: string; at: string }>
}) {
  const data = useMemo(() => {
    const add = (m: Map<string, number>, d: string | undefined, v: number) => { if (d && v > 0) m.set(d, (m.get(d) ?? 0) + v) }
    const drilled = new Map<string, number>(), photo = new Map<string, number>(), done = new Map<string, number>()
    holes.forEach(h => {
      holeLogs(logs, h.hole).forEach(l => add(drilled, l.date, l.metresDrilled))
      h.trays.forEach(t => {
        const m = Math.max(0, t.usedTo - t.from)
        add(photo, t.takenAt?.slice(0, 10), m)
        add(done, checked[t.id]?.at.slice(0, 10), m)
      })
    })
    const seen: Record<string, true> = {}
    ;[drilled, photo, done].forEach(m => m.forEach((_, d) => { seen[d] = true }))
    const days = Object.keys(seen).sort()
    let a = 0, b = 0, c = 0
    return days.map(d => {
      a += drilled.get(d) ?? 0; b += photo.get(d) ?? 0; c += done.get(d) ?? 0
      return { day: dshort(d), drilled: Math.round(a), photographed: Math.round(b), checked: Math.round(c) }
    })
  }, [holes, logs, checked])

  const last = data[data.length - 1]
  const waiting = last ? Math.max(0, last.drilled - last.checked) : 0

  return (
    <Card title="Drilled, photographed and checked"
      subtitle={last ? `Running metres by day. ${waiting.toLocaleString('en-US')} m drilled are not yet checked by a geologist: that gap is the core waiting in the shed.` : 'Running metres by day.'}>
      {data.length < 2 ? <Empty>Not enough days yet to draw the pace.</Empty> : (
        <div style={{ display: 'grid', gap: 10 }}>
          <Legend items={[
            { color: T.plan, label: 'Drilled (shift logs)', line: true },
            { color: T.orange, label: 'Photographed by XPLORIX Core', line: true },
            { color: T.green, label: 'Checked by the geologist', line: true },
          ]} />
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={v => `${Number(v).toLocaleString('en-US')}`} />
                <Tooltip content={<Tip unit=" m" names={{ drilled: 'Drilled', photographed: 'Photographed', checked: 'Checked' }} />} />
                <Line type="monotone" dataKey="drilled" stroke={T.plan} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="photographed" stroke={T.orange} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="checked" stroke={T.green} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ── 2. rock quality by hole ────────────────────────────────────────────── */

const CLASSES = [
  { key: 'excellent', label: 'Excellent (RQD 90+)', min: 90, color: 'var(--x-green-d)' },
  { key: 'good', label: 'Good (75–90)', min: 75, color: 'var(--x-green-b)' },
  { key: 'fair', label: 'Fair (50–75)', min: 50, color: 'var(--x-amber)' },
  { key: 'poor', label: 'Poor (25–50)', min: 25, color: 'var(--x-red)' },
  { key: 'vpoor', label: 'Very poor (under 25)', min: -1, color: 'color-mix(in srgb, var(--x-red) 55%, #000)' },
] as const

export function RockQuality({ holes }: { holes: ChartHole[] }) {
  const data = useMemo(() => holes.map(h => {
    const row: Record<string, number | string> = { hole: h.hole, recovery: r1(h.recovery) }
    CLASSES.forEach(c => { row[c.key] = 0 })
    h.rows.forEach(r => {
      const c = CLASSES.find(x => r.rqd >= x.min)!
      row[c.key] = (row[c.key] as number) + r.length
    })
    CLASSES.forEach(c => { row[c.key] = r1(row[c.key] as number) })
    return row
  }), [holes])

  const names: Record<string, string> = Object.fromEntries(CLASSES.map(c => [c.key, c.label]))
  names.recovery = 'Core recovery'

  return (
    <Card title="Rock quality by hole" subtitle="Metres of core in each RQD class, from the tray photos. The line is core recovery on the right-hand scale.">
      {data.length === 0 ? <Empty>No holes photographed yet.</Empty> : (
        <div style={{ display: 'grid', gap: 10 }}>
          <Legend items={[...CLASSES.map(c => ({ color: c.color, label: c.label })), { color: T.text, label: 'Core recovery, %', line: true }]} />
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="hole" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
                <YAxis yAxisId="m" tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={v => `${v} m`} />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={v => `${v}%`} />
                <Tooltip content={<Tip names={names} />} cursor={{ fill: 'rgba(var(--x-ov),0.04)' }} />
                {CLASSES.map((c, i) => (
                  <Bar key={c.key} yAxisId="m" dataKey={c.key} stackId="q" fill={c.color} isAnimationActive={false}
                    radius={i === CLASSES.length - 1 ? [3, 3, 0, 0] : undefined} maxBarSize={44} />
                ))}
                <Line yAxisId="pct" type="monotone" dataKey="recovery" stroke={T.text} strokeWidth={2} dot={{ r: 3, fill: T.text }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  )
}
