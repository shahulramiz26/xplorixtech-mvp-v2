/* Rebuild lib/core/summary.json (what the core says about each shift) from the
 * hole files already in public/core, without measuring the photos again. Run
 * after a change to how the core numbers are counted: npx tsx scripts/core-summary.ts */
import fs from 'fs'
import path from 'path'
import { flatten, interval } from '../lib/core/geotech'
import type { CoreHole, CoreIndex } from '../lib/core/model'
import { SEED_SHIFT_LOGS } from '../lib/costing-store'

const OUT = path.join(__dirname, '..', 'public', 'core')
const index: CoreIndex = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'))
const logs = SEED_SHIFT_LOGS.filter(l => l.holeNumber && !l.segmentOf)
const summary: Record<string, { hole: string; from: number; to: number; recovery: number; rqd: number; ff: number; driller: number; photographed: number }> = {}
index.holes.forEach(({ hole }) => {
  const h: CoreHole = JSON.parse(fs.readFileSync(path.join(OUT, `${hole}.json`), 'utf8'))
  const f = flatten(h.trays)
  logs.filter(l => l.holeNumber === h.hole).forEach(l => {
    const a = l.meterStart ?? 0, b = l.meterEnd ?? 0
    const r = interval(f, a, b)
    if (!r || r.length < (b - a) * 0.6) return
    summary[l.id] = {
      hole: h.hole, from: a, to: b, recovery: +r.recovery.toFixed(1), rqd: +r.rqd.toFixed(1), ff: +r.ff.toFixed(2),
      driller: l.metresDrilled ? +((l.coreRecovery / l.metresDrilled) * 100).toFixed(1) : 0, photographed: +r.length.toFixed(2),
    }
  })
})
const file = path.join(__dirname, '..', 'lib', 'core', 'summary.json')
const old = JSON.parse(fs.readFileSync(file, 'utf8'))
fs.writeFileSync(file, JSON.stringify({ generatedAt: old.generatedAt, shifts: summary }))
const changed = Object.keys(summary).filter(k => old.shifts[k]?.recovery !== summary[k].recovery)
console.log(`${Object.keys(summary).length} shifts; recovery changed on ${changed.length}:`, changed.slice(0, 8).map(k => `${k} ${old.shifts[k]?.recovery}→${summary[k].recovery}`).join(', '))
