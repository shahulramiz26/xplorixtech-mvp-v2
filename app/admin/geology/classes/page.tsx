'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAllHoles, useCore, className, classLetter, moveKey } from '../../../../lib/core/store'
import { colourName } from '../../../../lib/core/engine'
import { Page, PageHead, Card, Btn, Empty, Note, inputStyle, T } from '../../../components/kit'
import { photoSrc, xAtDepth, pct, DemoPhotos, Swatch } from '../../../components/core-ui'
import type { CoreTray } from '../../../../lib/core/model'

/* ROCK CLASSES — groups of core that look alike (colour, grain, veins,
 * staining), found across every hole. The photo step does not know the rock
 * names; the geologist looks at the samples and names each class once. */

const K = 3   // display scale for the crops

/* The photo is fetched only when the crop scrolls into view: a class card shows
 * eight crops from eight different trays, and the whole page would otherwise
 * fetch 48 full tray photos before anything below the first card is seen. */
function useSeen<E extends Element>() {
  const ref = useRef<E | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen] as const
}

function Crop({ tray, at, from, checked, moved }: { tray: CoreTray; at: number; from: number; checked?: boolean; moved?: boolean }) {
  const [ref, seen] = useSeen<HTMLAnchorElement>()
  const p = xAtDepth(tray, at)
  if (!p) return null
  const r = tray.rows[p.row]
  const win = 46, hgt = (r.band[1] - r.band[0]) * K
  return (
    <Link ref={ref} href={`/admin/geology/trays/${tray.id}?at=${from}`} title={`${tray.hole} ${at.toFixed(2)} m`}
      style={{ position: 'relative', display: 'block', width: win * 2, height: hgt, borderRadius: 6, border: `1px solid ${checked ? 'var(--x-green)' : T.border}`, flex: '0 0 auto',
        backgroundColor: 'var(--x-raised)', backgroundImage: seen ? `url(${photoSrc(tray, true)})` : 'none', backgroundSize: `${tray.w * K}px ${tray.h * K}px`,
        backgroundPosition: `${-(p.x * K - win)}px ${-(r.band[0] * K)}px`, backgroundRepeat: 'no-repeat' }}>
      {moved && <span title="Moved into this class by a geologist" style={{ position: 'absolute', top: 3, left: 3, fontSize: 10.5, fontWeight: 700, lineHeight: 1, padding: '3px 5px', borderRadius: 4, background: 'var(--x-amber)', color: '#1a1206' }}>Moved</span>}
      {checked && <span title="A geologist checked this tray" style={{ position: 'absolute', top: 3, right: 3, fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '3px 5px', borderRadius: 4, background: 'var(--x-green)', color: '#fff' }}>✓</span>}
    </Link>
  )
}

export default function RockClasses() {
  const all = useAllHoles()
  const { index, review, nameClass, moveSlice } = useCore()
  const [draft, setDraft] = useState<Record<number, string>>({})
  const moves = review.classMoves ?? {}

  const view = useMemo(() => {
    if (!index) return []
    return index.classes.map(c => {
      const bins = all.list.flatMap(h => h.trays.flatMap(t => t.bins.filter(b => b.cls === c.id && b.core > 0.9).map(b => ({ t, b, hole: h.data.hole }))))
      const metres = bins.reduce((s, x) => s + (x.b.to - x.b.from) * x.b.core, 0)
      const holes = Array.from(new Set(bins.map(x => x.hole)))
      // samples spread across holes and depths
      const step = Math.max(1, Math.floor(bins.length / 8))
      const movedIn = bins.filter(x => (review.classMoves ?? {})[moveKey(x.t.id, x.b.from)] === c.id)
      const samples = [...movedIn, ...bins.filter((x, i) => i % step === Math.floor(step / 2) && !movedIn.includes(x))].slice(0, 8)
      return { c, metres, holes, samples }
    })
  }, [index, all.list, review.classMoves])

  if (!all.ready || !index) return <Page><Card><Empty>Loading the core photos…</Empty></Card></Page>
  const named = index.classes.filter(c => review.classNames[c.id]).length

  return (
    <Page>
      <PageHead question="Which rock is which?"
        answer={<>The photos split the core into {index.classes.length} classes that look alike, darkest first. {named < index.classes.length ? `Name the ${index.classes.length - named} unnamed classes once; every log and export uses your names.` : 'All classes are named.'}</>}
        right={<DemoPhotos />} />
      <Note>Classes come from what a photo shows: colour, grain, veins and staining. Two rocks that look the same will share a class, and one rock can split across two. The name is the geologist&apos;s call; in the demo the names come from the sample hand logs and can be changed here. The pictures are examples of each class: a green ✓ means a geologist has checked that tray. Click a picture to open its tray: the slice is marked on the photo, and if it is in the wrong class you can move it there. Moved slices show first in their new class, marked Moved; every move is saved with your name and, in the full build, teaches the model.</Note>

      {view.map(({ c, metres, holes, samples }) => {
        const movedIn = Object.values(moves).filter(v => v === c.id).length
        return (
        <Card key={c.id} title={`${className(review, c.id)}`} subtitle={`${review.classNames[c.id] ? `Class ${classLetter(c.id)} · ` : ''}${colourName(c.L, c.a, c.b)} · ${pct(c.share * 100)} of the core · ${Math.round(metres)} m in ${holes.length} holes${movedIn ? ` · ${movedIn} slice${movedIn === 1 ? '' : 's'} moved here by a geologist` : ''}`}
          right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.muted }}>Colour on logs <Swatch hex={c.hex} size={18} /></span>}>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
            {samples.map(s => {
              const label = `${s.hole} ${((s.b.from + s.b.to) / 2).toFixed(2)} m`
              return (
                <div key={`${s.t.id}-${s.b.from}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 auto', width: 92 }}>
                  <Crop tray={s.t} at={(s.b.from + s.b.to) / 2} from={s.b.from} checked={!!review.checked[s.t.id]} moved={moves[moveKey(s.t.id, s.b.from)] === c.id} />
                  <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}>{label}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: T.muted }}>
            <span>Brightness {Math.round(c.L)}</span><span>Grain {c.tex.toFixed(1)}</span><span>Veins {(c.vein * 100).toFixed(1)}%</span><span>Iron staining {(c.ox * 100).toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <input aria-label={`Name for class ${classLetter(c.id)}`} placeholder="e.g. Dolerite, Black shale, Quartz-veined sandstone"
              value={draft[c.id] ?? review.classNames[c.id] ?? ''} onChange={e => setDraft({ ...draft, [c.id]: e.target.value })}
              style={{ ...inputStyle, flex: '1 1 240px' }} />
            <Btn kind="primary" disabled={!(draft[c.id] ?? '').trim() || draft[c.id]?.trim() === review.classNames[c.id]}
              onClick={() => { nameClass(c.id, draft[c.id].trim()); setDraft(d => { const n = { ...d }; delete n[c.id]; return n }) }}>Save name</Btn>
          </div>
        </Card>
        )
      })}
    </Page>
  )
}
