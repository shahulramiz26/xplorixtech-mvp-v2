'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AddedBreak, BreakVerdict, Change, CoreHole, CoreIndex, CoreTray, GapVerdict } from './model'
import { flatten, intervals, totals, type Overrides } from './geotech'
import { IS_DEMO } from '../company'

/* ==========================================================================
 * XPLORIX CORE — the store
 *
 * The photo step's results come as one file per hole (public/core/*.json),
 * loaded the first time a screen needs that hole. What the geologist decides
 * (a break's kind, a gap's kind, breaks added, trays checked, names for the
 * rock classes) and photos added in the browser are kept here, with who and
 * when. In the demo it lives in the browser; with a database it is a table.
 * ========================================================================== */

/* What only the geologist's eye can add to a stretch of core: alteration,
 * minerals and sulphides, what fills the cracks, and a note. */
export interface GeoNote {
  id: string; tray: string; from: number; to: number
  alteration?: string; intensity?: 'Weak' | 'Moderate' | 'Strong'
  minerals: { name: string; pct: number }[]
  infill?: string; note?: string
  by: string; at: string
}
export const ALTERATIONS = ['None', 'Chlorite', 'Silica', 'Sericite', 'Clay (argillic)', 'Carbonate', 'Potassic', 'Epidote', 'Iron oxide']
export const SULPHIDES = ['Pyrite', 'Chalcopyrite', 'Arsenopyrite', 'Pyrrhotite', 'Galena', 'Sphalerite', 'Magnetite', 'Visible gold']
export const INFILLS = ['None (clean)', 'Clay', 'Calcite', 'Quartz', 'Chlorite', 'Iron oxide', 'Gouge']

export interface CoreReview {
  breaks: Record<string, BreakVerdict>
  gaps: Record<string, GapVerdict>
  added: AddedBreak[]
  checked: Record<string, { by: string; at: string }>
  classNames: Record<number, string>
  classMoves: Record<string, number>
  veinEdits: Record<string, number>
  rockMass: Record<string, { weathering?: number; gsi?: number }>
  geoNotes: GeoNote[]   // per tray: the geologist's weathering grade (1–5) and GSI              // a vein the geologist corrected: `${tray}@${from}` → vein class, or -1 for not a vein             // a 5 cm slice the geologist moved to another rock class: `${tray}@${from}` → class
  changes: (Change & { tray?: string })[]
  uploads: (CoreTray & { photo: string })[]      // photos added in the browser, with the photo as a data URL
  reviewer: string      // who is signed in and doing the work: every check and correction carries this name
  teamSeed?: number     // the demo's geologists' work has been laid in (lib: public/core/demo-team.json)
}

/* Names for the six demo rock classes, the same ones the demo's sample hand
 * logs use, so every screen reads the same. A geologist can rename any of them. */
export const DEMO_CLASS_NAMES: Record<number, string> = { 0: 'Basalt', 1: 'Siltstone', 2: 'Oxidised zone', 3: 'Quartz-veined sediment', 4: 'Sandstone', 5: 'Limestone' }

const EMPTY: CoreReview = { breaks: {}, gaps: {}, added: [], checked: {}, classNames: { ...DEMO_CLASS_NAMES }, classMoves: {}, veinEdits: {}, rockMass: {}, geoNotes: [], changes: [], uploads: [], reviewer: 'Priya Nair (geologist)' }
const KEY = 'xplorix_core_v2_oct'
const LOG_CAP = 3000

/* The demo's geologists at work: laid into a demo browser once, without
 * undoing anything a person did there. */
type TeamSeed = Pick<CoreReview, 'checked' | 'breaks' | 'geoNotes' | 'changes'>
function withTeam(r: CoreReview, t: TeamSeed): CoreReview {
  if (r.teamSeed) return r
  const notes = r.geoNotes ?? []
  return {
    ...r, teamSeed: 1,
    checked: { ...t.checked, ...r.checked },
    breaks: { ...t.breaks, ...r.breaks },
    geoNotes: [...notes, ...t.geoNotes.filter(n => !notes.some(x => x.id === n.id))],
    changes: [...r.changes, ...t.changes].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, LOG_CAP),
  }
}


export function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

