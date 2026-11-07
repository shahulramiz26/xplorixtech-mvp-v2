'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../../../../lib/core/geo-data'
import { discing } from '../../../../lib/core/geotech'
import { hasData, holeOrient, mean } from '../../../../lib/core/downhole'
import { jointSets } from '../../../../lib/core/geotech'
import { download } from '../../../../lib/core/export'
import { Page, PageHead, Grid, Tile, Card, Btn, Seg, Table, Empty, Note, th, thR, td, tdR, tdStrong, rowLine, T } from '../../../components/kit'
import { AlphaChart, DemoPhotos } from '../../../components/core-ui'
import { DepthTracks, HoleTabs, KeyRow, Stereonet, SampleBadge, type Track } from '../../../components/geo-ui'

/* STRUCTURES — which way the fractures and veins dip.
 *
 * A photo gives alpha, the angle of a fracture to the core axis. A
 * televiewer run (acoustic or optical) also gives beta, which way round the
 * hole it faces. With the hole's direction from the survey, alpha and beta
 * become true dip and dip direction: what a pit wall or a stope is designed
 * from. Holes without a televiewer keep alpha from the photos. */

const SET_HEX = ['#3E7BFA', '#E46A9B', '#22A06B', '#E9A23B']
const TYPE_HEX = { Joint: '#8E4EC6', Vein: '#3E7BFA', Shear: '#E5484D' }
type By = 'set' | 'type'

