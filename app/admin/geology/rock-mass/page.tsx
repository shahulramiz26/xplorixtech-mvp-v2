'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAllHoles } from '../../../../lib/core/store'
import { intervals, totals, rqdClass, gsiClass, jointSets, discing, WEATHERING, type IntervalResult } from '../../../../lib/core/geotech'
import { Page, PageHead, Card, Seg, Empty, Table, th, thR, td, tdR, tdStrong, rowLine, T } from '../../../components/kit'
import { rqdColour, pct, DemoPhotos } from '../../../components/core-ui'

/* ROCK MASS — the engineering read of every hole, side by side.
 *
 * A depth-by-hole grid coloured by the chosen measure, then ground domains:
 * runs of similar rock quality long enough to design for. */

type Measure = 'rqd' | 'ff' | 'gsi' | 'weathering'
const STEP = 5

const scaleOf: Record<Measure, { label: string; colour: (v: number) => string; fmt: (v: number) => string }> = {
  rqd: { label: 'RQD %', colour: rqdColour, fmt: v => pct(v) },
  ff: { label: 'Natural fractures per m', colour: v => v <= 3 ? T.green : v <= 8 ? T.amber : T.red, fmt: v => v.toFixed(1) },
  gsi: { label: 'GSI proxy', colour: v => v >= 55 ? T.green : v >= 35 ? T.amber : T.red, fmt: v => String(Math.round(v)) },
  weathering: { label: 'Weathering grade', colour: v => v < 2.5 ? T.green : v < 3.5 ? T.amber : T.red, fmt: v => v.toFixed(1) },
}

/* Domains: 5 m steps grouped by RQD class, then any run shorter than
 * 10 m joins the neighbour it is closest to in RQD. */
function domains(rows: IntervalResult[]) {
  type D = { from: number; to: number; rows: IntervalResult[] }
  let out: D[] = []
  rows.forEach(r => {
    const last = out[out.length - 1]
    if (last && rqdClass(totals(last.rows).rqd) === rqdClass(r.rqd) && r.from - last.to < 1) { last.to = r.to; last.rows.push(r) }
    else out.push({ from: r.from, to: r.to, rows: [r] })
  })
  for (let pass = 0; pass < 20; pass++) {
    const i = out.findIndex(d => d.to - d.from < 10)
    if (i < 0 || out.length < 2) break
    const d = out[i], q = totals(d.rows).rqd
    const prev = out[i - 1], next = out[i + 1]
    const into = !prev ? next : !next ? prev : Math.abs(totals(prev.rows).rqd - q) <= Math.abs(totals(next.rows).rqd - q) ? prev : next
    into.from = Math.min(into.from, d.from); into.to = Math.max(into.to, d.to); into.rows = [...into.rows, ...d.rows].sort((x, y) => x.from - y.from)
    out = out.filter(x => x !== d)
  }
  // neighbours that ended up in the same class become one domain
  const merged: D[] = []
  out.forEach(d => {
    const last = merged[merged.length - 1]
    if (last && rqdClass(totals(last.rows).rqd) === rqdClass(totals(d.rows).rqd) && d.from - last.to < 1) { last.to = d.to; last.rows = [...last.rows, ...d.rows] }
    else merged.push({ ...d })
  })
  return merged.map(d => { const t = totals(d.rows); return { ...d, cls: rqdClass(t.rqd), t } })
}

