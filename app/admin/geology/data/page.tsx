'use client'

import { useRef, useState } from 'react'
import { useCore, className } from '../../../../lib/core/store'
import { useGeo } from '../../../../lib/core/geo-data'
import { DATASETS, hasData, MINERALS, MINERAL_HEX, type DatasetKey } from '../../../../lib/core/downhole'
import { download } from '../../../../lib/core/export'
import { Page, PageHead, Grid, Tile, Card, Btn, Table, Status, Empty, Note, th, thR, td, tdStrong, rowLine, T } from '../../../components/kit'
import { classHex, pct } from '../../../components/core-ui'
import { DepthTracks, HoleTabs, KeyRow, type Track } from '../../../components/geo-ui'

/* DOWNHOLE DATA — every dataset on every hole, on one depth scale.
 *
 * The tray photos beside assays, downhole geophysics, the core scanner
 * (XRF and hyperspectral), the televiewer and lab tests. What each hole
 * has, a log of all of it together, and an import for anything else
 * (HOLE_ID, FROM, TO and number columns). */

const KEYS = (Object.keys(DATASETS) as DatasetKey[]).filter(k => !k.startsWith('manual'))   // hand logs: the XPLORIX log replaces them
const EXTRA_HEX = ['#0E7490', '#A21CAF', '#B45309', '#15803D']

