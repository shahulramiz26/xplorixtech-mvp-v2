'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCosting } from '../../../../lib/costing-store'
import { projectHoles } from '../../../../lib/projects'
import { holeSurvey } from '../../../../lib/survey'
import { stripDrill } from '../../../../lib/core/drill-link'
import { useAllHoles, useCore, className } from '../../../../lib/core/store'
import { WEATHERING, rqdClass } from '../../../../lib/core/geotech'
import type { CoreTray } from '../../../../lib/core/model'
import type { IntervalResult } from '../../../../lib/core/geotech'
import { Page, PageHead, Card, Seg, Btn, Empty, Status, T, tint, mono } from '../../../components/kit'
import { photoSrc, xAtDepth, pct, DemoPhotos, type StripDrill } from '../../../components/core-ui'
import type { Hole3D, Pick3D } from '../../../components/core-3d'

const Core3D = dynamic(() => import('../../../components/core-3d').then(m => m.Core3D), { ssr: false, loading: () => <Empty>Loading the 3D view…</Empty> })

/* 3D VIEW — every hole of a project in the ground, along its surveyed path.
 *
 * Colour each hole by the core (the tray photos laid down the hole, rock
 * class, RQD, recovery, fractures) or by the drilling (rate against normal,
 * driller). Move along a hole to read it at that depth; click to pin, and
 * the strip below shows the tray photo and the shift that drilled it. */

