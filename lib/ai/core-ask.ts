import type { ShiftLog } from '../costing-store'
import type { CoreReview } from '../core/store'
import type { CoreIndex } from '../core/model'
import type { GeoData } from '../core/geo-data'
import { totals, rqdClass, gsiClass, WEATHERING } from '../core/geotech'
import { shiftCore, factors } from '../core/drill-link'
import { VEIN_CLASSES, MINERALS, strengthGrade, hasData, mean, FEATURES, type Metre } from '../core/downhole'
import type { Answer } from './ask'
import type { Source } from './record'

/* ==========================================================================
 * ASK XPLORIX — GEOLOGY
 *
 * The same panel as on the drilling side, answering from the core record:
 * the tray photos and what the geologist changed, veins,
 * assays, geophysics, scanner, televiewer, lab tests, the domains and the
 * predictions, and the shift logs that drilled each metre. Every answer
 * lists what it read. What it does not understand it says so.
 * ========================================================================== */

export interface CoreAiCtx {
  data: GeoData
  review: CoreReview
  index: CoreIndex | null
  logs: ShiftLog[]
  className: (id: number) => string
  veinName: (id: number) => string
}

const has = (q: string, ...w: (string | RegExp)[]) => w.some(x => typeof x === 'string' ? q.includes(x) : x.test(q))
const pct = (v: number) => `${Math.round(v)}%`
const n0 = (v: number) => Math.round(v).toLocaleString('en-US')
const list = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
const S = {
  today: { label: 'Geology today', href: '/admin/geology' }, holes: { label: 'Hole logs', href: '/admin/geology/holes' }, review: { label: 'Review trays', href: '/admin/geology/review' },
  veins: { label: 'Vein classes', href: '/admin/geology/veins' }, data: { label: 'Downhole data', href: '/admin/geology/data' },
  domains: { label: 'Domains', href: '/admin/geology/domains' }, predict: { label: 'Predictions', href: '/admin/geology/predict' }, structures: { label: 'Structures', href: '/admin/geology/structures' },
  rock: { label: 'Rock mass', href: '/admin/geology/rock-mass' }, classes: { label: 'Rock classes', href: '/admin/geology/classes' }, export: { label: 'Export', href: '/admin/geology/export' },
} satisfies Record<string, Source>
const hole = (h: string): Source => ({ label: `${h} log`, href: `/admin/geology/holes/${h}` })

export function coreSuggestions(path: string): string[] {
  if (path.includes('/veins')) return ['How many veins are in DH-131?', 'Where are the unsure veins?', 'Give me the geology brief']
  if (path.includes('/data') || path.includes('/domains')) return ['Explain the domains', 'Where is the weak ground?', 'Give me the geology brief']
  if (path.includes('/predict')) return ['Where is the weak ground?', 'How good are the strength predictions?', 'What minerals are in DH-101?']
  if (path.includes('/structures')) return ['What are the joint sets?', 'Which way do the fractures dip in DH-961?', 'Where is the weak ground?']
  if (path.includes('/holes/')) { const h = path.split('/').pop(); return [`Tell me about ${h}`, `Where is the weak ground in ${h}?`, `Draft a note to the driller about core loss on ${h}`] }
  return ['Give me the geology brief', 'Which shifts lost core, and why?', 'Where is the weak ground?', 'Which trays should I check first?']
}

