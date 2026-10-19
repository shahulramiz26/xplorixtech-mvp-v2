'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { moneyL } from '../../lib/costing-store'
import { DEPTS, deptLabel, type Dept, type Severity } from '../../lib/findings'
import type { InboxUnit } from '../../lib/inbox'
import { useInbox, UnitCard, dayWord } from './inbox'
import { T, tint, display } from './kit'

/* ==========================================================================
 * THE DASHBOARD INBOX — the company's whole list
 *
 * Built so 50 or 200 findings stay readable and none is skipped:
 *   · what needs action now is shown in full, grouped by department;
 *   · "plan" and "watch" are folded by department, every group with its
 *     count, so nothing is out of sight without being counted;
 *   · new since yesterday is pointed out first, and still listed in place;
 *   · reminders wait in view with their date; handled ones keep who did it;
 *   · "one by one" walks every open story in turn (app/admin/inbox).
 * ========================================================================== */

type GroupBy = 'urgency' | 'dept' | 'place'
const SEV_WORD: Record<Severity, string> = { act: 'Act now', plan: 'Plan this week', watch: 'Watch' }
const SEV_NOTE: Record<Severity, string> = {
  act: 'Today, before anything else.',
  plan: 'This week. Folded by department; every group shows its count.',
  watch: 'Not urgent; kept so a trend is not missed.',
}

const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--x-card-shadow)' }
const chipBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '6px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: T.text }

function groupBy<K extends string>(list: InboxUnit[], key: (u: InboxUnit) => K): [K, InboxUnit[]][] {
  const m = new Map<K, InboxUnit[]>()
  list.forEach(u => { const k = key(u); m.set(k, [...(m.get(k) ?? []), u]) })
  return Array.from(m.entries())
}
const placeOf = (u: InboxUnit) => u.items[0].rig ?? u.items[0].project ?? 'Across the company'

function Fold({ title, count, money, first, children, open: start = false }: { title: string; count: number; money: number; first?: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(start)
  return (
    <div style={{ borderTop: `1px solid ${T.line}` }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '10px 18px', border: 'none', background: 'transparent',
        fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: T.text, flexWrap: 'wrap',
      }}>
        {open ? <ChevronDown size={16} aria-hidden style={{ color: T.muted }} /> : <ChevronRight size={16} aria-hidden style={{ color: T.muted }} />}
        <span style={{ fontWeight: 600, fontSize: 13.5, minWidth: 170 }}>{title} · {count}</span>
        {!open && first && <span style={{ flex: '1 1 240px', fontSize: 12.5, color: T.muted, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first}</span>}
        {money > 0 && <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600 }}>{moneyL(money)}</span>}
      </button>
      {open && <div style={{ borderTop: `1px solid ${T.line}` }}>{children}</div>}
    </div>
  )
}

function List({ units }: { units: InboxUnit[] }) {
  return <>{units.map((u, i) => <UnitCard key={u.id} u={u} first={i === 0} />)}</>
}