interface Ctx {
  index: CoreIndex | null
  review: CoreReview
  holes: Record<string, CoreHole>
  load: (hole: string) => Promise<CoreHole | null>
  setBreak: (id: string, tray: string, v: BreakVerdict | null, label: string) => void
  setGap: (id: string, tray: string, v: GapVerdict | null, label: string) => void
  addBreak: (b: AddedBreak) => void
  removeAdded: (id: string) => void
  check: (tray: string) => void
  uncheck: (tray: string) => void
  nameClass: (id: number, name: string) => void
  moveSlice: (tray: string, from: number, fromCls: number, toCls: number | null) => void
  setVein: (tray: string, from: number, cls: number | null, label: string) => void
  saveGeoNote: (n: Omit<GeoNote, 'by' | 'at'>) => void
  removeGeoNote: (id: string) => void
  setRockMass: (tray: string, patch: { weathering?: number | null; gsi?: number | null }, label: string) => void
  /* Who is signed in: their name goes on every check and correction from now on. */
  setActor: (name: string) => void
  /* The projects the signed-in login may see (a geologist's), or null for all. */
  scope: string[] | null
  setScope: (projects: string[] | null) => void
  /* Every hole, whatever the scope: for the Company Admin's team screens. */
  fullIndex: CoreIndex | null
  addUpload: (t: CoreTray & { photo: string }) => boolean
  removeUpload: (id: string) => void
  reset: () => void
}

const C = createContext<Ctx | null>(null)
const cache: Record<string, Promise<CoreHole | null>> = {}

