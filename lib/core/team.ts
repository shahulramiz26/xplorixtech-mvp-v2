'use client'

import { useMemo } from 'react'
import { useCosting, type AppUser } from '../costing-store'
import { TODAY } from '../company'
import { useAllHoles, useCore, holeOfTray, type CoreReview } from './store'

/* ==========================================================================
 * XPLORIX CORE — the geologists, side by side
 *
 * Every check and correction on the core carries the name of the geologist
 * who made it. From that record, for each geologist login:
 *
 *   output       metres of core they signed off (trays checked)
 *   turnaround   hours from the tray photo to their check
 *   care         of the breaks the photo step was unsure of on their trays,
 *                the share they confirmed or changed; and the geology notes
 *                they added (what a photo cannot show). A share, so a hole
 *                with many unsure breaks does not count for or against them.
 *   backlog      trays still unchecked on their projects
 *
 * The score is out of 100: 40 for output, 30 for speed, 30 for care (22.5 for
 * the share of unsure breaks reviewed, 7.5 for notes per tray), each against
 * the best in the team for the same period. Speed never wins alone:
 * checking trays without looking at them scores low on care. A geologist
 * with less than MIN_METRES in the period is shown but not ranked, so a new
 * starter is not put at the bottom.
 * ========================================================================== */

export const MIN_METRES = 50
export type Period = '30' | '90' | 'all'
export const PERIOD_LABEL: Record<Period, string> = { '30': 'Last 30 days', '90': 'Last 90 days', all: 'All time' }

/* What a line in the change log is: work on the tray itself, or bookkeeping. */
const NOT_A_CORRECTION = /^(Marked the tray checked|Opened the tray again|Added tray photo|Removed an added tray photo)/
const IS_NOTE = /^(Added|Changed) geology /

export interface Activity { at: string; what: string; tray?: string; hole?: string; n: number; kind: 'check' | 'correction' | 'note' | 'other' }

export interface GeologistStats {
  user: AppUser
  name: string
  trays: number
  metres: number
  turnaround: number | null     // hours, mean
  corrections: number
  notes: number
  unsure: number                // breaks the photo step was unsure of, on their checked trays
  reviewed: number              // of those, confirmed or changed
  care: number                  // reviewed share, 0–100 %
  backlog: number               // trays waiting on their projects
  holes: string[]
  weekly: { week: string; metres: number }[]
  activity: Activity[]
  ranked: boolean
  score: number                 // 0–100, 0 when not ranked
  parts: { output: number; speed: number; care: number }
  rank: number | null
}

const clean = (by: string) => by.replace(/ \(geologist\)$/, '').trim().toLowerCase()
const hours = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 3.6e6
/* The Monday of the week a date falls in, as YYYY-MM-DD. */
function weekOf(d: string) {
  const t = new Date(`${d.slice(0, 10)}T12:00:00Z`)
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7))
  return t.toISOString().slice(0, 10)
}