export function InboxBoard() {
  const inbox = useInbox()
  const [dept, setDept] = useState<'all' | Dept>('all')
  const [by, setBy] = useState<GroupBy>('urgency')
  const [showHandled, setShowHandled] = useState(false)
  const inDept = (u: InboxUnit) => dept === 'all' || u.depts.includes(dept)
  const open = inbox.open.filter(inDept)
  const fresh = inbox.fresh.filter(inDept)
  const reminders = inbox.reminders.filter(inDept)
  const handled = inbox.handled.filter(inDept)
  const total = inbox.units.filter(inDept).length
  const reviewed = inbox.units.filter(inDept).filter(u => u.state !== 'open').length
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`
  const sum = (l: InboxUnit[]) => l.reduce((s, u) => s + (u.money ?? 0), 0)
  const deptsWith = DEPTS.filter(d => inbox.byDept[d.key].open > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section aria-label="Progress" style={{ ...card, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center' }}>
        <div style={{ flex: '1 1 320px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: T.text }}>Answered: {reviewed} of {total}</span>
            <span style={{ color: T.muted }}>{handled.length} done or set aside · {open.filter(u => u.state === 'handed').length} handed on · {reminders.length} reminders · {open.filter(u => u.state === 'open').length} still to look at</span>
          </div>
          <div aria-hidden style={{ height: 10, borderRadius: 999, background: 'rgba(var(--x-ov),0.07)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: pct(handled.length), background: T.green }} />
            <div style={{ width: pct(open.filter(u => u.state === 'handed').length), background: T.blue }} />
            <div style={{ width: pct(reminders.length), background: tint(T.blue, 45) }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {(['act', 'plan', 'watch'] as Severity[]).map(s => (
            <div key={s} style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 12, color: T.muted }}>{SEV_WORD[s]}</span>
              <span style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: s === 'act' && open.some(u => u.severity === 'act') ? T.red : T.text }}>{open.filter(u => u.severity === s).length}</span>
            </div>
          ))}
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 12, color: T.muted }}>Money at stake</span>
            <span style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: T.text }}>{moneyL(sum(open))}</span>
          </div>
        </div>
      </section>

      <nav aria-label="Departments" className="xpl-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" aria-pressed={dept === 'all'} onClick={() => setDept('all')}
          style={{ ...chipBtn, border: `1px solid ${dept === 'all' ? tint(T.orange, 45) : T.border}`, background: dept === 'all' ? tint(T.orange, 12) : T.card, fontWeight: 600 }}>
          Everything <span style={{ fontSize: 12, color: T.muted }}>{inbox.open.length}</span>
        </button>
        {deptsWith.map(d => {
          const v = inbox.byDept[d.key]
          const on = dept === d.key
          return (
            <button key={d.key} type="button" aria-pressed={on} onClick={() => setDept(on ? 'all' : d.key)}
              style={{ ...chipBtn, border: `1px solid ${on ? tint(T.orange, 45) : T.border}`, background: on ? tint(T.orange, 12) : T.card }}>
              <span style={{ fontWeight: 600 }}>{d.label}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{v.open}</span>
              {v.act > 0 && <span aria-label={`${v.act} to act on now`} style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: T.red, borderRadius: 999, padding: '1px 8px' }}>{v.act} now</span>}
              {v.money > 0 && <span style={{ fontSize: 12, color: T.muted }}>{moneyL(v.money)}</span>}
            </button>
          )
        })}
      </nav>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div role="group" aria-label="Group by" style={{ display: 'inline-flex', gap: 3, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3 }}>
          {([['urgency', 'By urgency'], ['dept', 'By department'], ['place', 'By rig or project']] as [GroupBy, string][]).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={by === v} onClick={() => setBy(v)} style={{
              minHeight: 34, padding: '0 12px', border: 'none', borderRadius: 7, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
              background: by === v ? tint(T.orange, 14) : 'transparent', color: by === v ? T.text : T.muted, fontWeight: by === v ? 600 : 500,
            }}>{l}</button>
          ))}
        </div>
        {open.length > 0 && (
          <Link href={`/admin/inbox${dept === 'all' ? '' : `?dept=${dept}`}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 16px', borderRadius: 10, background: T.orange, color: '#fff', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>
            Go through all {open.length}, one by one<ArrowRight size={15} aria-hidden />
          </Link>
        )}
      </div>

      {fresh.length > 0 && (
        <section aria-label="New since yesterday" style={{ ...card, borderColor: tint(T.blue, 35) }}>
          <div style={{ padding: '10px 18px', background: tint(T.blue, 7), display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.text }}>New since yesterday · {fresh.length}</h2>
            <span style={{ fontSize: 12, color: T.muted }}>Also listed in its place below</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 18px 12px' }}>
            {fresh.map(u => (
              <a key={u.id} href={`#u-${encodeURIComponent(u.id)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: T.text, textDecoration: 'none', border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 10px' }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: T.blue }} />{u.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {open.length === 0 && (
        <section style={{ ...card, padding: '26px 24px', display: 'grid', gap: 8 }}>
          <h2 style={{ margin: 0, fontFamily: display, fontSize: 20, color: T.text }}>Nothing needs you{dept === 'all' ? '' : ` in ${deptLabel(dept)}`} right now</h2>
          <p style={{ margin: 0, color: T.muted, lineHeight: 1.55, fontSize: 13.5 }}>
            {inbox.units.length === 0 ? 'XPLORIX finds things once shifts are in the record. Each finding comes from your own logs, rates and stock.'
              : `${handled.length} answered${reminders.length ? `, ${reminders.length} waiting for their reminder date` : ''}. New findings appear here the moment the record shows them.`}
          </p>
        </section>
      )}

      {by === 'urgency' && (['act', 'plan', 'watch'] as Severity[]).map(s => {
        const list = open.filter(u => u.severity === s)
        if (!list.length) return null
        const groups = groupBy(list, u => u.dept)
        return (
          <section key={s} aria-label={SEV_WORD[s]} style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontFamily: display, fontSize: 19, color: T.text }}>{SEV_WORD[s]} · {list.length}</h2>
              <span style={{ fontSize: 13, color: T.muted }}>{SEV_NOTE[s]}</span>
            </div>
            {s === 'act'
              ? groups.map(([d, units]) => (
                <div key={d} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 18px', background: 'rgba(var(--x-ov),0.02)', borderBottom: `1px solid ${T.line}` }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{deptLabel(d)} · {units.length}</h3>
                    {sum(units) > 0 && <span style={{ fontSize: 12.5, color: T.muted }}>{moneyL(sum(units))}</span>}
                  </div>
                  {units.map((u, i) => <div key={u.id} id={`u-${encodeURIComponent(u.id)}`}><UnitCard u={u} first={i === 0} /></div>)}
                </div>
              ))
              : <div style={{ ...card }}>{groups.map(([d, units], gi) => (
                <div key={d} style={gi === 0 ? { marginTop: -1 } : undefined}>
                  <Fold title={deptLabel(d)} count={units.length} money={sum(units)} first={units[0].title}><List units={units} /></Fold>
                </div>
              ))}</div>}
          </section>
        )
      })}

      {by !== 'urgency' && open.length > 0 && (
        <div style={card}>
          {(by === 'dept' ? groupBy(open, u => deptLabel(u.dept)) : groupBy(open, placeOf))
            .sort((a, b) => b[1].filter(u => u.severity === 'act').length - a[1].filter(u => u.severity === 'act').length || b[1].length - a[1].length)
            .map(([k, units], gi) => (
              <div key={k} style={gi === 0 ? { marginTop: -1 } : undefined}>
                <Fold title={k} count={units.length} money={sum(units)} first={units[0].title} open={gi === 0}><List units={units} /></Fold>
              </div>
            ))}
        </div>
      )}

      {reminders.length > 0 && (
        <section aria-label="Reminders" style={card}>
          <Fold title="Reminders set" count={reminders.length} money={sum(reminders)} first={`Next back on ${dayWord(reminders.map(u => u.status?.until ?? '').sort()[0])}`}><List units={reminders} /></Fold>
        </section>
      )}

      <section aria-label="Answered" style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: T.muted }}>Answered: {handled.filter(u => u.state === 'done').length} done, {handled.filter(u => u.state === 'dismissed').length} set aside with a reason. Each keeps who answered it and when.</span>
        {handled.length > 0 && <button type="button" onClick={() => setShowHandled(v => !v)} style={{ ...chipBtn, border: `1px solid ${T.border}`, background: T.card, fontWeight: 600 }}>{showHandled ? 'Hide them' : `Show the ${handled.length}`}</button>}
      </section>
      {showHandled && handled.length > 0 && <div style={card}><List units={handled} /></div>}
    </div>
  )
}

/* The side panel: the morning in three lines, and where the money is. */
export function InboxSummary() {
  const inbox = useInbox()
  const act = inbox.open.filter(u => u.severity === 'act')
  const lines = groupBy(act, u => u.dept)
    .map(([d, units]) => ({ d, units, money: units.reduce((s, u) => s + (u.money ?? 0), 0) }))
    .sort((a, b) => b.money - a.money || b.units.length - a.units.length)
    .slice(0, 3)
  const money = DEPTS.map(d => ({ d, v: inbox.byDept[d.key].money })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)
  const top = Math.max(1, ...money.map(m => m.v))
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ background: 'var(--x-text)', color: 'var(--x-bg)', borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em' }}>YOUR MORNING IN THREE LINES</h2>
        {lines.length === 0
          ? <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>Nothing needs action now. Plan and watch items are below.</p>
          : lines.map(l => (
            <p key={l.d} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
              <b>{deptLabel(l.d)}:</b> {l.units.length} to act on{l.money ? `, ${moneyL(l.money)}` : ''}. First: {l.units[0].title.replace(/\.$/, '')}.
            </p>
          ))}
      </section>
      {money.length > 0 && (
        <section style={{ ...card, padding: '14px 18px', display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14, color: T.text }}>Where the money is</h2>
          {money.map(m => (
            <div key={m.d.key} style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.text }}><span>{m.d.label}</span><span style={{ fontWeight: 600 }}>{moneyL(m.v)}</span></div>
              <div aria-hidden style={{ height: 6, borderRadius: 999, background: 'rgba(var(--x-ov),0.07)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(m.v / top) * 100}%`, background: T.orange }} /></div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