export default function RockMass() {
  const all = useAllHoles()
  const [m, setM] = useState<Measure>('rqd')

  const view = useMemo(() => {
    const per = all.list.map(h => {
      const coarse = intervals(h.flat, STEP)
      const nat = h.flat.breaks.filter(b => b.kind === 'natural').map(b => b.alpha)
      return { h, coarse, doms: domains(coarse), sets: jointSets(nat).sets, discs: discing(h.flat).length }
    })
    const deepest = Math.max(1, ...all.list.map(h => h.data.drilled))
    return { per, deepest }
  }, [all.list])

  if (!all.ready) return <Page><Card><Empty>Loading the core photos…</Empty></Card></Page>
  const sc = scaleOf[m]
  const val = (r: IntervalResult) => m === 'rqd' ? r.rqd : m === 'ff' ? r.ff : m === 'gsi' ? r.gsi : r.weathering
  const bands = Math.ceil(view.deepest / STEP)

  return (
    <Page>
      <PageHead question="What is the rock mass like, hole by hole?"
        answer="Every hole on one depth scale, in 5 m steps, coloured by the measure you pick. Below, each hole is split into ground domains: runs of similar rock quality."
        right={<DemoPhotos />} />

      <Card title="Down every hole" subtitle={`${sc.label}, ${STEP} m steps. Grey: no photo.`} right={
        <Seg<Measure> value={m} onChange={setM} options={[{ value: 'rqd', label: 'RQD' }, { value: 'ff', label: 'Fractures' }, { value: 'gsi', label: 'GSI' }, { value: 'weathering', label: 'Weathering' }]} />}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${view.per.length}, minmax(56px, 1fr))`, gap: 3, minWidth: 52 + view.per.length * 60 }}>
            <div />
            {view.per.map(p => <Link key={p.h.data.hole} href={`/admin/geology/holes/${p.h.data.hole}`} style={{ fontSize: 11.5, fontWeight: 700, color: T.text, textDecoration: 'none', textAlign: 'center' }}>{p.h.data.hole}</Link>)}
            {Array.from({ length: bands }, (_, b) => (
              <Row key={b} b={b} per={view.per} val={val} sc={sc} />
            ))}
          </div>
        </div>
      </Card>

      <Card title="Ground domains" subtitle="Runs of the same RQD class, at least 10 m long. A starting point for design sections; the geologist confirms the boundaries." pad={false}>
        <Table>
          <thead><tr><th style={th}>Hole</th><th style={th}>From–to</th><th style={th}>Rock quality</th><th style={thR}>RQD</th><th style={thR}>Fract. /m</th><th style={thR}>GSI</th><th style={th}>Weathering</th></tr></thead>
          <tbody>
            {view.per.flatMap(p => p.doms.map((d, i) => (
              <tr key={`${p.h.data.hole}-${i}`} style={{ borderBottom: rowLine }}>
                <td style={tdStrong}>{i === 0 ? p.h.data.hole : ''}</td>
                <td style={td}>{d.from.toFixed(0)}–{d.to.toFixed(0)} m</td>
                <td style={td}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: rqdColour(d.t.rqd), marginRight: 6 }} />{d.cls}</td>
                <td style={tdR}>{pct(d.t.rqd)}</td>
                <td style={tdR}>{d.t.ff.toFixed(1)}</td>
                <td style={tdR}>{Math.round(d.t.gsi)} · {gsiClass(d.t.gsi)}</td>
                <td style={td}>{WEATHERING[Math.round(d.t.weathering)]}</td>
              </tr>
            )))}
          </tbody>
        </Table>
      </Card>

      <Card title="Structure by hole" pad={false}>
        <Table>
          <thead><tr><th style={th}>Hole</th><th style={th}>Joint sets (angle to core axis)</th><th style={thR}>Discing zones</th><th style={thR}>JRC proxy</th></tr></thead>
          <tbody>
            {view.per.map(p => (
              <tr key={p.h.data.hole} style={{ borderBottom: rowLine }}>
                <td style={tdStrong}>{p.h.data.hole}</td>
                <td style={td}>{p.sets.map(s => `${s.mean}° ± ${s.sd}° (${s.n})`).join(' · ') || '—'}</td>
                <td style={tdR}>{p.discs || '—'}</td>
                <td style={tdR}>{p.h.total!.jrc.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Page>
  )
}

function Row({ b, per, val, sc }: { b: number; per: { h: { data: { hole: string } }; coarse: IntervalResult[] }[]; val: (r: IntervalResult) => number; sc: { colour: (v: number) => string; fmt: (v: number) => string } }) {
  return (
    <>
      <div style={{ fontSize: 10.5, color: T.faint, textAlign: 'right', paddingRight: 4, lineHeight: '18px' }}>{b * STEP} m</div>
      {per.map(p => {
        const r = p.coarse.find(x => Math.abs(x.from - b * STEP) < 0.01)
        return (
          <div key={p.h.data.hole} title={r ? `${p.h.data.hole} ${r.from}–${r.to} m: ${sc.fmt(val(r))}` : 'No photo'}
            style={{ height: 18, borderRadius: 3, background: r ? sc.colour(val(r)) : T.line, opacity: r ? 0.35 + 0.65 * Math.min(1, r.length / STEP) : 1, fontSize: 10, color: '#fff', textAlign: 'center', lineHeight: '18px', overflow: 'hidden' }}>
            {r ? sc.fmt(val(r)) : ''}
          </div>
        )
      })}
    </>
  )
}