type Mode = 'photo' | 'class' | 'rqd' | 'rec' | 'ff' | 'rate' | 'driller'
const MODES: { value: Mode; label: string; group: 'core' | 'drill' }[] = [
  { value: 'photo', label: 'Core photos', group: 'core' }, { value: 'class', label: 'Rock class', group: 'core' },
  { value: 'rqd', label: 'RQD', group: 'core' }, { value: 'rec', label: 'Recovery', group: 'core' }, { value: 'ff', label: 'Fractures', group: 'core' },
  { value: 'rate', label: 'Drill rate', group: 'drill' }, { value: 'driller', label: 'Driller', group: 'drill' },
]
const NONE = '#cfd4da'
// rock classes need to tell apart at a glance in 3D: earthy but distinct
const CLASS_3D = ['#2B2420', '#7A4B2E', '#C0612A', '#5F7A55', '#B59A6E', '#E6DFD2']
const DRILLER_HEX = ['#3E7BFA', '#E46A9B', '#22A06B', '#E9A23B', '#8E4EC6', '#12A594']
// a ramp from poor (red) through fair (amber) to good (green)
function ramp(t: number) {
  const k = Math.max(0, Math.min(1, t))
  const stops = [[229, 72, 77], [233, 162, 59], [34, 160, 107]]
  const [a, b, u] = k < .5 ? [stops[0], stops[1], k / .5] : [stops[1], stops[2], (k - .5) / .5]
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`
}

const W = 4096, H = 48
function skinFor(mode: Mode, hole: { drilled: number; rows: IntervalResult[]; trays: CoreTray[]; drill: StripDrill[]; drillers: string[] }, imgs: Record<string, HTMLImageElement>) {
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const X = (d: number) => (d / hole.drilled) * W
  g.fillStyle = NONE; g.fillRect(0, 0, W, H)
  if (mode === 'photo') {
    if (hole.trays.length) { g.fillStyle = '#3a332e'; g.fillRect(0, 0, W, H) }
    hole.trays.forEach(t => {
      const im = imgs[photoSrc(t)]; if (!im?.complete || !im.naturalWidth) return
      const sx = im.naturalWidth / t.w
      t.spans.filter(s => s.kind === 'core').forEach(s => {
        const r = t.rows[s.row]
        g.drawImage(im, s.x0 * sx, r.band[0] * sx, (s.x1 - s.x0) * sx, (r.band[1] - r.band[0]) * sx, X(s.from), 0, Math.max(1, X(s.to) - X(s.from)), H)
      })
      t.spans.filter(s => s.kind === 'empty').forEach(s => { g.fillStyle = 'rgba(229,72,77,.85)'; g.fillRect(X(s.from), 0, Math.max(1, X(s.to) - X(s.from)), H) })
    })
  } else if (mode === 'rate' || mode === 'driller') {
    hole.drill.forEach(d => {
      g.fillStyle = mode === 'driller' ? DRILLER_HEX[hole.drillers.indexOf(d.driller) % DRILLER_HEX.length] : d.rate > d.normal * 1.15 ? '#F97316' : d.rate < d.normal * 0.85 ? '#3E7BFA' : '#9CA3AF'
      g.fillRect(X(d.from), 0, Math.max(1, X(d.to) - X(d.from)), H)
    })
  } else {
    hole.rows.forEach(r => {
      g.fillStyle = mode === 'class' ? (r.cls >= 0 ? CLASS_3D[r.cls % CLASS_3D.length] : NONE) : mode === 'rqd' ? ramp(r.rqd / 100) : mode === 'rec' ? ramp((r.recovery - 80) / 20) : ramp(1 - r.ff / 12)
      g.fillRect(X(r.from), 0, Math.max(1, X(r.to) - X(r.from)) + .5, H)
    })
  }
  return c
}

export default function Core3DPage() {
  const { state } = useCosting()
  const all = useAllHoles()
  const { index, review } = useCore()
  const projects = useMemo(() => Array.from(new Set((index?.holes ?? []).map(h => h.project))), [index])
  const [project, setProject] = useState<string>('')
  const proj = project || projects[0] || ''
  const [mode, setMode] = useState<Mode>('photo')
  const [plan, setPlan] = useState(true)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [focus, setFocus] = useState<string | null>(null)
  const [hover, setHover] = useState<Pick3D | null>(null)
  const [pinned, setPinned] = useState<Pick3D | null>(null)
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement>>({})

  // every drilled hole on the project, with its survey; core where it has photos
  const holes = useMemo(() => {
    if (!proj) return []
    const core = new Map(all.list.map(h => [h.data.hole, h]))
    const drilled = projectHoles(state, proj).filter(h => h.status !== 'planned')
    const surveys = drilled.map(h => ({ h, s: holeSurvey(state, h.id) })).filter(x => x.s.path.length > 1 && x.s.latLon)
    if (!surveys.length) return []
    const o = surveys[0].s.latLon!
    return surveys.map(({ h, s }) => {
      const c = core.get(h.id)
      const drill = stripDrill(state.shiftLogs, h.id)
      return {
        id: h.id, drilled: s.drilled, path: s.path, planned: s.planned, survey: s,
        x: (s.latLon!.lon - o.lon) * 111320 * Math.cos(o.lat * Math.PI / 180), z: (s.latLon!.lat - o.lat) * 111320, y: s.collar?.rl ?? 0,
        rows: c?.rows ?? [], trays: c?.trays ?? [], drill, drillers: Array.from(new Set(drill.map(d => d.driller))), hasCore: !!c,
      }
    })
  }, [proj, state, all.list])

  // load the tray photos once, for the photo skin
  useEffect(() => {
    if (mode !== 'photo') return
    const want = holes.flatMap(h => h.trays.map(t => photoSrc(t))).filter(u => !imgs[u])
    if (!want.length) return
    let live = true
    Promise.all(want.map(u => new Promise<[string, HTMLImageElement]>(ok => { const im = new Image(); im.onload = im.onerror = () => ok([u, im]); im.src = u })))
      .then(list => { if (live) setImgs(m => ({ ...m, ...Object.fromEntries(list) })) })
    return () => { live = false }
  }, [holes, mode, imgs])

  const drillers = useMemo(() => Array.from(new Set(holes.flatMap(h => h.drillers))), [holes])
  const shown: Hole3D[] = useMemo(() => holes.filter(h => !hidden[h.id]).map(h => ({
    id: h.id, x: h.x, y: h.y, z: h.z, path: h.path, planned: h.planned, drilled: h.drilled,
    skin: skinFor(mode, { ...h, drillers }, imgs),
  })), [holes, hidden, mode, imgs, drillers, index])

  const at = pinned ?? hover
  const info = useMemo(() => {
    if (!at) return null
    const h = holes.find(x => x.id === at.hole); if (!h) return null
    const r = h.rows.find(x => at.depth >= x.from && at.depth < x.to)
    const d = h.drill.find(x => at.depth >= x.from && at.depth < x.to)
    const t = h.trays.find(x => at.depth >= x.from && at.depth < x.usedTo)
    return { h, r, d, t, p: t ? xAtDepth(t, at.depth) : null }
  }, [at, holes])

  const legend = mode === 'photo' ? [['#8c7b68', 'Core, from the tray photos'], ['rgba(229,72,77,.85)', 'No core in the tray'], [NONE, 'No photos']]
    : mode === 'class' ? (index?.classes ?? []).map(c => [CLASS_3D[c.id % CLASS_3D.length], className(review, c.id)]).concat([[NONE, 'No photos']])
    : mode === 'rqd' ? [[ramp(1), 'RQD 100%'], [ramp(.6), '60%'], [ramp(.2), '20%'], [NONE, 'No photos']]
    : mode === 'rec' ? [[ramp(1), 'Recovery 100%'], [ramp(.5), '90%'], [ramp(0), '80% or less'], [NONE, 'No photos']]
    : mode === 'ff' ? [[ramp(1), 'Few fractures'], [ramp(.5), '6 /m'], [ramp(0), '12 /m or more'], [NONE, 'No photos']]
    : mode === 'rate' ? [['#F97316', 'Faster than normal'], ['#9CA3AF', 'Normal'], ['#3E7BFA', 'Slower than normal']]
    : drillers.map((d, i) => [DRILLER_HEX[i % DRILLER_HEX.length], d])

  return (
    <Page>
      <PageHead question="Where does the rock go, hole to hole?"
        answer={<>Every hole on {proj || 'the project'} in the ground, along its surveyed path. Colour them by the core or by the drilling; move along a hole to read it, click to pin.</>}
        right={<><DemoPhotos />
          <select aria-label="Project" value={proj} onChange={e => { setProject(e.target.value); setPinned(null); setHidden({}) }}
            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 }}>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select></>} />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.faint, letterSpacing: '.08em' }}>CORE</span>
        <Seg<Mode> value={MODES.some(m => m.group === 'core' && m.value === mode) ? mode : ('' as Mode)} onChange={setMode} options={MODES.filter(m => m.group === 'core')} />
        <span style={{ fontSize: 12, fontWeight: 700, color: T.faint, letterSpacing: '.08em', marginLeft: 6 }}>DRILLING</span>
        <Seg<Mode> value={MODES.some(m => m.group === 'drill' && m.value === mode) ? mode : ('' as Mode)} onChange={setMode} options={MODES.filter(m => m.group === 'drill')} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: T.muted, marginLeft: 'auto', cursor: 'pointer' }}>
          <input type="checkbox" checked={plan} onChange={e => setPlan(e.target.checked)} />Planned paths
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 14, alignItems: 'start' }} className="core3d-grid">
        <Card pad={false}>
          <div style={{ position: 'relative', background: `linear-gradient(180deg, ${tint(T.orange, 4)}, transparent)`, borderRadius: 10, overflow: 'hidden' }}>
            {!all.ready ? <Empty>Loading the core photos…</Empty> : holes.length === 0 ? <Empty>No surveyed holes on this project yet.</Empty> : (
              <Core3D holes={shown} showPlan={plan} focus={focus} pinned={at}
                onHover={setHover} onPick={p => setPinned(p)} />
            )}
            {hover && !pinned && (
              <div style={{ position: 'absolute', left: hover.sx + 14, top: hover.sy - 12, pointerEvents: 'none', background: 'rgba(255,255,255,.92)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '5px 9px', fontSize: 12, fontWeight: 600, color: T.text, fontFamily: mono }}>
                {hover.hole} · {hover.depth.toFixed(1)} m
              </div>
            )}
            <div style={{ position: 'absolute', left: 14, bottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: T.muted, background: 'rgba(255,255,255,.75)', padding: '6px 10px', borderRadius: 8 }}>
              {legend.map(([c, l]) => <span key={l} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: 3, background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />{l}</span>)}
            </div>
            <div style={{ position: 'absolute', right: 14, bottom: 12, fontSize: 11.5, color: T.faint }}>Drag to turn · scroll to zoom · right-drag to move</div>
          </div>
        </Card>
        <Card title="Holes" pad={false}>
          {holes.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: i ? `1px solid ${T.line}` : undefined, fontSize: 13 }}>
              <input type="checkbox" aria-label={`Show ${h.id}`} checked={!hidden[h.id]} onChange={e => setHidden(x => ({ ...x, [h.id]: !e.target.checked }))} />
              <button onClick={() => { setFocus(null); setTimeout(() => setFocus(h.id), 0) }} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.text, fontWeight: 600, fontFamily: 'inherit', fontSize: 13 }}>{h.id}</button>
              <span style={{ fontSize: 11.5, color: T.faint }}>{Math.round(h.drilled)} m</span>
              {h.hasCore ? <Status tone="good">Core</Status> : <span style={{ fontSize: 11, color: T.faint }}>drilling</span>}
            </div>
          ))}
        </Card>
      </div>

      <Card title={info ? `${info.h.id} at ${at!.depth.toFixed(2)} m` : 'Move along a hole'} subtitle={info ? (pinned ? 'Pinned. Click empty space to let go.' : 'Click to pin this depth.') : 'The tray photo and the shift that drilled it appear here.'}
        right={info ? <div style={{ display: 'flex', gap: 8 }}>
          {info.t && <Btn size="sm" href={`/admin/geology/trays/${info.t.id}`}>Open tray {info.t.no}</Btn>}
          {info.h.hasCore && <Btn size="sm" kind="primary" href={`/admin/geology/holes/${info.h.id}`}>Hole log</Btn>}
          <Btn size="sm" href={`/admin/analytics/performance?hole=${info.h.id}&view=survey`}>Survey</Btn>
        </div> : undefined}>
        {!info ? <Empty>Point at a hole in the 3D view.</Empty> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {info.t && info.p ? <RowStrip tray={info.t} row={info.p.row} x={info.p.x} /> : <div style={{ fontSize: 13, color: T.faint }}>No tray photo at this depth.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
              <div><div style={{ fontWeight: 700, color: T.orange, fontSize: 11.5, letterSpacing: '.08em' }}>CORE</div>
                {info.r ? <>
                  <div style={{ color: T.text, fontWeight: 600 }}>{className(review, info.r.cls)} · {WEATHERING[info.r.weathering]?.toLowerCase()}</div>
                  <div>Recovery {pct(info.r.recovery)} · RQD {pct(info.r.rqd)} ({rqdClass(info.r.rqd).toLowerCase()})</div>
                  <div>{info.r.ff.toFixed(1)} fractures /m · GSI {info.r.gsi}</div>
                </> : <div>No core photos for this depth.</div>}
              </div>
              <div><div style={{ fontWeight: 700, color: T.muted, fontSize: 11.5, letterSpacing: '.08em' }}>DRILLING</div>
                {info.d ? <>
                  <div style={{ color: T.text, fontWeight: 600 }}>{info.d.from}–{info.d.to} m · {info.d.date} {info.d.shift.toLowerCase()}</div>
                  <div>{info.d.driller} · {info.d.rate.toFixed(2)} m/h <span style={{ color: info.d.rate > info.d.normal * 1.15 ? T.orange : T.faint }}>(normal {info.d.normal.toFixed(2)})</span></div>
                  {info.d.downtime > 0 && <div style={{ color: T.amber }}>{info.d.downtime} h stopped: {info.d.reason}</div>}
                </> : <div>No shift log for this depth.</div>}
              </div>
            </div>
          </div>
        )}
      </Card>
      <style>{`@media (max-width: 900px) { .core3d-grid { grid-template-columns: 1fr !important } }`}</style>
    </Page>
  )
}

/* One row of the tray, full width, with a line at the depth. */
function RowStrip({ tray, row, x }: { tray: CoreTray; row: number; x: number }) {
  const r = tray.rows[row]
  const [w, setW] = useState(900)
  return (
    <div ref={el => { if (el && Math.abs(el.clientWidth - w) > 2) setW(el.clientWidth) }} style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 10, background: '#222' }}>
      {(() => {
        const k = w / (r.x1 - r.x0), h = (r.band[1] - r.band[0]) * k
        return (
          <div style={{ position: 'relative', height: Math.min(140, h) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc(tray, true)} alt={`Tray ${tray.no}, row ${row + 1}`} style={{ position: 'absolute', left: -r.x0 * k, top: -r.band[0] * k - Math.max(0, h - 140) / 2, width: tray.w * k, maxWidth: 'none' }} />
            <div style={{ position: 'absolute', left: (x - r.x0) * k - 1.5, top: 0, bottom: 0, width: 3, background: T.orange, boxShadow: '0 0 12px rgba(249,115,22,.9)' }} />
            <div style={{ position: 'absolute', left: 10, top: 8, fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}>{r.from.toFixed(2)} m</div>
            <div style={{ position: 'absolute', right: 10, top: 8, fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}>{r.to.toFixed(2)} m</div>
          </div>
        )
      })()}
    </div>
  )
}