export default function Structures() {
  const { data, edits, importTv, clearImport } = useGeo()
  const [hole, setHole] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const [by, setBy] = useState<By>('set')

  const view = useMemo(() => {
    if (!data.ready) return null
    const tvHoles = data.holes.filter(h => data.structures.some(s => s.hole === h.data.hole)).map(h => h.data.hole)
    const byHole = data.holes.map(h => { const nat = h.flat.breaks.filter(b => b.kind === 'natural'); return { hole: h.data.hole, sets: jointSets(nat.map(b => b.alpha)).sets, discs: discing(h.flat).length, jrc: h.rows.length ? h.rows.reduce((s, r) => s + r.jrc * r.length, 0) / Math.max(1e-9, h.rows.reduce((s, r) => s + r.length, 0)) : 0, tv: data.structures.filter(s => s.hole === h.data.hole).length } })
    const sets = tvHoles.map(hl => {
      const st = data.structures.filter(s => s.hole === hl)
      const ids = Array.from(new Set(st.map(s => s.set))).sort()
      return { hole: hl, n: st.length, sets: ids.map(k => { const xs = st.filter(s => s.set === k); return { k, n: xs.length, dip: Math.round(mean(xs.map(s => s.dip))), dipDir: Math.round(circ(xs.map(s => s.dipDir))), alpha: Math.round(mean(xs.map(s => s.alpha))) } }) }
    })
    return { tvHoles, sets, byHole }
  }, [data])

  if (!data.ready || !view) return <Page><Card><Empty>Reading the televiewer picks…</Empty></Card></Page>
  const sel = hole || view.tvHoles[0]
  const h = data.holes.find(x => x.data.hole === sel)!
  const st = data.structures.filter(s => s.hole === sel)
  const nat = h.flat.breaks.filter(b => b.kind === 'natural')
  const js = jointSets(nat.map(b => b.alpha))
  const sv = data.surveys[sel] ?? []
  const o = sv.length ? { az: Math.round(sv[0].azimuth), dip: Math.round(sv[0].dip) } : holeOrient(sel)
  const hex = (s: typeof st[number]) => by === 'set' ? SET_HEX[s.set % SET_HEX.length] : TYPE_HEX[s.type]
  const tracks: Track[] = [
    { kind: 'band', label: 'Core colour', w: 34, items: h.rows.map(r => ({ from: r.from, to: r.to, hex: r.hex })) },
    { kind: 'curve', label: 'Fractures /m (photo)', w: 90, max: 20, color: '#8E4EC6', items: h.rows.map(r => ({ from: r.from, to: r.to, v: r.ff })) },
    { kind: 'ticks', label: 'Dip (tick length)', w: 90, items: st.map(s => ({ at: s.at, hex: hex(s), len: s.dip / 90, title: `${s.at} m · ${s.type} · ${s.dip}° toward ${s.dipDir}°` })) },
  ]
  const all = data.structures
  const imported = edits.tv?.[sel]
  // photo and televiewer, set by set: a televiewer pick within 15 cm of a photo crack is the same crack
  const cmp = js.sets.map((ps, i) => {
    const mine = nat.filter(b => js.sets.reduce((bi, x, k) => Math.abs(x.mean - b.alpha) < Math.abs(js.sets[bi].mean - b.alpha) ? k : bi, 0) === i)
    // each photo crack once, with the televiewer pick nearest to it (within 15 cm)
    const hits = mine.map(b => st.reduce<typeof st[number] | null>((best, x) => Math.abs(x.at - b.at) <= 0.15 && (!best || Math.abs(x.at - b.at) < Math.abs(best.at - b.at)) ? x : best, null)).filter((x): x is typeof st[number] => !!x)
    return { i, ps, n: mine.length, hits: hits.length, alpha: hits.some(x => Number.isFinite(x.alpha)) ? Math.round(mean(hits.filter(x => Number.isFinite(x.alpha)).map(x => x.alpha))) : null, dip: hits.length ? Math.round(mean(hits.map(x => x.dip))) : null, dipDir: hits.length ? Math.round(circ(hits.map(x => x.dipDir))) : null }
  })
  const seenBoth = nat.filter(b => st.some(s => Math.abs(b.at - s.at) <= 0.15)).length
  const tvOnly = st.filter(s => !nat.some(b => Math.abs(b.at - s.at) <= 0.15)).length
  const onFile = async (f: File | undefined) => { if (!f) return; setMsg(importTv(await f.text(), f.name)); if (file.current) file.current.value = '' }

  return (
    <Page>
      <PageHead question="Which way do the fractures and veins dip?"
        answer={<>{all.length.toLocaleString('en-US')} structures picked on the televiewer in {view.tvHoles.length} holes, each with true dip and dip direction. The tray photos give the angle to the core (alpha) on all {data.holes.length} holes; the televiewer adds which way each plane faces.</>}
        right={<><DemoPhotos /><SampleBadge>Sample televiewer</SampleBadge><Btn onClick={() => download('xplorix_structures.csv', ['HOLE_ID,DEPTH,TYPE,ALPHA,BETA,DIP,DIP_DIRECTION,SET', ...all.map(s => [s.hole, s.at, s.type, s.alpha, s.beta, s.dip, s.dipDir, s.set + 1].join(','))].join('\n'))}>Download structures (CSV)</Btn></>} />

      <Grid min={170}>
        <Tile label="Holes with televiewer" value={`${view.tvHoles.length} of ${data.holes.length}`} note="True dip and dip direction" />
        <Tile label="Structures picked" value={all.length.toLocaleString('en-US')} note={`${all.filter(s => s.type === 'Vein').length} veins · ${all.filter(s => s.type === 'Shear').length} shears`} />
        <Tile label="Fractures on photos" value={data.holes.reduce((s, x) => s + x.flat.breaks.filter(b => b.kind === 'natural').length, 0).toLocaleString('en-US')} note="Alpha on every hole" />
      </Grid>

      <Card title="Joint sets by hole, from the core photos" subtitle="Cracks that repeat at the same angle form a joint set. These angles are to the core axis (alpha), measured on every hole's tray photos." pad={false}>
        <Table>
          <thead><tr><th style={th}>Hole</th><th style={th}>Joint sets (angle to core axis)</th><th style={thR}>Discing zones</th><th style={thR}>Roughness (JRC)</th><th style={th}>Televiewer</th></tr></thead>
          <tbody>
            {view.byHole.map(p => (
              <tr key={p.hole} style={{ borderBottom: rowLine }}>
                <td style={tdStrong}>{p.hole}</td>
                <td style={td}>{p.sets.length ? <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{p.sets.map((x, i) => <span key={i} style={{ fontFamily: 'var(--x-mono, monospace)', fontSize: 12, padding: '1px 7px', borderRadius: 5, border: `1px solid ${T.border}`, color: T.text }}>{x.mean}° ± {x.sd}° <span style={{ color: T.faint }}>n={x.n}</span></span>)}</span> : '—'}</td>
                <td style={tdR}>{p.discs || '—'}</td>
                <td style={tdR}>{p.jrc.toFixed(1)}</td>
                <td style={td}>{edits.tv?.[p.hole] ? <span style={{ color: T.green, fontWeight: 600 }}>✓ {edits.tv[p.hole].file}</span> : p.tv ? <span style={{ color: T.muted }}>Sample · {p.tv} planes</span> : <span style={{ color: T.faint }}>Not yet</span>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}`, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.55 }}><b>Add your televiewer CSV to see the true data and compare.</b> A photo gives each crack&apos;s angle to the core, not which way it faces in the ground. The televiewer file from your logging contractor gives true dip and dip direction; XPLORIX lines it up with the photo cracks by depth.</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={file} type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
            <Btn kind="primary" onClick={() => file.current?.click()}>Add televiewer CSV</Btn>
            <span style={{ fontSize: 12, color: T.faint }}>Columns: HOLE_ID, DEPTH, DIP, DIP_DIRECTION (ALPHA, BETA and TYPE if you have them)</span>
          </div>
          {msg && <div role="status" style={{ fontSize: 12.5, color: msg.ok ? T.green : T.red }}>{msg.text}</div>}
        </div>
      </Card>

      <Card title={`Compare on ${sel}: what the photo sees and what the televiewer adds`} subtitle={imported ? `Televiewer: ${imported.file}, imported ${imported.at.replace('T', ' ')}.` : 'Televiewer in the demo is sample data, made from the photo angles; add a real file to compare for real.'}
        right={imported ? <Btn size="sm" onClick={() => clearImport('tv', sel)}>Remove the file</Btn> : <SampleBadge>Sample televiewer</SampleBadge>}>
        <div style={{ display: 'grid', gap: 16 }}>
          <HoleTabs holes={view.tvHoles} value={sel} onChange={setHole} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {[
              ['1 · Core photo', 'Each natural crack and its angle to the core (alpha). Every hole has this.'],
              ['2 · Televiewer', 'The same cracks on the hole wall, with which way round the hole they face (beta) and a compass.'],
              ['3 · Hole survey', sv.length
                ? `From the XPLORIX drilling record: ${sv.length} approved survey readings on ${sel}, ${Math.round(sv[0].azimuth)}° at ${Math.abs(Math.round(sv[0].dip))}° (${sv[0].depth} m) to ${Math.round(sv[sv.length - 1].azimuth)}° at ${Math.abs(Math.round(sv[sv.length - 1].dip))}° (${sv[sv.length - 1].depth} m). Each crack uses the direction at its own depth.`
                : `No approved survey on the drilling record for ${sel} yet, so the planned direction (${o.az}° at ${Math.abs(o.dip)}°) is used. Add readings in Hole survey.`],
            ].map(([t, d]) => <div key={t} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'var(--x-raised)' }}><div style={{ fontWeight: 700, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12.5, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>{d}</div></div>)}
          </div>
          <Table>
            <thead><tr><th style={th}>Joint set</th><th style={th}>Photo (angle to core)</th><th style={thR}>Cracks on photo</th><th style={thR}>Same crack on televiewer</th><th style={thR}>Televiewer angle to core</th><th style={th}>True orientation (televiewer)</th></tr></thead>
            <tbody>
              {cmp.map(c => (
                <tr key={c.i} style={{ borderBottom: rowLine }}>
                  <td style={tdStrong}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: SET_HEX[c.i % SET_HEX.length], marginRight: 6 }} />Set {c.i + 1}</td>
                  <td style={td}>{c.ps.mean}° ± {c.ps.sd}°</td>
                  <td style={tdR}>{c.n}</td>
                  <td style={tdR}>{c.hits} ({c.n ? Math.round((c.hits / c.n) * 100) : 0}%)</td>
                  <td style={tdR}>{c.alpha != null ? `${c.alpha}°` : '—'}</td>
                  <td style={td}>{c.dip != null ? <b>dips {c.dip}° toward {String(c.dipDir).padStart(3, '0')}°</b> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>Seen by both: <b style={{ color: T.text }}>{seenBoth} of {nat.length}</b> photo cracks have a televiewer pick within 15 cm. Televiewer only: <b style={{ color: T.text }}>{tvOnly}</b> planes (thin cracks a photo can miss, or cracks closed in the core). The angle to the core should agree between the two; the true orientation is what only the televiewer can give.</div>
        </div>
      </Card>

      <Card title={`${sel}: poles to planes`} subtitle={`Lower hemisphere, equal area. Hole drilled toward ${o.az}° at ${Math.abs(o.dip)}°. Each dot is the pole of one plane; clusters are joint sets.`}
        right={<Seg<By> value={by} onChange={setBy} options={[{ value: 'set', label: 'By set' }, { value: 'type', label: 'By type' }]} />}>
        <div style={{ display: 'grid', gap: 12 }}>
          <HoleTabs holes={view.tvHoles} value={sel} onChange={setHole} />
          <KeyRow items={by === 'set' ? (view.sets.find(x => x.hole === sel)?.sets ?? []).map(s => ({ hex: SET_HEX[s.k % SET_HEX.length], label: `Set ${s.k + 1}` })) : Object.entries(TYPE_HEX).map(([k, v]) => ({ hex: v, label: k }))} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20, alignItems: 'start' }}>
            <Stereonet points={st.map(s => ({ dip: s.dip, dipDir: s.dipDir, hex: hex(s), title: `${s.at} m · ${s.dip}°/${s.dipDir}°` }))} />
            <DepthTracks top={Math.floor(h.rows[0]?.from ?? 0)} bottom={Math.ceil(h.rows[h.rows.length - 1]?.to ?? 10)} pxPerM={1.6} tracks={tracks}
              read={d => { const xs = st.filter(s => Math.abs(s.at - d) < 1); return <><b style={{ color: T.text }}>{sel} · {d.toFixed(1)} m</b><br />{xs.length ? xs.slice(0, 4).map(s => <span key={s.id}>{s.type} {s.dip}° → {s.dipDir}°<br /></span>) : 'No pick within 1 m'}</> }} />
          </div>
        </div>
      </Card>

      <Grid min={360}>
        <Card title="Joint sets, true orientation" pad={false}>
          <Table>
            <thead><tr><th style={th}>Hole</th><th style={th}>Set</th><th style={thR}>Planes</th><th style={thR}>Dip</th><th style={thR}>Dip direction</th><th style={thR}>Alpha</th></tr></thead>
            <tbody>{view.sets.flatMap(x => x.sets.map(s => (
              <tr key={`${x.hole}${s.k}`} style={{ borderBottom: rowLine }}>
                <td style={tdStrong}>{x.hole}</td><td style={td}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: SET_HEX[s.k % SET_HEX.length], marginRight: 6 }} />Set {s.k + 1}</td>
                <td style={tdR}>{s.n}</td><td style={tdR}>{s.dip}°</td><td style={tdR}>{String(s.dipDir).padStart(3, '0')}°</td><td style={tdR}>{s.alpha}°</td>
              </tr>
            )))}</tbody>
          </Table>
        </Card>
        <Card title={`${sel}: alpha from the photos`} subtitle="What every hole has without a televiewer: the angle to the core axis.">
          <AlphaChart alphas={nat.map(b => b.alpha)} sets={js.sets} />
        </Card>
      </Grid>
      <Note>Alpha comes from the real tray photos. In the demo, beta (which way round the hole each plane faces) is sample televiewer data; true dip and dip direction are worked out from alpha, beta and the hole&apos;s direction with the standard core-orientation formula, the same as with a real ATV or OTV run.</Note>
    </Page>
  )
}

/* Mean of directions in degrees. */
function circ(xs: number[]) {
  const s = mean(xs.map(x => Math.sin(x * Math.PI / 180))), c = mean(xs.map(x => Math.cos(x * Math.PI / 180)))
  const a = Math.atan2(s, c) * 180 / Math.PI
  return a < 0 ? a + 360 : a
}
