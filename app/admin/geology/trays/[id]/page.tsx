'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCosting } from '../../../../../lib/costing-store'
import { useCore, useHole, overridesOf, holeOfTray, className, classLetter, editVeins } from '../../../../../lib/core/store'
import { flatten, intervals, totals, gapId, paleGap, gapDefault } from '../../../../../lib/core/geotech'
import { findVeins, VEIN_CLASSES } from '../../../../../lib/core/downhole'
import { colourName } from '../../../../../lib/core/engine'
import { rateOf } from '../../../../../lib/core/drill-link'
import { Page, PageHead, Card, Btn, Grid, Tile, Status, Empty, Note, Split, T, tint } from '../../../../components/kit'
import { TrayPhoto, CoreLegend, pct, dep, depthAtX, xAtDepth, Swatch, type Sel, DemoPhotos } from '../../../../components/core-ui'

/* TRAY CHECK — the geologist's main working screen.
 *
 * The photo with every break and gap the photo step found. Click one to say
 * what it really is; click "Add a break" and then the photo to add one it
 * missed. Every change is kept with who and when, and the numbers update. */

export default function TrayCheck() {
  const { id } = useParams<{ id: string }>()
  const trayId = decodeURIComponent(id)
  const hole = holeOfTray(trayId)
  const router = useRouter()
  const { state } = useCosting()
  const core = useCore()
  const { review } = core
  const h = useHole(hole)
  const [sel, setSel] = useState<Sel>(null)
  const [adding, setAdding] = useState<'natural' | 'handling' | null>(null)
  const [show, setShow] = useState({ rows: true, breaks: true, gaps: true, classes: true, veins: true })
  // opened from Rock classes with ?at=<depth>: that 5 cm slice is pointed out
  const [at, setAt] = useState<number | null>(null)
  const [veinAt, setVeinAt] = useState<number | null>(null)
  const [names, setNames] = useState<Record<number, string>>({})
  useEffect(() => { const v = new URLSearchParams(window.location.search).get('at'); setAt(v != null && v !== '' && !isNaN(+v) ? +v : null) }, [trayId])

  const i = h.trays.findIndex(t => t.id === trayId)
  const tray = i >= 0 ? h.trays[i] : undefined
  const prev = i > 0 ? h.trays[i - 1] : undefined
  const next = i >= 0 && i < h.trays.length - 1 ? h.trays[i + 1] : undefined
  const nextToCheck = h.trays.slice(i + 1).find(t => !review.checked[t.id]) ?? h.trays.find(t => !review.checked[t.id] && t.id !== trayId)

  // keyboard: N natural, H handling, X not a break, arrows move tray
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' && next) router.push(`/admin/geology/trays/${next.id}`)
      if (e.key === 'ArrowLeft' && prev) router.push(`/admin/geology/trays/${prev.id}`)
      if (e.key === 'Escape') { setSel(null); setAdding(null) }
      if (!tray || sel?.kind !== 'break') return
      const b = tray.breaks.find(x => x.id === sel.id)
      if (!b) return
      const k = e.key.toLowerCase()
      const v = k === 'n' ? 'natural' : k === 'h' ? 'handling' : k === 'x' ? 'none' : null
      if (v) core.setBreak(b.id, tray.id, v === b.kind ? null : v, `Break at ${b.at.toFixed(2)} m: ${v === 'none' ? 'not a break' : v}`)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [next, prev, router, sel, tray, core])

  const stats = useMemo(() => {
    if (!tray) return null
    const f = flatten([tray], overridesOf(review))
    const t = totals(intervals(f, Math.max(0.5, tray.usedTo - tray.from)))
    return { t, f }
  }, [tray, review])

  const shifts = useMemo(() => {
    if (!tray) return []
    return state.shiftLogs.filter(l => l.holeNumber === hole && l.meterEnd != null && l.meterStart != null && l.meterEnd > tray.from && l.meterStart < tray.usedTo)
      .sort((a, b) => (a.meterStart ?? 0) - (b.meterStart ?? 0))
  }, [state.shiftLogs, hole, tray])

  if (!h.data) return <Page><Card><Empty>Loading tray {trayId}…</Empty></Card></Page>
  if (!tray || !stats) return <Page><Card><Empty>No tray {trayId}. <Link href={`/admin/geology/holes/${hole}`}>Back to {hole}</Link></Empty></Card></Page>

  const checked = review.checked[tray.id]
  const unsure = tray.breaks.filter(b => b.confidence === 'low' && !review.breaks[b.id]).length
  const changes = review.changes.filter(c => c.tray === tray.id)

  // what is selected
  const b = sel?.kind === 'break' ? tray.breaks.find(x => x.id === sel.id) : undefined
  const g = sel?.kind === 'gap' ? tray.spans.find(s => s.kind !== 'core' && gapId(tray.id, s.row, s.x0) === sel.id) : undefined
  const a = sel?.kind === 'added' ? review.added.find(x => x.id === sel.id) : undefined
  const bv = b ? (review.breaks[b.id] ?? b.kind) : undefined
  const gDefault = g ? gapDefault(tray, g) : undefined
  const gv = g ? (review.gaps[gapId(tray.id, g.row, g.x0)] ?? gDefault) : undefined
  const paleToCheck = tray.spans.filter(s => paleGap(tray, s) && !review.gaps[gapId(tray.id, s.row, s.x0)]).length

  const add = (row: number, x: number) => {
    if (!adding) return
    const at = depthAtX(tray, row, x)
    if (at == null) return
    core.addBreak({ id: `${tray.id}-a${Date.now()}`, tray: tray.id, row, x: Math.round(x), at: +at.toFixed(3), alpha: 90, kind: adding })
    setAdding(null)
  }

  // the slice opened from Rock classes, its class now, and what the photo step said
  const bin = at != null ? tray.bins.find(x => Math.abs(x.from - at) < 1e-6) : undefined
  const origCls = bin ? h.data.trays.find(t => t.id === tray.id)?.bins.find(x => Math.abs(x.from - bin.from) < 1e-6)?.cls : undefined
  const movedTo = bin ? review.classMoves?.[`${tray.id}@${bin.from}`] : undefined
  const p0 = bin ? xAtDepth(tray, bin.from + 1e-6) : null, p1 = bin ? xAtDepth(tray, bin.to - 1e-6) : null
  const classes = core.index?.classes ?? []
  const hexOf = (id: number) => classes.find(c => c.id === id)?.hex ?? '#888'
  // rock classes and veins in this tray, read from the same photo
  const inTray = classes.map(c => ({ c, m: tray.bins.filter(x => x.cls === c.id).reduce((s, x) => s + (x.to - x.from) * x.core, 0) })).filter(x => x.m > 0.005).sort((p, q) => q.m - p.m)
  const rawVeins = h.data && h.flat ? findVeins({ data: h.data, rows: h.rows, flat: h.flat, trays: h.trays }).filter(v => v.tray === tray.id) : []
  const veins = editVeins(rawVeins, review)
  const veinEdit = (v: { from: number }) => review.veinEdits?.[`${tray.id}@${v.from}`]
  const veinHex = (cls: number) => VEIN_CLASSES[cls].hex === '#e8e4d8' ? '#C9B86A' : VEIN_CLASSES[cls].hex
  const selVein = veinAt != null ? rawVeins.find(v => v.from === veinAt) : undefined
  const veinMarks = veins.map(v => ({ from: v.from, to: v.to, hex: VEIN_CLASSES[v.cls].hex === '#e8e4d8' ? '#F5E9B8' : VEIN_CLASSES[v.cls].hex, letter: VEIN_CLASSES[v.cls].letter }))
  const v0 = selVein ? xAtDepth(tray, selVein.from + 1e-6) : null, v1 = selVein ? xAtDepth(tray, selVein.to - 1e-6) : null
  const mark = v0 && v1 && v0.row === v1.row ? { row: v0.row, x0: v0.x, x1: v1.x } : p0 && p1 && p0.row === p1.row ? { row: p0.row, x0: p0.x, x1: p1.x } : undefined

  const choice = (label: string, on: boolean, onClick: () => void, key?: string) => (
    <button onClick={onClick} style={{
      padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
      border: `1px solid ${on ? T.orange : T.border}`, background: on ? tint(T.orange, 14) : T.card, color: T.text,
      display: 'flex', justifyContent: 'space-between', gap: 10,
    }}>{label}{key && <span style={{ color: T.faint, fontWeight: 500, fontSize: 11.5 }}>{key}</span>}</button>
  )

  return (
    <Page>
      <div style={{ fontSize: 12.5, color: T.faint }}>
        <Link href="/admin/geology/review" style={{ color: T.faint, textDecoration: 'none' }}>Review trays</Link> / <Link href={`/admin/geology/holes/${hole}`} style={{ color: T.faint, textDecoration: 'none' }}>{hole}</Link> / Tray {tray.no}
      </div>
      <PageHead question={`${hole} tray ${tray.no}: ${dep(tray.from, tray.usedTo)}`}
        tone={checked ? 'good' : 'warn'}
        answer={checked
          ? <>Checked by {checked.by} on {checked.at.replace('T', ' ')}. Recovery {pct(stats.t.recovery)}, RQD {pct(stats.t.rqd)}.</>
          : <>Suggested by the photo step, not yet checked. {unsure ? <b>{unsure} {unsure === 1 ? 'break it is unsure of is' : 'breaks it is unsure of are'} marked with a dot.</b> : 'No unsure breaks.'}{paleToCheck ? <> <b>{paleToCheck} very pale {paleToCheck === 1 ? 'patch' : 'patches'}</b> in a dashed box: core or empty tray?</> : null} Click a line or a box to correct it.</>}
        right={<>
          <DemoPhotos />
          <Btn href={prev ? `/admin/geology/trays/${prev.id}` : undefined} disabled={!prev}>← Tray {prev?.no ?? ''}</Btn>
          <Btn href={next ? `/admin/geology/trays/${next.id}` : undefined} disabled={!next}>Tray {next?.no ?? ''} →</Btn>
        </>} />

      <Split left={2.2} right={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <Card title="Tray photo" subtitle={adding ? `Click on the core where the ${adding === 'natural' ? 'natural fracture' : 'handling break'} is. Esc to stop.` : 'Click a break or gap to correct it. Keys: N natural · H handling · X not a break · ← → trays.'}
            right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn size="sm" kind={adding === 'natural' ? 'primary' : 'ghost'} onClick={() => { setAdding(adding === 'natural' ? null : 'natural'); setSel(null) }}>+ Natural break</Btn>
              <Btn size="sm" kind={adding === 'handling' ? 'primary' : 'ghost'} onClick={() => { setAdding(adding === 'handling' ? null : 'handling'); setSel(null) }}>+ Handling break</Btn>
            </div>}>
            <TrayPhoto tray={tray} sel={sel} onSelect={setSel} onAdd={add} adding={!!adding} show={show} mark={mark} classHex={hexOf} veins={veinMarks} onPickBin={f => { setAt(f); setVeinAt(null) }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <CoreLegend />
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: T.muted }}>
                {(['rows', 'breaks', 'gaps', 'classes', 'veins'] as const).map(k => (
                  <label key={k} style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={show[k]} onChange={e => setShow({ ...show, [k]: e.target.checked })} />{k === 'rows' ? 'Row depths' : k === 'breaks' ? 'Breaks' : k === 'gaps' ? 'Gaps' : k === 'classes' ? 'Rock class' : 'Veins'}
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <Grid min={140}>
            <Tile label="Recovery" value={pct(stats.t.recovery)} tone={stats.t.recovery >= 95 ? 'good' : stats.t.recovery >= 85 ? 'warn' : 'bad'} />
            <Tile label="RQD" value={pct(stats.t.rqd)} tone={stats.t.rqd >= 75 ? 'good' : stats.t.rqd >= 50 ? 'warn' : 'bad'} />
            <Tile label="Natural breaks" value={stats.t.natural} note={`${stats.t.handling} in handling`} />
            <Tile label="Fractures /m" value={stats.t.ff.toFixed(1)} />
          </Grid>

          <Card title="Rock class and veins: check them here" subtitle="The strip under the core is the rock class of every 5 cm; boxes with a letter are veins. Fix anything that is wrong, then Mark checked finalises the whole tray.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* ROCK CLASSES: what each class is, name it, how much is in this tray */}
              <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.faint }}>Rock classes</div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>Groups of core that look alike in every hole. Name a class once and every log uses it. Wrong class on a slice? Click the strip under the core.</div>
                {classes.map(c => {
                  const m = inTray.find(x => x.c.id === c.id)?.m ?? 0
                  const draft = names[c.id]
                  return (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: m > 0 ? 'var(--x-raised)' : 'transparent', opacity: m > 0 ? 1 : 0.6 }}>
                      <Swatch hex={c.hex} size={14} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input aria-label={`Name for class ${classLetter(c.id)}`} value={draft ?? review.classNames[c.id] ?? ''} placeholder={`Class ${classLetter(c.id)}: type a name`}
                            onChange={e => setNames({ ...names, [c.id]: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter' && draft?.trim()) { core.nameClass(c.id, draft.trim()); setNames(n => { const x = { ...n }; delete x[c.id]; return x }) } }}
                            style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, padding: '4px 6px', borderRadius: 6, border: `1px solid ${draft != null ? T.orange : 'transparent'}`, background: 'transparent', color: T.text }} />
                          {draft != null && draft.trim() && draft.trim() !== review.classNames[c.id] && <Btn size="sm" kind="primary" onClick={() => { core.nameClass(c.id, draft.trim()); setNames(n => { const x = { ...n }; delete x[c.id]; return x }) }}>Save</Btn>}
                        </div>
                        <div style={{ fontSize: 11.5, color: T.faint, paddingLeft: 6 }}>{review.classNames[c.id] ? `Class ${classLetter(c.id)} · ` : ''}{colourName(c.L, c.a, c.b)} · veins {(c.vein * 100).toFixed(0)}% · rust {(c.ox * 100).toFixed(0)}%</div>
                      </div>
                      <span style={{ fontFamily: 'var(--x-mono, monospace)', fontSize: 12.5, color: m > 0 ? T.text : T.faint }}>{m > 0 ? `${m.toFixed(2)} m` : '—'}</span>
                    </div>
                  )
                })}
              </div>

              {/* VEINS: every vein in this tray, its class, change it or say it is not a vein */}
              <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.faint }}>Veins in this tray ({veins.length})</div>
                {rawVeins.length === 0 && <div style={{ fontSize: 13, color: T.muted }}>No veins seen in this tray.</div>}
                {rawVeins.map(v => {
                  const e = veinEdit(v), cls = e != null && e >= 0 ? e : v.cls, gone = e === -1, on = veinAt === v.from
                  return (
                    <div key={v.from} style={{ display: 'grid', gap: 6, padding: '8px 10px', borderRadius: 8, border: `1px solid ${on ? T.orange : 'var(--x-border)'}`, opacity: gone ? 0.6 : 1 }}>
                      <button onClick={() => { setVeinAt(on ? null : v.from); setAt(null) }} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                        <span style={{ width: 12, height: 12, border: `2px solid ${veinHex(cls)}`, borderRadius: 2, display: 'inline-block' }} />
                        <b style={{ fontFamily: 'var(--x-mono, monospace)' }}>{dep(v.from, v.to)}</b>
                        <span style={{ color: T.muted }}>{gone ? 'not a vein' : `${VEIN_CLASSES[cls].letter} · ${VEIN_CLASSES[cls].name}`}</span>
                        {e != null ? <span style={{ fontSize: 11, color: '#B7791F', fontWeight: 700 }}>changed</span> : v.confidence === 'low' ? <span style={{ fontSize: 11, color: T.amber, fontWeight: 700 }}>unsure</span> : null}
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.faint }}>{on ? 'shown on photo' : 'show'}</span>
                      </button>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {VEIN_CLASSES.map(vc => (
                          <button key={vc.id} title={vc.name} onClick={() => core.setVein(tray.id, v.from, vc.id === v.cls ? null : vc.id, `Vein at ${dep(v.from, v.to)}: Class ${vc.letter}`)}
                            style={{ minWidth: 34, minHeight: 30, borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, border: `1px solid ${!gone && cls === vc.id ? T.orange : 'var(--x-border3)'}`, background: !gone && cls === vc.id ? 'color-mix(in srgb, var(--x-orange) 14%, transparent)' : T.card, color: T.text }}>{vc.letter}</button>
                        ))}
                        <button onClick={() => core.setVein(tray.id, v.from, gone ? null : -1, `Vein at ${dep(v.from, v.to)}: ${gone ? 'a vein again' : 'not a vein'}`)}
                          style={{ minHeight: 30, padding: '0 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${gone ? T.orange : 'var(--x-border3)'}`, background: gone ? 'color-mix(in srgb, var(--x-orange) 14%, transparent)' : T.card, color: T.text }}>Not a vein</button>
                      </div>
                    </div>
                  )
                })}
                <details style={{ fontSize: 12.5, color: T.muted }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}>What the vein classes mean</summary>
                  <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                    {VEIN_CLASSES.map(vc => <div key={vc.id} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 8 }}><span style={{ width: 12, height: 12, marginTop: 3, border: `2px solid ${veinHex(vc.id)}`, borderRadius: 2 }} /><span><b style={{ color: T.text }}>{vc.letter} · {vc.name}.</b> {vc.description}</span></div>)}
                  </div>
                </details>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {bin && origCls != null && (
            <Card title={`Rock class at ${dep(bin.from, bin.to)}`} subtitle="The slice in the orange box on the photo.">
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <Swatch hex={hexOf(bin.cls)} size={16} /><b>{className(review, bin.cls)}</b>
                  {movedTo != null && <span style={{ fontSize: 12, color: T.muted }}>(photo step said {className(review, origCls)})</span>}
                </div>
                {movedTo != null ? (
                  <>
                    <Status tone="good">Moved by {review.reviewer} · every log and export uses it</Status>
                    <Btn size="sm" onClick={() => core.moveSlice(tray.id, bin.from, origCls, null)}>Undo: back to {className(review, origCls)}</Btn>
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: T.muted }}>Look at the slice. If it is in the wrong class, move it:</div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {classes.filter(c => c.id !== bin.cls).map(c => (
                    <Btn key={c.id} size="sm" onClick={() => core.moveSlice(tray.id, bin.from, bin.cls, c.id === origCls ? null : c.id)}>
                      <Swatch hex={c.hex} /> {className(review, c.id)}
                    </Btn>
                  ))}
                </div>
                <Link href="/admin/geology/classes" style={{ fontSize: 12.5, color: T.muted }}>← Back to Rock classes</Link>
              </div>
            </Card>
          )}
          <Card title={b ? `Break at ${b.at.toFixed(2)} m` : g ? `Gap ${dep(g.from, g.to)}` : a ? `Added break at ${a.at.toFixed(2)} m` : 'Nothing selected'}>
            {!sel && <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>Click a coloured line (a break) or a shaded box (a gap) on the photo.<br />Orange dots: breaks the photo step is unsure of. Yellow dots: changed by a geologist.</div>}
            {b && (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
                  Photo step said <b style={{ color: T.text }}>{b.kind === 'natural' ? 'natural fracture' : 'handling break'}</b> ({b.confidence} confidence). Angle to core axis {b.alpha}°, roughness (JRC proxy) {b.jrc}{b.stain ? `, iron staining ${Math.round(b.stain * 100)}%` : ''}.
                </div>
                {choice('Natural fracture', bv === 'natural', () => core.setBreak(b.id, tray.id, b.kind === 'natural' ? null : 'natural', `Break at ${b.at.toFixed(2)} m: natural`), 'N')}
                {choice('Broken in handling', bv === 'handling', () => core.setBreak(b.id, tray.id, b.kind === 'handling' ? null : 'handling', `Break at ${b.at.toFixed(2)} m: handling`), 'H')}
                {choice('Not a break', bv === 'none', () => core.setBreak(b.id, tray.id, 'none', `Break at ${b.at.toFixed(2)} m: not a break`), 'X')}
                {review.breaks[b.id] && <Btn size="sm" onClick={() => core.setBreak(b.id, tray.id, null, `Break at ${b.at.toFixed(2)} m: back to the photo step's call`)}>Undo my change</Btn>}
              </div>
            )}
            {g && (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>{paleGap(tray, g) && !review.gaps[gapId(tray.id, g.row, g.x0)]
                  ? <>{((g.to - g.from) * 100).toFixed(0)} cm that is <b style={{ color: T.text }}>very pale</b>: the photo step is not sure if it is core or empty tray. It is not counted as lost until you decide.</>
                  : <>{((g.to - g.from) * 100).toFixed(0)} cm of tray with no core seen.</>}</div>
                {(['lost', 'sampled', 'core'] as const).map(v => choice(
                  v === 'lost' ? 'Core lost in drilling' : v === 'sampled' ? 'Taken for samples' : 'There is core (photo misread)', gv === v,
                  () => core.setGap(gapId(tray.id, g.row, g.x0), tray.id, v, `Gap ${dep(g.from, g.to)}: ${v === 'lost' ? 'lost' : v === 'sampled' ? 'sampled' : 'core present'}`)))}
                <div style={{ fontSize: 11.5, color: T.faint }}>Sampled core counts as recovered and is left out of RQD.</div>
              </div>
            )}
            {a && (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12.5, color: T.muted }}>Added by the geologist as a {a.kind === 'natural' ? 'natural fracture' : 'handling break'}.</div>
                <Btn onClick={() => { core.removeAdded(a.id); setSel(null) }}>Remove this break</Btn>
              </div>
            )}
          </Card>

          <Card title="Sign off">
            {checked ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <Status tone="good">Checked · {checked.by}</Status>
                <Btn size="sm" onClick={() => core.uncheck(tray.id)}>Open it again</Btn>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <Btn kind="primary" onClick={() => { core.check(tray.id); if (nextToCheck) router.push(`/admin/geology/trays/${nextToCheck.id}`) }}>Mark checked{nextToCheck ? ', next tray' : ''}</Btn>
                <div style={{ fontSize: 11.5, color: T.faint }}>Finalises the whole tray: breaks, gaps, rock class and veins. A checked tray shows as CHECKED in the logs and exports; until then every number is shown as suggested.</div>
              </div>
            )}
          </Card>

          <Card title="From the drilling record" subtitle="Shift logs that drilled this tray's depths." pad={false}>
            {shifts.length === 0 && <Empty>No shift log covers these depths.</Empty>}
            {shifts.map((l, k) => (
              <div key={l.id} style={{ padding: '10px 18px', borderTop: k ? `1px solid ${T.line}` : undefined, fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>
                <div style={{ color: T.text, fontWeight: 600 }}>{l.meterStart}–{l.meterEnd} m · {l.date} {l.shift.toLowerCase()}</div>
                {l.driller} · {l.rig} · {rateOf(l).toFixed(2)} m/h · driller recovery {l.metresDrilled ? pct(Math.min(100, (l.coreRecovery / l.metresDrilled) * 100)) : '—'}
                {l.downtimeHours ? <> · <span style={{ color: T.amber }}>{l.downtimeHours} h stopped: {l.downtimeReason}</span></> : null}
                <div>{l.formationType}</div>
              </div>
            ))}
          </Card>

          <Card title="Changes to this tray" pad={false}>
            {changes.length === 0 && <Empty>No changes yet.</Empty>}
            {changes.slice(0, 12).map((c, k) => (
              <div key={k} style={{ padding: '8px 18px', borderTop: k ? `1px solid ${T.line}` : undefined, fontSize: 12, color: T.muted }}>
                <span style={{ color: T.text }}>{c.what}</span><br />{c.by} · {c.at.replace('T', ' ')}
              </div>
            ))}
          </Card>
        </div>
      </Split>

      <Note>Photo {tray.takenAt.replace('T', ' ')} by {tray.takenBy}{tray.source === 'upload' ? ' · added in the browser' : ''}. The photo step measures the photo; it does not see the rock. Thin cracks smaller than a pixel on the photo can be missed: add them here.</Note>
    </Page>
  )
}
