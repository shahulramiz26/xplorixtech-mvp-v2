import type { ShiftLog, InjuryOutcome } from './costing-store'
import { addDays } from './inventory-store'

/* ==========================================================================
 * HSE — safety figures, heat and fatigue, from the drill logs
 *
 * Nothing here needs a new form. Every figure comes from what the supervisor
 * already writes on the shift: crew on shift, shift hours, the incidents, and
 * (in the hot months) the heat lines.
 *
 *   Man-hours     crew on site × shift hours, every shift (a sub-contractor's
 *                 own crew included)
 *   LTIFR         lost-time injuries per million man-hours
 *   TRIFR         recordable injuries (lost time, restricted work, medical
 *                 treatment) per million man-hours. First aid and near misses
 *                 are counted, but are not recordable.
 *   Midday ban    Saudi Arabia (MHRSD with the National Council for
 *                 Occupational Safety and Health): no work under direct sun
 *                 12:00–15:00, 15 June to 15 September, private sector.
 *                 Every day shift worked in that window should say the crew
 *                 stopped for those hours.
 *   Fatigue       shifts longer than 12 hours, and a night shift followed by
 *                 a day shift the next day (no real rest). Long runs of days
 *                 are the crew finding in lib/findings.ts.
 * ========================================================================== */

export const MIDDAY_BAN = { from: '06-15', to: '09-15', start: '12:00', end: '15:00', who: 'MHRSD' }
export const HOT_C = 45            // a shift this hot needs water and shade on the log
export const MILLION = 1_000_000

export function inBanWindow(date: string) {
  const md = date.slice(5)
  return md >= MIDDAY_BAN.from && md <= MIDDAY_BAN.to
}

/* What an injury counts as. An incident logged before the form asked for an
 * outcome is read from its type and severity, the way a safety officer would. */
export function outcomeOf(i: { type: string; severity: string; outcome?: InjuryOutcome }): InjuryOutcome {
  if (i.outcome) return i.outcome
  if (/near miss/i.test(i.type)) return 'near-miss'
  if (!/injury/i.test(i.type)) return 'other'
  if (/critical/i.test(i.severity)) return 'lost-time'
  if (/major/i.test(i.severity)) return 'medical'
  return 'first-aid'
}
export const OUTCOME_LABEL: Record<InjuryOutcome, string> = {
  'lost-time': 'Lost-time injury', restricted: 'Restricted work', medical: 'Medical treatment',
  'first-aid': 'First aid', 'near-miss': 'Near miss', other: 'Damage or violation',
}
export const RECORDABLE: InjuryOutcome[] = ['lost-time', 'restricted', 'medical']

export interface HseEvent {
  id: string; date: string; rig: string; project: string; shift: string
  type: string; severity: string; note: string; outcome: InjuryOutcome; daysLost: number
}
export interface HseGroup { name: string; manHours: number; shifts: number; events: number; lti: number; recordable: number; ltifr: number; trifr: number }
export interface BanShift { id: string; date: string; rig: string; project: string; driller?: string; status: 'stopped' | 'worked' | 'not recorded'; maxTempC?: number; water?: boolean; shade?: boolean }
export interface FatigueFlag { id: string; kind: 'long' | 'turnaround'; who: string; date: string; rig: string; detail: string }

const rate = (n: number, hours: number) => hours > 0 ? n * MILLION / hours : 0
const manHoursOf = (l: ShiftLog) => (l.siteCrew ?? l.crewCount ?? 0) * (l.shiftHours || 0)