export function CoreProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<CoreIndex | null>(null)
  const [review, setReview] = useState<CoreReview>(EMPTY)
  const [holes, setHoles] = useState<Record<string, CoreHole>>({})
  const [scope, setScopeState] = useState<string[] | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    let start: CoreReview = EMPTY
    try { const raw = localStorage.getItem(KEY); if (raw) { const r = JSON.parse(raw); start = { ...EMPTY, ...r, classNames: { ...DEMO_CLASS_NAMES, ...(r.classNames ?? {}) } }; setReview(start) } } catch { /* private window */ }
    loaded.current = true
    if (IS_DEMO && !start.teamSeed) {
      fetch('/core/demo-team.json').then(r => r.ok ? r.json() as Promise<TeamSeed> : null).then(t => {
        if (!t) return
        setReview(s => { const n = withTeam(s, t); try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* kept for this visit */ } return n })
      }).catch(() => { /* the demo works without it */ })
    }
    fetch('/core/index.json').then(r => r.ok ? r.json() : null).then(setIndex).catch(() => setIndex(null))
  }, [])

  const save = useCallback((fn: (s: CoreReview) => CoreReview) => {
    setReview(s => {
      const n = fn(s)
      try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* full or private: kept for this visit */ }
      return n
    })
  }, [])

  const load = useCallback((hole: string) => {
    if (!cache[hole]) {
      cache[hole] = fetch(`/core/${hole}.json`).then(r => r.ok ? r.json() as Promise<CoreHole> : null).catch(() => null)
      cache[hole].then(h => { if (h) setHoles(s => ({ ...s, [hole]: h })) })
    }
    return cache[hole]
  }, [])

  const log = (s: CoreReview, what: string, tray?: string) => [{ at: stamp(), by: s.reviewer, what, tray }, ...s.changes].slice(0, LOG_CAP)

  const shown = useMemo(() => !index || !scope ? index : { ...index, holes: index.holes.filter(h => scope.includes(h.project)) }, [index, scope])

  const ctx: Ctx = {
    index: shown, fullIndex: index, review, holes, load, scope,
    setScope: p => setScopeState(cur => JSON.stringify(cur) === JSON.stringify(p) ? cur : p),
    setActor: name => { if (name && name !== review.reviewer) save(s => ({ ...s, reviewer: name })) },
    setBreak: (id, tray, v, label) => save(s => {
      const breaks = { ...s.breaks }
      if (v) breaks[id] = v; else delete breaks[id]
      return { ...s, breaks, changes: log(s, label, tray) }
    }),
    setGap: (id, tray, v, label) => save(s => {
      const gaps = { ...s.gaps }
      if (v) gaps[id] = v; else delete gaps[id]
      return { ...s, gaps, changes: log(s, label, tray) }
    }),
    addBreak: b => save(s => ({ ...s, added: [...s.added, b], changes: log(s, `Added a ${b.kind} break at ${b.at.toFixed(2)} m`, b.tray) })),
    removeAdded: id => save(s => {
      const b = s.added.find(x => x.id === id)
      return { ...s, added: s.added.filter(x => x.id !== id), changes: log(s, `Removed the break added at ${b?.at.toFixed(2)} m`, b?.tray) }
    }),
    check: tray => save(s => ({ ...s, checked: { ...s.checked, [tray]: { by: s.reviewer, at: stamp() } }, changes: log(s, 'Marked the tray checked', tray) })),
    uncheck: tray => save(s => { const checked = { ...s.checked }; delete checked[tray]; return { ...s, checked, changes: log(s, 'Opened the tray again', tray) } }),
    nameClass: (id, name) => save(s => ({ ...s, classNames: { ...s.classNames, [id]: name }, changes: log(s, `Named rock class ${classLetter(id)} "${name}"`) })),
    moveSlice: (tray, from, fromCls, toCls) => save(s => {
      const classMoves = { ...s.classMoves }
      const key = `${tray}@${from}`
      if (toCls == null) delete classMoves[key]; else classMoves[key] = toCls
      const what = toCls == null ? `Undid the class move at ${from.toFixed(2)} m` : `Moved the slice at ${from.toFixed(2)} m from ${className(s, fromCls)} to ${className(s, toCls)}`
      return { ...s, classMoves, changes: log(s, what, tray) }
    }),
    setVein: (tray, from, cls, label) => save(s => {
      const veinEdits = { ...(s.veinEdits ?? {}) }
      const key = `${tray}@${from}`
      if (cls == null) delete veinEdits[key]; else veinEdits[key] = cls
      return { ...s, veinEdits, changes: log(s, label, tray) }
    }),
    saveGeoNote: n => save(s => {
      const list = s.geoNotes ?? []
      const had = list.some(x => x.id === n.id)
      const full: GeoNote = { ...n, by: s.reviewer, at: stamp() }
      const what = [n.alteration && n.alteration !== 'None' ? `${n.alteration}${n.intensity ? ` (${n.intensity.toLowerCase()})` : ''}` : '', n.minerals.map(m => `${m.name} ${m.pct}%`).join(', '), n.infill ? `infill ${n.infill.toLowerCase()}` : ''].filter(Boolean).join(' · ')
      return { ...s, geoNotes: had ? list.map(x => x.id === n.id ? full : x) : [...list, full], changes: log(s, `${had ? 'Changed' : 'Added'} geology ${n.from.toFixed(2)}–${n.to.toFixed(2)} m${what ? `: ${what}` : ''}`, n.tray) }
    }),
    removeGeoNote: id => save(s => {
      const n = (s.geoNotes ?? []).find(x => x.id === id)
      return { ...s, geoNotes: (s.geoNotes ?? []).filter(x => x.id !== id), changes: log(s, `Removed geology ${n?.from.toFixed(2)}–${n?.to.toFixed(2)} m`, n?.tray) }
    }),
    setRockMass: (tray, patch, label) => save(s => {
      const cur = { ...((s.rockMass ?? {})[tray] ?? {}) } as { weathering?: number; gsi?: number }
      if ('weathering' in patch) { if (patch.weathering == null) delete cur.weathering; else cur.weathering = patch.weathering }
      if ('gsi' in patch) { if (patch.gsi == null) delete cur.gsi; else cur.gsi = patch.gsi }
      const rockMass = { ...(s.rockMass ?? {}) }
      if (cur.weathering == null && cur.gsi == null) delete rockMass[tray]; else rockMass[tray] = cur
      return { ...s, rockMass, changes: log(s, label, tray) }
    }),
    addUpload: t => {
      // Photos are kept in the browser in the demo, which holds only a few MB:
      // say so when it is full instead of losing the photo quietly.
      const n = { ...review, uploads: [...review.uploads.filter(u => u.id !== t.id), t], changes: log(review, `Added tray photo ${t.from.toFixed(1)}–${t.to.toFixed(1)} m`, t.id) }
      try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { return false }
      setReview(n)
      return true
    },
    removeUpload: id => save(s => ({ ...s, uploads: s.uploads.filter(u => u.id !== id), changes: log(s, 'Removed an added tray photo', id) })),
    reset: () => save(() => EMPTY),
  }
  return <C.Provider value={ctx}>{children}</C.Provider>
}

export function useCore() {
  const c = useContext(C)
  if (!c) throw new Error('useCore outside CoreProvider')
  return c
}

export const holeOfTray = (id: string) => id.replace(/-(T|U)[^-]+$/, '')
export const classLetter = (id: number) => String.fromCharCode(65 + id)
export function className(review: CoreReview, id: number) {
  if (id < 0) return '—'
  return review.classNames[id] ? review.classNames[id] : `Class ${classLetter(id)}`
}

/* The geologist's class moves, applied to the slices before anything is worked
 * out, so every log, export and 3D view uses the corrected class. */