export function askCore(question: string, c: CoreAiCtx): Answer {
  const q = question.toLowerCase().replace(/[’']/g, "'").trim()
  if (!c.data.ready) return { understood: true, text: ['Still reading the core photos and the downhole data. Ask again in a moment.'], sources: [], followups: [] }
  const holes = (question.toUpperCase().match(/\bDH-?\d{3}\b/g) ?? []).map(x => x.replace(/^DH-?/, 'DH-'))
  const dh = holes.filter(h => c.data.holes.some(x => x.data.hole === h))
  try {
    if (has(q, 'draft', 'write', 'note to', 'message', 'email')) return draft(q, c, dh[0])
    if (has(q, 'brief', 'summary', 'summarise', 'summarize', 'overview', 'how are we', 'how is the core')) return brief(c)
    if (has(q, 'compare') && dh.length >= 2) return compare(dh, c)
    if (has(q, 'gold', ' au', 'au ', 'grade', 'mineralis', 'mineraliz', 'ore', 'intercept', 'assay')) return noAssays()
    if (has(q, 'vein')) return veins(c, dh[0])
    if (has(q, 'domain', 'cluster', 'group')) return domains(c)
    if (has(q, 'weak', 'strength', 'ucs', 'hard', 'support', 'strong')) return strength(c, dh[0], has(q, 'good', 'accura', 'trust', 'r2', 'r²'))
    if (has(q, 'mineral', 'hyperspectral', 'clay', 'quartz', 'carbonate', 'chlorite', 'mica', 'scanner')) return minerals(c, dh[0])
    if (has(q, 'joint set', 'structure', 'dip', 'televiewer', 'orientation', 'stereonet', 'fault', 'shear')) return structures(c, dh[0])
    if (has(q, 'lost core', 'lose core', 'core loss', 'losing core', 'recovery', 'driller', 'shift')) return coreLoss(c, dh[0])
    if (has(q, 'tray', 'to check', 'waiting', 'review', 'unsure')) return trays(c)
    if (has(q, 'rock class', 'classes', 'lithology', 'rock type', 'what rock')) return classes(c)
    if (has(q, 'rqd', 'rock quality', 'geotech', 'rock mass', 'gsi', 'fracture', 'broken')) return rockMass(c, dh[0])
    if (has(q, 'export', 'leapfrog', 'micromine', 'datamine', 'acquire', 'csv')) return exportAns()
    if (dh.length) return holeAnswer(dh[0], c)
  } catch { /* fall through */ }
  return {
    understood: false,
    text: ['I could not match that to the core record. On the geology side I answer about holes, recovery and RQD, the shifts that lost core, veins, the geologist\'s log, domains, rock strength, minerals, joint sets and trays to check, and I can draft notes.'],
    sources: [], followups: ['Give me the geology brief', 'Which shifts lost core, and why?', 'Where is the weak ground?'],
  }
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

const hv = (c: CoreAiCtx, h: string) => c.data.holes.find(x => x.data.hole === h)!
const allTotals = (c: CoreAiCtx) => totals(c.data.holes.flatMap(h => h.rows))


function brief(c: CoreAiCtx): Answer {
  const t = allTotals(c)
  const trays = c.data.holes.reduce((s, h) => s + h.trays.length, 0)
  const checked = c.data.holes.reduce((s, h) => s + h.trays.filter(x => c.review.checked[x.id]).length, 0)
  const sc = c.data.holes.flatMap(h => shiftCore(c.logs, h.data.hole, h.flat))
  const low = sc.filter(s => s.core.recovery < 85)

  const weak = c.data.pred ? c.data.metres.filter((_, i) => c.data.pred!.ucs[i] < 25).length : 0
  return {
    understood: true,
    text: [
      '**Geology brief**',
      `${n0(t.metres)} m of core photographed on ${c.data.holes.length} holes: recovery **${pct(t.recovery)}**, RQD **${pct(t.recovery ? t.rqd : 0)}** (${rqdClass(t.rqd).toLowerCase()}), ${t.ff.toFixed(1)} natural fractures a metre.`,
      `${trays - checked} of ${trays} trays still wait for a geologist's check, with ${n0(t.unsure)} breaks the photo step is unsure of.`,
      low.length ? `${low.length} ${low.length === 1 ? 'shift' : 'shifts'} brought up under 85% of ${low.length === 1 ? 'its' : 'their'} core; the worst is ${low.sort((a, b) => a.core.recovery - b.core.recovery)[0].log.holeNumber} ${low[0].log.meterStart}–${low[0].log.meterEnd} m at ${pct(low[0].core.recovery)}.` : 'No shift brought up under 85% of its core.',
      `${c.data.veins.length} veins found on the photos.`,
      weak ? `${n0(weak)} m are predicted weaker than 25 MPa: plan support there.` : '',
    ].filter(Boolean),
    sources: [S.today, S.review, S.data],
    followups: ['Which shifts lost core, and why?', 'Where is the weak ground?', 'Which trays should I check first?'],
  }
}

function holeAnswer(h: string, c: CoreAiCtx): Answer {
  const x = hv(c, h)
  const t = totals(x.rows)
  const ms = c.data.byHole[h]
  const vs = c.data.veins.filter(v => v.hole === h)
  const clsShare: Record<number, number> = {}
  x.rows.forEach(r => { if (r.cls >= 0) clsShare[r.cls] = (clsShare[r.cls] ?? 0) + r.length })
  const topCls = Object.entries(clsShare).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${c.className(+k)} ${pct((v / t.metres) * 100)}`)
  const worst = [...x.rows].sort((a, b) => a.rqd - b.rqd)[0]
  return {
    understood: true,
    text: [
      `**${h}** (${x.data.project}, ${x.data.rig}): ${n0(t.metres)} m photographed of ${n0(x.data.drilled)} m drilled. Recovery ${pct(t.recovery)}, RQD ${pct(t.rqd)} (${rqdClass(t.rqd).toLowerCase()}), GSI ${Math.round(t.gsi)} (${gsiClass(t.gsi).toLowerCase()}), ${t.ff.toFixed(1)} fractures a metre, weathering ${WEATHERING[Math.round(t.weathering)]?.toLowerCase()}.`,
      `Rock: ${list(topCls)}. Poorest metre ${worst.from}–${worst.to} m, RQD ${pct(worst.rqd)}.`,
      `${vs.length} veins on the photos${vs.length ? `, mostly Class ${VEIN_CLASSES[mode(vs.map(v => v.cls))].letter}` : ''}.`,
    ],
    sources: [hole(h), S.data],
    followups: [`Where is the weak ground in ${h}?`, shiftCore(c.logs, h, x.flat).some(s => s.core.recovery < 85) ? `Draft a note to the driller about core loss on ${h}` : `Which trays in ${h} still need a check?`, `Which way do the fractures dip in ${h}?`],
  }
}
const mode = (xs: number[]) => { const m: Record<number, number> = {}; xs.forEach(x => { m[x] = (m[x] ?? 0) + 1 }); return +Object.entries(m).sort((a, b) => b[1] - a[1])[0][0] }

function compare(hs: string[], c: CoreAiCtx): Answer {
  const rows = hs.map(h => { const x = hv(c, h); const t = totals(x.rows); const ms = c.data.byHole[h]; return [h, pct(t.recovery), pct(t.rqd), t.ff.toFixed(1), String(Math.round(t.gsi)), String(c.data.veins.filter(v => v.hole === h).length)] })
  return { understood: true, text: [`${list(hs)} side by side, from the photos:`], table: { cols: ['Hole', 'Recovery', 'RQD', 'Fract./m', 'GSI', 'Veins'], rows }, sources: hs.map(hole), followups: hs.map(h => `Tell me about ${h}`) }
}

/* Gold and grades come from the lab's assays, which are not loaded yet. */
function noAssays(): Answer {
  return { understood: true, text: ['Gold and grades come from your lab assays, and none are loaded yet. Import the assay file (HOLE_ID, FROM, TO, Au …) on Downhole data and I will line it up with the photos, by depth, and answer which stretches and which rock and vein types carry the grade.'], sources: [S.data], followups: ['Give me the geology brief', 'Where is the weak ground?'] }
}

function veins(c: CoreAiCtx, h?: string): Answer {
  const vs = h ? c.data.veins.filter(v => v.hole === h) : c.data.veins
  const rows = VEIN_CLASSES.map(k => { const xs = vs.filter(v => v.cls === k.id); return { k, n: xs.length, m: xs.reduce((s, v) => s + v.length, 0) } })
  const best = rows.slice().sort((a, b) => b.m - a.m)[0]
  return {
    understood: true,
    text: [`${n0(vs.length)} veins found on the photos${h ? ` of ${h}` : ` of ${c.data.holes.length} holes`}. Most vein metres are **Class ${best.k.letter} (${c.veinName(best.k.id).toLowerCase()})**, ${best.m.toFixed(1)} m.`, `${vs.filter(v => v.confidence === 'low').length} veins are unsure of their class and worth a look.`],
    table: { cols: ['Class', 'Veins', 'Metres'], rows: rows.map(r => [`${r.k.letter} · ${c.veinName(r.k.id)}`, String(r.n), r.m.toFixed(1)]) },
    sources: [S.veins], followups: ['Where are the unsure veins?', 'Give me the geology brief'],
  }
}


function domains(c: CoreAiCtx): Answer {
  const d = c.data.domains('all')
  return {
    understood: true,
    text: [`Every metre grouped by its photo, chemistry and geophysics together gives ${d.k} domains. Each is named by what sets it apart:`],
    table: { cols: ['Domain', 'Metres'], rows: d.names.map((n, k) => [`${k + 1}. ${n}`, String(d.sizes[k])]) },
    sources: [S.domains], followups: ['Where is the weak ground?', 'Which trays should I check first?'],
  }
}

function strength(c: CoreAiCtx, h: string | undefined, fit: boolean): Answer {
  const p = c.data.pred!
  if (fit) return { understood: true, text: [`Strength is fitted on ${p.ucsFit.n} lab UCS tests and checked on holes the fit did not see: it explains **${pct(p.ucsFit.r2 * 100)}** of the variation (log UCS). The main mineral is right ${pct(p.mineralFit.accuracy * 100)} of the time on unseen holes. More lab tests make both better.`], sources: [S.predict], followups: ['Where is the weak ground?'] }
  const zones: { hole: string; from: number; to: number; ucs: number }[] = []
  c.data.metres.forEach((m, i) => {
    if (h && m.hole !== h) return
    if (p.ucs[i] >= 25) return
    const l = zones[zones.length - 1]
    if (l && l.hole === m.hole && Math.abs(l.to - m.from) < 0.01) { l.ucs = (l.ucs * (l.to - l.from) + p.ucs[i]) / (l.to - l.from + 1); l.to = m.to } else zones.push({ hole: m.hole, from: m.from, to: m.to, ucs: p.ucs[i] })
  })
  const big = zones.filter(z => z.to - z.from >= 3).sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 8)
  return {
    understood: true,
    text: [big.length ? `Weak ground, 3 m or more predicted under 25 MPa (${strengthGrade(20).grade} or weaker)${h ? ` in ${h}` : ''}:` : `No run of 3 m is predicted weaker than 25 MPa${h ? ` in ${h}` : ''}.`, big.length ? 'Plan support there, and expect slower drilling and lower recovery.' : ''].filter(Boolean),
    table: big.length ? { cols: ['Hole', 'From–to', 'UCS (pred.)', 'Grade'], rows: big.map(z => [z.hole, `${z.from}–${z.to} m`, `${Math.round(z.ucs)} MPa`, strengthGrade(z.ucs).grade]) } : undefined,
    sources: [S.predict, S.rock], followups: ['How good are the strength predictions?', 'Which shifts lost core, and why?'],
  }
}

function minerals(c: CoreAiCtx, h?: string): Answer {
  const p = c.data.pred!
  const idx = c.data.metres.map((m, i) => ({ m, i })).filter(x => !h || x.m.hole === h)
  const share = MINERALS.map((name, k) => ({ name, s: idx.filter(x => p.mineral[x.i] === k).length / Math.max(1, idx.length) })).sort((a, b) => b.s - a.s)
  const scanned = h ? hasData('scanner', h) : false
  return {
    understood: true,
    text: [`Main mineral by metre${h ? ` in ${h}` : ''}: ${list(share.filter(x => x.s > 0.02).map(x => `${x.name.toLowerCase()} ${pct(x.s * 100)}`))}.`, h ? (scanned ? `${h} was scanned, so these are measured.` : `${h} was not scanned: predicted from the photos, chemistry and geophysics, right ${pct(p.mineralFit.accuracy * 100)} of the time on unseen holes.`) : `Four holes were scanned; the rest are predicted.`],
    sources: [S.predict, S.data], followups: ['Where is the weak ground?', 'Explain the domains'],
  }
}

function structures(c: CoreAiCtx, h?: string): Answer {
  const tv = c.data.holes.filter(x => hasData('televiewer', x.data.hole)).map(x => x.data.hole)
  const hs = h && tv.includes(h) ? [h] : tv
  const rows = hs.flatMap(hl => { const st = c.data.structures.filter(s => s.hole === hl); return Array.from(new Set(st.map(s => s.set))).sort().map(k => { const xs = st.filter(s => s.set === k); const dd = Math.atan2(mean(xs.map(s => Math.sin(s.dipDir * Math.PI / 180))), mean(xs.map(s => Math.cos(s.dipDir * Math.PI / 180)))) * 180 / Math.PI; return [hl, `Set ${k + 1}`, String(xs.length), `${Math.round(mean(xs.map(s => s.dip)))}°`, `${String(Math.round((dd + 360) % 360)).padStart(3, '0')}°`] }) })
  return {
    understood: true,
    text: [h && !tv.includes(h) ? `${h} has no televiewer run, so only alpha (angle to the core) is known from its photos. Joint sets with true orientation, from the holes that have one:` : `Joint sets from the televiewer, as dip and dip direction:`],
    table: { cols: ['Hole', 'Set', 'Planes', 'Dip', 'Dip dir.'], rows }, sources: [S.structures], followups: ['Where is the weak ground?', 'What do the joint sets mean for the pit wall?'],
  }
}

function coreLoss(c: CoreAiCtx, h?: string): Answer {
  const sc = (h ? [hv(c, h)] : c.data.holes).flatMap(x => shiftCore(c.logs, x.data.hole, x.flat))
  const low = sc.filter(s => s.core.recovery < 85).sort((a, b) => a.core.recovery - b.core.recovery)
  const f = factors(sc)
  const speed = f.find(x => x.title === 'Drilling speed')
  const drl = f.find(x => x.title === 'Driller')
  const worstD = drl?.groups.slice().sort((a, b) => a.vsRec - b.vsRec)[0]
  const fast = speed?.groups.find(g => g.label.includes('faster'))
  return {
    understood: true,
    text: [
      low.length ? `${low.length} shifts${h ? ` on ${h}` : ''} brought up under 85% of their core on the photos.` : `No shift${h ? ` on ${h}` : ''} brought up under 85% of its core.`,
      fast && fast.shifts ? `Shifts drilled 20% or more faster than the rig's normal for the ground recovered **${fast.vsRec >= 0 ? '+' : ''}${fast.vsRec.toFixed(1)} points** against the same ground at normal speed.` : '',
      worstD && worstD.vsRec < -1 ? `${worstD.label}'s shifts recover ${worstD.vsRec.toFixed(1)} points under the same ground on average. A pattern to ask about, not proof.` : '',
    ].filter(Boolean),
    table: low.length ? { cols: ['Hole · depth', 'Shift', 'Driller', 'Photo rec.', 'Driller rec.'], rows: low.slice(0, 8).map(s => [`${s.log.holeNumber} ${s.log.meterStart}–${s.log.meterEnd} m`, `${s.log.date} ${s.log.shift}`, s.log.driller ?? '—', pct(s.core.recovery), pct(s.drillerRec)]) } : undefined,
    sources: [S.today, ...(h ? [hole(h)] : [])], followups: [`Draft a note to the driller about core loss${h ? ` on ${h}` : ''}`, 'Where is the weak ground?'],
  }
}

function trays(c: CoreAiCtx): Answer {
  const ts = c.data.holes.flatMap(h => h.trays).filter(t => !c.review.checked[t.id])
  const top = ts.map(t => ({ t, n: t.breaks.filter(b => b.confidence === 'low').length })).sort((a, b) => b.n - a.n).slice(0, 6)
  return { understood: true, text: [`${ts.length} trays wait for a check. Start where the photo step is least sure:`], table: { cols: ['Tray', 'Depth', 'Unsure breaks'], rows: top.map(x => [`${x.t.hole} T${x.t.no}`, `${x.t.from.toFixed(1)}–${x.t.usedTo.toFixed(1)} m`, String(x.n)]) }, sources: [S.review], followups: ['Give me the geology brief'] }
}

function classes(c: CoreAiCtx): Answer {
  const rows = (c.index?.classes ?? []).map(k => [c.className(k.id), pct(k.share * 100)])
  return { understood: true, text: ['The photos split the core into classes that look alike; the geologist names each class once:'], table: { cols: ['Class', 'Share of core'], rows }, sources: [S.classes], followups: ['Explain the domains', 'Which trays should I check first?'] }
}

function rockMass(c: CoreAiCtx, h?: string): Answer {
  if (h) return holeAnswer(h, c)
  const rows = c.data.holes.map(x => { const t = totals(x.rows); return { h: x.data.hole, t } }).sort((a, b) => a.t.rqd - b.t.rqd)
  return { understood: true, text: [`Rock quality by hole, poorest first. Overall RQD ${pct(allTotals(c).rqd)}.`], table: { cols: ['Hole', 'RQD', 'Fract./m', 'GSI'], rows: rows.map(r => [r.h, pct(r.t.rqd), r.t.ff.toFixed(1), String(Math.round(r.t.gsi))]) }, sources: [S.rock], followups: ['Where is the weak ground?', 'What are the joint sets?'] }
}


function exportAns(): Answer {
  return { understood: true, text: ['Export gives an interval table with HOLE_ID, FROM, TO first, so Leapfrog, Micromine, Datamine and acQuire read it directly: every photo measure, the rock class, the domain and the predictions, at 0.5, 1, 2 or 3 m. Domains, predictions, structures and downhole data each have their own CSV on their screens.'], sources: [S.export], followups: [] }
}

function draft(q: string, c: CoreAiCtx, h?: string): Answer {
  const hs = h ? [h] : c.data.holes.map(x => x.data.hole)
  const sc = hs.flatMap(hl => shiftCore(c.logs, hl, hv(c, hl).flat)).filter(s => s.core.recovery < 85).sort((a, b) => a.core.recovery - b.core.recovery).slice(0, 5)
  if (!sc.length) return { understood: true, text: [`No shift${h ? ` on ${h}` : ''} lost more than 15% of its core on the photos, so there is nothing to raise with the driller.`], sources: [S.today], followups: ['Which shifts lost core, and why?'] }
  const d = sc[0].log.driller ?? 'the driller'
  return {
    understood: true, text: [`A note to ${d} and the site supervisor about the core lost${h ? ` on ${h}` : ''}:`], sources: [S.today, ...(h ? [hole(h)] : [])],
    draft: { kind: 'email', to: `${d} and the site supervisor`, via: 'Message', subject: `Core recovery${h ? ` on ${h}` : ''}`, body: `Hi ${d},\n\nThe tray photos show less core than the drill log for these shifts:\n\n${sc.map(s => `• ${s.log.holeNumber} ${s.log.meterStart}–${s.log.meterEnd} m (${s.log.date} ${s.log.shift.toLowerCase()}): ${pct(s.core.recovery)} on the photo, ${pct(s.drillerRec)} in the log${s.fast ? `, drilled at ${s.rate.toFixed(2)} m/h against a normal ${s.normal.toFixed(2)}` : ''}`).join('\n')}\n\nIn broken ground please slow the feed and shorten the runs. Could you note the ground and any blocked barrels on these shifts?\n\nThanks`, approve: 'Approve', done: 'Message sent' },
    followups: ['Which shifts lost core, and why?'],
  }
}