export default function DownholeData() {
  const { data, edits, importExtra, clearImport } = useGeo()
  const { review, index } = useCore()
  const [hole, setHole] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)

  if (!data.ready) return <Page><Card><Empty>Joining the datasets on depth…</Empty></Card></Page>
  const sel = hole || data.holes[0].data.hole
  const h = data.holes.find(x => x.data.hole === sel)!
  const ms = data.byHole[sel] ?? []
  const st = data.structures.filter(s => s.hole === sel)
  const ex = edits.extra[sel]
  const metresTotal = data.metres.length
  const coverage = KEYS.map(k => ({ k, holes: data.holes.filter(x => hasData(k, x.data.hole)).length }))

  const curve = (label: string, get: (m: typeof ms[number]) => number, max: number, color: string, opts: { min?: number; log?: boolean; w?: number } = {}): Track =>
    ({ kind: 'curve', label, w: opts.w ?? 74, max, min: opts.min, log: opts.log, color, items: ms.map(m => ({ from: m.from, to: m.to, v: get(m) })) })
  const tracks: Track[] = [
    { kind: 'band', label: 'Core colour', w: 34, items: h.rows.map(r => ({ from: r.from, to: r.to, hex: r.hex })) },
    { kind: 'band', label: 'Photo class', w: 34, items: h.rows.filter(r => r.cls >= 0).map(r => ({ from: r.from, to: r.to, hex: classHex(r.cls, index?.classes), title: className(review, r.cls) })) },
    { kind: 'curve', label: 'RQD %', w: 74, max: 100, color: '#1F9D6B', items: h.rows.map(r => ({ from: r.from, to: r.to, v: r.rqd })) },
    curve('Cu ppm (log)', m => m.assay.Cu, 5000, '#B4652E', { min: 5, log: true }),
    curve('SiO₂ %', m => m.assay.SiO2, 100, '#64748B'),
    curve('Fe₂O₃ %', m => m.assay.Fe2O3, 30, '#9A3412'),
    curve('CaO %', m => m.assay.CaO, 55, '#2563EB'),
    curve('Density g/cm³', m => m.geophys.density, 3.2, '#7C3AED', { min: 2 }),
    curve('Mag sus (log)', m => m.geophys.magsus, 100, '#DB2777', { min: 0.01, log: true }),
    curve('Gamma API', m => m.geophys.gamma, 160, '#0D9488'),
  ]
  if (hasData('scanner', sel)) tracks.push({ kind: 'stack', label: 'Hyperspectral minerals', w: 90, items: ms.filter(m => m.scanner).map(m => ({ from: m.from, to: m.to, parts: m.scanner!.mix.map((s, i) => ({ hex: MINERAL_HEX[i], share: s })) })) })
  if (st.length) tracks.push({ kind: 'ticks', label: 'Televiewer picks', w: 60, items: st.map(s => ({ at: s.at, hex: s.type === 'Vein' ? '#3E7BFA' : s.type === 'Shear' ? '#E5484D' : '#8E4EC6', len: s.dip / 90, title: `${s.at} m · ${s.type} ${s.dip}°/${s.dipDir}°` })) })
  if (hasData('lab', sel)) tracks.push({ kind: 'ticks', label: 'Lab UCS', w: 60, items: ms.filter(m => m.ucs != null).map(m => ({ at: (m.from + m.to) / 2, hex: T.orange, len: Math.min(1, m.ucs! / 250), title: `${m.from} m · UCS ${m.ucs} MPa` })) })
  ex?.cols.forEach((c, j) => {
    const vals = ex.rows.map(r => r.v[j]).filter((v): v is number => v != null)
    tracks.push({ kind: 'curve', label: `${c} (imported)`, w: 80, max: Math.max(...vals) * 1.05 || 1, min: Math.min(0, ...vals), color: EXTRA_HEX[j % EXTRA_HEX.length], items: ex.rows.filter(r => r.v[j] != null).map(r => ({ from: r.from, to: r.to, v: r.v[j]! })) })
  })

  const onFile = async (f: File) => setMsg(importExtra(await f.text(), f.name))

  return (
    <Page>
      <PageHead question="What do we know down each hole?"
        answer={<>{metresTotal.toLocaleString('en-US')} metres on {data.holes.length} holes, each tied to its tray photos: assays and geophysics on every hole, the core scanner on {coverage.find(c => c.k === 'scanner')!.holes}, the televiewer on {coverage.find(c => c.k === 'televiewer')!.holes}, lab strength tests on {coverage.find(c => c.k === 'lab')!.holes}.</>}
        />

      <Card title="Import your downhole data" subtitle="Any interval table: HOLE_ID, FROM, TO, then number columns (assays, geophysics, pXRF, density, point load…). Each column becomes a log on the depth scale below, beside the core photos. Until your files are in, the other logs show sample data.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={file} type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
          <Btn kind="primary" onClick={() => file.current?.click()}>Choose a file</Btn>
          <Btn onClick={() => download('xplorix_downhole_template.csv', 'HOLE_ID,FROM,TO,PXRF_ZN_PPM,POINT_LOAD_MPA\nDH-961,3,4,120,4.2\nDH-961,4,5,95,3.8\n')}>Download a template</Btn>
          {Object.keys(edits.extra).map(hl => <Btn key={hl} size="sm" onClick={() => clearImport('extra', hl)}>Remove import · {hl}</Btn>)}
        </div>
        {msg && <div style={{ marginTop: 12 }}><Note tone={msg.ok ? 'good' : 'bad'}>{msg.text}</Note></div>}
      </Card>

      <Grid min={160}>
        <Tile label="Tray photos" value={`${data.holes.length} holes`} note="Real NVCL photos" />
        {coverage.filter(c => !c.k.startsWith('manual')).map(c => <Tile key={c.k} label={DATASETS[c.k].short} value={`${c.holes} holes`} note={c.holes === data.holes.length ? 'Every hole' : `${data.holes.length - c.holes} without`} />)}
      </Grid>

      <Card title="What each hole has" subtitle="The datasets XPLORIX joins on depth. Imported files are added hole by hole." pad={false}>
        <Table>
          <thead><tr><th style={th}>Hole</th><th style={th}>Photos</th>{KEYS.map(k => <th key={k} style={th}>{DATASETS[k].short}</th>)}<th style={th}>Imported</th></tr></thead>
          <tbody>{data.holes.map(x => (
            <tr key={x.data.hole} style={{ borderBottom: rowLine, background: x.data.hole === sel ? 'rgba(var(--x-ov),0.04)' : undefined, cursor: 'pointer' }} onClick={() => setHole(x.data.hole)}>
              <td style={tdStrong}>{x.data.hole}</td>
              <td style={td}><Status tone="good">{x.trays.length} trays</Status></td>
              {KEYS.map(k => <td key={k} style={td}>{hasData(k, x.data.hole) ? <span style={{ color: T.green, fontWeight: 700 }}>✓</span> : <span style={{ color: T.faint }}>—</span>}</td>)}
              <td style={td}>{edits.extra[x.data.hole] ? <Status tone="info">{edits.extra[x.data.hole].cols.length} columns</Status> : <span style={{ color: T.faint }}>—</span>}</td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>

      <Card title={`${sel}: everything on one depth scale`} subtitle="The core from the photos on the left, then chemistry, geophysics, the scanner, the televiewer and lab tests. Hover to read a metre.">
        <div style={{ display: 'grid', gap: 12 }}>
          <HoleTabs holes={data.holes.map(x => x.data.hole)} value={sel} onChange={setHole} />
          {hasData('scanner', sel) && <KeyRow items={MINERALS.map((m, i) => ({ hex: MINERAL_HEX[i], label: m }))} />}
          <DepthTracks top={Math.floor(h.rows[0]?.from ?? 0)} bottom={Math.ceil(h.rows[h.rows.length - 1]?.to ?? 10)} pxPerM={3} tracks={tracks}
            read={d => {
              const m = ms.find(x => d >= x.from && d < x.to)
              if (!m) return null
              return <><b style={{ color: T.text }}>{sel} · {m.from}–{m.to} m</b><br />{className(review, m.cls)} · RQD {pct(m.photo.rqd)}<br />Cu {m.assay.Cu} ppm<br />SiO₂ {m.assay.SiO2}% · Fe₂O₃ {m.assay.Fe2O3}% · CaO {m.assay.CaO}%<br />{m.geophys.density} g/cm³ · mag {m.geophys.magsus} · γ {m.geophys.gamma}{m.scanner ? <><br />Mostly {MINERALS[m.scanner.dominant].toLowerCase()}</> : null}{m.ucs ? <><br />Lab UCS {m.ucs} MPa</> : null}</>
            }} />
        </div>
      </Card>


      <Note>Demo: the photos are real; assays, geophysics, scanner readings, televiewer picks and lab tests are sample data generated from what each photographed metre shows, so they line up with the core the way real data does. Import real files and they replace it.</Note>
    </Page>
  )
}