export const moveKey = (tray: string, from: number) => `${tray}@${from}`
function withMoves(trays: CoreTray[], r: CoreReview): CoreTray[] {
  const moves = r.classMoves ?? {}
  if (!Object.keys(moves).length) return trays
  return trays.map(t => t.bins.some(b => moves[moveKey(t.id, b.from)] != null)
    ? { ...t, bins: t.bins.map(b => { const m = moves[moveKey(t.id, b.from)]; return m != null ? { ...b, cls: m } : b }) }
    : t)
}

export function overridesOf(r: CoreReview): Overrides {
  return { breaks: r.breaks, gaps: r.gaps, added: r.added }
}

/* The geologist's weathering grade and GSI for a tray replace the photo's on
 * every metre of that tray, so the logs, Rock mass and exports use them. */
function withRockMass<R extends { from: number; to: number; weathering: number; gsi: number }>(rows: R[], trays: CoreTray[], r: CoreReview): R[] {
  const rm = r.rockMass ?? {}
  if (!Object.keys(rm).length) return rows
  return rows.map(x => {
    const mid = (x.from + x.to) / 2
    const t = trays.find(t => mid >= t.from && mid < t.usedTo)
    const e = t ? rm[t.id] : undefined
    return e ? { ...x, weathering: e.weathering ?? x.weathering, gsi: e.gsi ?? x.gsi } : x
  })
}

/* One hole, loaded, with the photos added in the browser and the geologist's
 * corrections applied. */
export function useHole(hole: string | undefined) {
  const { holes, load, review, scope } = useCore()
  useEffect(() => { if (hole) void load(hole) }, [hole, load])
  // A hole outside a geologist's projects is not theirs to open, even by its address.
  const raw = hole ? holes[hole] : undefined
  const data = raw && scope && !scope.includes(raw.project) ? undefined : raw
  return useMemo(() => {
    if (!data) return { data: undefined, trays: [] as CoreTray[], flat: undefined, rows: [], total: undefined }
    const ups = review.uploads.filter(u => u.hole === data.hole)
    const trays = withMoves([...data.trays.filter(t => !ups.some(u => Math.abs(u.from - t.from) < 0.01)), ...ups].sort((a, b) => a.from - b.from), review)
    const flat = flatten(trays, overridesOf(review))
    const rows = withRockMass(intervals(flat, 1), trays, review)
    return { data, trays, flat, rows, total: totals(rows) }
  }, [data, review])
}

/* Every hole with photos, loaded together (screens that look across holes). */
export function useAllHoles(enabled = true) {
  const { index, holes, load, review } = useCore()
  useEffect(() => { if (enabled) index?.holes.forEach(h => void load(h.hole)) }, [index, load, enabled])
  return useMemo(() => {
    if (!index) return { ready: false, list: [] as ReturnType<typeof oneHole>[] }
    const list = index.holes.map(h => holes[h.hole]).filter(Boolean).map(d => oneHole(d, review))
    return { ready: list.length === index.holes.length, list }
  }, [index, holes, review])
}
function oneHole(data: CoreHole, review: CoreReview) {
  const ups = review.uploads.filter(u => u.hole === data.hole)
  const trays = withMoves([...data.trays.filter(t => !ups.some(u => Math.abs(u.from - t.from) < 0.01)), ...ups].sort((a, b) => a.from - b.from), review)
  const flat = flatten(trays, overridesOf(review))
  const rows = withRockMass(intervals(flat, 1), trays, review)
  return { data, trays, flat, rows, total: totals(rows), checked: trays.filter(t => review.checked[t.id]).length }
}

/* Veins with the geologist's corrections: a new class, or dropped as not a vein. */
export function editVeins<V extends { tray: string; from: number; cls: number; confidence: string }>(veins: V[], r: CoreReview): (V & { edited?: boolean })[] {
  const ed = r.veinEdits ?? {}
  if (!Object.keys(ed).length) return veins
  return veins.flatMap(v => {
    const e = ed[`${v.tray}@${v.from}`]
    if (e == null) return [v]
    if (e < 0) return []
    return [{ ...v, cls: e, confidence: 'high', edited: true }]
  })
}

/* The geologist's notes that cover the most of an interval of a hole. */
export function geoNoteFor(r: CoreReview, hole: string, a: number, b: number): GeoNote | undefined {
  const ov = (n: GeoNote) => Math.max(0, Math.min(b, n.to) - Math.max(a, n.from))
  return (r.geoNotes ?? []).filter(n => holeOfTray(n.tray) === hole && ov(n) > 1e-6).sort((p, q) => ov(q) - ov(p))[0]
}