export function hse(logs: ShiftLog[], today: string, contractorOf: (l: ShiftLog) => string | undefined = () => undefined) {
  const whole = logs.filter(l => !l.segmentOf)
  const events: HseEvent[] = whole.flatMap(l => (l.incidents ?? []).map((i, n) => ({
    id: `${l.id}_${n}`, date: l.date, rig: l.rig, project: l.project, shift: l.shift,
    type: i.type || 'Not stated', severity: i.severity || 'Not stated', note: i.note,
    outcome: outcomeOf(i), daysLost: i.daysLost ?? 0,
  }))).sort((a, b) => b.date.localeCompare(a.date))
  const manHours = whole.reduce((s, l) => s + manHoursOf(l), 0)
  const lti = events.filter(e => e.outcome === 'lost-time')
  const recordable = events.filter(e => RECORDABLE.includes(e.outcome))
  const lastLti = lti[0]?.date, lastRec = recordable[0]?.date
  const daysSince = (d?: string) => d ? Math.round((Date.parse(today) - Date.parse(d)) / 864e5) : undefined

  const group = (key: (l: ShiftLog) => string): HseGroup[] => {
    const m = new Map<string, HseGroup>()
    whole.forEach(l => {
      const k = key(l); const g = m.get(k) ?? { name: k, manHours: 0, shifts: 0, events: 0, lti: 0, recordable: 0, ltifr: 0, trifr: 0 }
      g.manHours += manHoursOf(l); g.shifts += 1
      ;(l.incidents ?? []).forEach(i => { const o = outcomeOf(i); g.events += 1; if (o === 'lost-time') g.lti += 1; if (RECORDABLE.includes(o)) g.recordable += 1 })
      m.set(k, g)
    })
    return Array.from(m.values()).map(g => ({ ...g, ltifr: rate(g.lti, g.manHours), trifr: rate(g.recordable, g.manHours) })).sort((a, b) => b.manHours - a.manHours)
  }

  // ── the midday ban: every day shift in the window that was not on standby
  const ban: BanShift[] = whole.filter(l => l.shift === 'Day' && inBanWindow(l.date) && !l.standbyMode && l.drillingHours > 0).map(l => ({
    id: l.id, date: l.date, rig: l.rig, project: l.project, driller: l.driller,
    status: l.heat?.middayStop === true ? 'stopped' as const : l.heat?.middayStop === false ? 'worked' as const : 'not recorded' as const,
    maxTempC: l.heat?.maxTempC, water: l.heat?.water, shade: l.heat?.shade,
  })).sort((a, b) => b.date.localeCompare(a.date))
  const hotNoCover = whole.filter(l => (l.heat?.maxTempC ?? 0) >= HOT_C && (!l.heat?.water || !l.heat?.shade))

  // ── fatigue
  const fatigue: FatigueFlag[] = []
  whole.filter(l => l.shiftHours > 12).forEach(l => fatigue.push({
    id: `long:${l.id}`, kind: 'long', who: l.driller || l.rig, date: l.date, rig: l.rig, detail: `${l.shiftHours} h shift`,
  }))
  const byPerson = new Map<string, ShiftLog[]>()
  whole.forEach(l => { if (l.driller) byPerson.set(l.driller, [...(byPerson.get(l.driller) ?? []), l]) })
  byPerson.forEach((ls, who) => {
    const sorted = [...ls].sort((a, b) => (a.date + (a.shift === 'Day' ? 0 : 1)).localeCompare(b.date + (b.shift === 'Day' ? 0 : 1)))
    sorted.forEach((l, i) => {
      const next = sorted[i + 1]
      if (l.shift === 'Night' && next && next.shift === 'Day' && next.date === addDays(l.date, 1)) fatigue.push({
        id: `turn:${who}:${next.date}`, kind: 'turnaround', who, date: next.date, rig: next.rig,
        detail: `Night shift the day before, then the day shift straight after`,
      })
    })
  })
  fatigue.sort((a, b) => b.date.localeCompare(a.date))

  const banWorked = ban.filter(b => b.status === 'worked'), banMissing = ban.filter(b => b.status === 'not recorded')
  return {
    events, manHours, shifts: whole.length,
    lti: lti.length, recordable: recordable.length,
    ltifr: rate(lti.length, manHours), trifr: rate(recordable.length, manHours),
    daysSinceLti: daysSince(lastLti), daysSinceRecordable: daysSince(lastRec),
    byRig: group(l => l.rig), byProject: group(l => l.project),
    byCompany: group(l => contractorOf(l) ?? 'Own crews'),
    ban, banWorked, banMissing,
    banCompliance: ban.length ? Math.round(ban.filter(b => b.status === 'stopped').length / ban.length * 100) : undefined,
    hotNoCover, fatigue,
  }
}
export type Hse = ReturnType<typeof hse>