export function useTeam(period: Period) {
  const { state } = useCosting()
  const { review } = useCore()
  const all = useAllHoles()

  return useMemo(() => {
    const geologists = state.users.filter(u => u.role === 'geologist')
    const since = period === 'all' ? '' : (() => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - Number(period)); return d.toISOString().slice(0, 10) })()
    const inPeriod = (at: string) => at.slice(0, 10) >= since

    // Every tray: its metres, when it was photographed, its hole and project.
    const trays: Record<string, { metres: number; takenAt?: string; hole: string; project: string; unsure: string[] }> = {}
    all.list.forEach(h => h.trays.forEach(t => { trays[t.id] = { metres: Math.max(0, t.usedTo - t.from), takenAt: t.takenAt, hole: h.data.hole, project: h.data.project, unsure: t.breaks.filter(b => b.confidence === 'low').map(b => b.id) } }))
    const waitingOn = (project: string) => Object.entries(trays).filter(([id, t]) => t.project === project && !review.checked[id]).length

    const stats: GeologistStats[] = geologists.map(user => {
      const me = clean(user.name)
      const checks = Object.entries(review.checked).filter(([id, c]) => clean(c.by) === me && inPeriod(c.at) && trays[id])
      const metres = checks.reduce((s, [id]) => s + trays[id].metres, 0)
      const turns = checks.map(([id, c]) => trays[id].takenAt ? hours(trays[id].takenAt!, c.at) : NaN).filter(h => Number.isFinite(h) && h >= 0)
      const mine = (review.changes as CoreReview['changes']).filter(c => clean(c.by) === me && inPeriod(c.at))
      const corrections = mine.filter(c => !NOT_A_CORRECTION.test(c.what) && !IS_NOTE.test(c.what)).reduce((s, c) => s + (c.n ?? 1), 0)
      const notes = (review.geoNotes ?? []).filter(n => clean(n.by) === me && inPeriod(n.at)).length
      const unsure = checks.reduce((s, [id]) => s + trays[id].unsure.length, 0)
      const reviewed = checks.reduce((s, [id]) => s + trays[id].unsure.filter(b => review.breaks[b]).length, 0)
      const byWeek: Record<string, number> = {}
      checks.forEach(([id, c]) => { const w = weekOf(c.at); byWeek[w] = (byWeek[w] ?? 0) + trays[id].metres })
      const activity: Activity[] = mine.map(c => ({
        at: c.at, what: c.what, tray: c.tray, hole: c.tray ? holeOfTray(c.tray) : undefined, n: c.n ?? 1,
        kind: c.what.startsWith('Marked the tray checked') ? 'check' : IS_NOTE.test(c.what) ? 'note' : NOT_A_CORRECTION.test(c.what) ? 'other' : 'correction',
      }))
      const projects = user.projects ?? []
      return {
        user, name: user.name, trays: checks.length, metres,
        turnaround: turns.length ? turns.reduce((s, h) => s + h, 0) / turns.length : null,
        corrections, notes, unsure, reviewed, care: unsure ? (reviewed / unsure) * 100 : 100,
        backlog: projects.reduce((s, p) => s + waitingOn(p), 0),
        holes: Array.from(new Set(checks.map(([id]) => trays[id].hole))).sort(),
        weekly: Object.entries(byWeek).sort(([a], [b]) => (a < b ? -1 : 1)).map(([week, m]) => ({ week, metres: Math.round(m) })),
        activity, ranked: metres >= MIN_METRES, score: 0, parts: { output: 0, speed: 0, care: 0 }, rank: null,
      }
    })

    // The score: each part against the best in the team, for the same period.
    const pool = stats.filter(s => s.ranked)
    const bestMetres = Math.max(0, ...pool.map(s => s.metres))
    const bestTurn = Math.min(Infinity, ...pool.map(s => s.turnaround ?? Infinity))
    const bestCare = Math.max(0, ...pool.map(s => s.care))
    const notesRate = (s: GeologistStats) => s.trays ? s.notes / s.trays : 0
    const bestNotes = Math.max(0, ...pool.map(notesRate))
    pool.forEach(s => {
      const output = bestMetres ? (s.metres / bestMetres) * 40 : 0
      const speed = s.turnaround && Number.isFinite(bestTurn) ? Math.min(1, bestTurn / s.turnaround) * 30 : 0
      const care = (bestCare ? Math.min(1, s.care / bestCare) * 22.5 : 0) + (bestNotes ? Math.min(1, notesRate(s) / bestNotes) * 7.5 : 0)
      s.parts = { output, speed, care }
      s.score = Math.round(output + speed + care)
    })
    pool.sort((a, b) => b.score - a.score || b.metres - a.metres).forEach((s, i) => { s.rank = i + 1 })
    const ordered = [...pool, ...stats.filter(s => !s.ranked).sort((a, b) => b.metres - a.metres)]

    const totalMetres = stats.reduce((s, g) => s + g.metres, 0)
    const allTurns = stats.filter(s => s.turnaround != null)
    const waiting = Object.keys(trays).filter(id => !review.checked[id]).length
    // Weeks across the team, for the chart.
    const weeks = Array.from(new Set(stats.flatMap(s => s.weekly.map(w => w.week)))).sort()
    const chart = weeks.map(w => ({ week: w, ...Object.fromEntries(stats.map(s => [s.user.id, s.weekly.find(x => x.week === w)?.metres ?? 0])) }))

    return {
      ready: all.ready, since, list: ordered, totalMetres, waiting, chart,
      turnaround: allTurns.length ? allTurns.reduce((s, g) => s + g.turnaround! * g.trays, 0) / allTurns.reduce((s, g) => s + g.trays, 0) : null,
    }
  }, [state.users, review, all.list, all.ready, period])
}

export const fmtHours = (h: number | null) => h == null ? '–' : h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} days`

/* One colour per geologist, the same on every chart. */
const COLOURS = ['var(--x-orange)', 'var(--x-blue)', 'var(--x-teal)', 'var(--x-purple)', 'var(--x-amber)', 'var(--x-pink)']
export const colourOf = (users: AppUser[], id: string) => COLOURS[Math.max(0, users.filter(u => u.role === 'geologist').findIndex(u => u.id === id)) % COLOURS.length]
