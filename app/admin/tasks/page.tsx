'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowRight, X } from 'lucide-react'
import { moneyL } from '../../../lib/costing-store'
import { TODAY, addDays } from '../../../lib/inventory-store'
import { DEPTS, deptLabel, type Dept } from '../../../lib/findings'
import { placeTasks, DEPT_COLOR, type TaskItem } from '../../../lib/tasks'
import { useInbox, UnitActions } from '../../components/inbox'
import { Page, T, tint, display, useEscape } from '../../components/kit'

/* ==========================================================================
 * TASKS — every notification on the day it is due
 *
 * Opens by asking which department, or all of them. All of them: each
 * department has its own colour. One department: its own tasks only, one
 * colour, nothing to tell apart. Week, month or a plain list. A task opens
 * to its detail and three answers: Done, Move to another day, Not relevant.
 * ========================================================================== */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dnum = (d: string) => Number(d.slice(8, 10))
const dword = (d: string) => `${dnum(d)} ${MON[Number(d.slice(5, 7)) - 1]}`
const weekday = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7   // Monday 0
const mondayOf = (d: string) => addDays(d, -weekday(d))
type View = 'week' | 'month' | 'list'

export default function TasksRoute() {
  return <Suspense fallback={null}><Tasks /></Suspense>
}

function Tasks() {
  const router = useRouter()
  const params = useSearchParams()
  const inbox = useInbox()
  const deptParam = params.get('dept')
  /* One department, or a department screen's own set ("operations,geology"),
   * which shows in the first one's colour. */
  const group = (deptParam ?? '').split(',').filter(k => DEPTS.some(d => d.key === k)) as Dept[]
  const dept = (deptParam === 'all' ? 'all' : group[0] ?? null) as 'all' | Dept | null
  const inGroup = (ds: Dept[]) => dept === 'all' || ds.some(d => (group.length ? group : [dept as Dept]).includes(d))
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(TODAY)
  const [openId, setOpenId] = useState<string | null>(null)

  const all = useMemo(() => placeTasks(inbox.open, inbox.reminders, TODAY), [inbox.open, inbox.reminders])
  const counts = useMemo(() => {
    const m: Record<string, { n: number; today: number }> = {}
    all.forEach(t => t.u.depts.forEach(d => { const e = (m[d] ||= { n: 0, today: 0 }); e.n++; if (t.date <= TODAY) e.today++ }))
    return m
  }, [all])
  const pick = (d: 'all' | Dept) => router.push(`/admin/tasks?dept=${d}`)

  /* First, which department. */
  if (!dept) {
    const todayAll = all.filter(t => t.date <= TODAY).length
    return (
      <Page>
        <div>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 26, fontWeight: 700, color: T.text }}>Tasks</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: T.muted }}>Whose tasks do you want to see?</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: 12 }}>
          <DeptCard color={T.orange} title="All departments" sub="Each department in its own colour" n={all.length} today={todayAll} onClick={() => pick('all')} big />
          {DEPTS.filter(d => counts[d.key]?.n).map(d => (
            <DeptCard key={d.key} color={DEPT_COLOR[d.key]} title={d.label} sub={`For ${d.owner}`} n={counts[d.key].n} today={counts[d.key].today} onClick={() => pick(d.key)} />
          ))}
        </div>
      </Page>
    )
  }

  const mine = all.filter(t => inGroup(t.u.depts))
  const colorOf = (t: TaskItem) => dept === 'all' ? DEPT_COLOR[t.u.dept] ?? T.orange : DEPT_COLOR[dept] ?? T.orange
  const open = mine.find(t => t.u.id === openId) ?? null
  // The week runs from the chosen day for seven days, so today is always first and nothing past is in the way.
  const start = view === 'week' ? anchor : mondayOf(`${anchor.slice(0, 7)}-01`)
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) => addDays(start, i))
  const on = (d: string) => mine.filter(t => t.date === d)
  const late = mine.filter(t => t.when === 'late').length
  const title = view === 'month' ? `${MON[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}` : `${dword(days[0])} – ${dword(days[6])}`
  const step = (k: number) => setAnchor(view === 'month' ? (() => { const d = new Date(`${anchor.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 10) })() : addDays(anchor, 7 * k))

  return (
    <Page>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 26, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            {dept !== 'all' && <span aria-hidden style={{ width: 12, height: 12, borderRadius: 4, background: DEPT_COLOR[dept] }} />}
            Tasks · {dept === 'all' ? 'All departments' : group.map(d => deptLabel(d)).join(' and ')}
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: 13.5, color: T.muted }}>
            {mine.filter(t => t.date <= TODAY).length} for today{late ? `, ${late} of them late` : ''} · {mine.length} in all. A dashed task has no date in the record; XPLORIX suggests the day.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="Department" value={dept} onChange={e => pick(e.target.value as 'all' | Dept)} style={{ minHeight: 38, padding: '0 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontFamily: 'inherit', fontSize: 13 }}>
            <option value="all">All departments · {all.length}</option>
            {DEPTS.filter(d => counts[d.key]?.n).map(d => <option key={d.key} value={d.key}>{d.label} · {counts[d.key].n}</option>)}
          </select>
          <div role="tablist" aria-label="View" style={{ display: 'inline-flex', gap: 3, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3 }}>
            {(['week', 'month', 'list'] as View[]).map(v => (
              <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => setView(v)} style={{ minHeight: 32, padding: '0 12px', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: view === v ? tint(T.orange, 14) : 'transparent', color: view === v ? T.text : T.muted, fontWeight: view === v ? 700 : 500, textTransform: 'capitalize' }}>{v}</button>
            ))}
          </div>
          <Link href={`/admin/inbox${dept === 'all' ? '' : `?dept=${group.join(',')}`}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 13px', borderRadius: 9, background: T.orange, color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>One by one<ArrowRight size={14} aria-hidden /></Link>
        </div>
      </div>

      {dept === 'all' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12.5, color: T.muted }}>
          {DEPTS.filter(d => counts[d.key]?.n).map(d => <span key={d.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: DEPT_COLOR[d.key] }} />{d.label}</span>)}
        </div>
      )}

      {view !== 'list' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" aria-label="Back" onClick={() => step(-1)} style={navBtn}><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setAnchor(TODAY)} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 13, fontWeight: 600 }}>Today</button>
          <button type="button" aria-label="Forward" onClick={() => step(1)} style={navBtn}><ChevronRight size={16} /></button>
          <span style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: T.text, marginLeft: 6 }}>{title}</span>
        </div>
      )}

      {view === 'week' && (
        <div className="xpl-week" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
          {days.map(d => <DayCol key={d} d={d} items={on(d)} colorOf={colorOf} onOpen={setOpenId} />)}
        </div>
      )}

      {view === 'month' && (
        <div className="xpl-month" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${T.line}` }}>
            {WD.map(w => <div key={w} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: T.muted }}>{w}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {days.map((d, i) => {
              const items = on(d)
              const other = d.slice(0, 7) !== anchor.slice(0, 7)
              return (
                <div key={d} style={{ minHeight: 108, padding: 6, borderTop: i >= 7 ? `1px solid ${T.line}` : 'none', borderLeft: i % 7 ? `1px solid ${T.line}` : 'none', background: d === TODAY ? tint(T.orange, 6) : other ? 'rgba(var(--x-ov),0.02)' : undefined, display: 'grid', alignContent: 'start', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: d === TODAY ? 800 : 600, color: d === TODAY ? T.orange : other ? T.faint : T.text }}>{dnum(d)}</span>
                  {items.slice(0, 3).map(t => <Chip key={t.u.id} t={t} color={colorOf(t)} onOpen={setOpenId} small />)}
                  {items.length > 3 && <button type="button" onClick={() => { setAnchor(d); setView('week') }} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: T.orange, cursor: 'pointer', fontFamily: 'inherit' }}>+{items.length - 3} more</button>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {Array.from(new Set(mine.map(t => t.date))).sort().map(d => (
            <section key={d} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: d === TODAY ? T.orange : T.text, borderBottom: `1px solid ${T.line}`, background: 'rgba(var(--x-ov),0.025)' }}>
                {d === TODAY ? 'Today' : `${WD[weekday(d)]} ${dword(d)}`} · {on(d).length}
              </div>
              <div style={{ padding: 8, display: 'grid', gap: 6 }}>{on(d).map(t => <Chip key={t.u.id} t={t} color={colorOf(t)} onOpen={setOpenId} />)}</div>
            </section>
          ))}
        </div>
      )}

      {open && <TaskPanel t={open} color={colorOf(open)} onClose={() => setOpenId(null)} />}
    </Page>
  )
}

const navBtn: React.CSSProperties = { width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: `1px solid ${T.border}`, background: T.card, color: T.text, cursor: 'pointer', fontFamily: 'inherit' }

function DeptCard({ color, title, sub, n, today, onClick, big }: { color: string; title: string; sub: string; n: number; today: number; onClick: () => void; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="xpl-row" style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'grid', gap: 6, padding: '16px 18px', borderRadius: 14, background: big ? tint(color, 8) : T.card, border: `1px solid ${big ? tint(color, 35) : T.border}`, borderLeft: `5px solid ${color}`, boxShadow: 'var(--x-card-shadow)' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</span>
      <span style={{ fontSize: 12.5, color: T.muted }}>{sub}</span>
      <span style={{ fontSize: 13, color: T.text, marginTop: 4 }}><b>{n}</b> tasks{today ? <> · <b style={{ color: 'var(--x-bad-text)' }}>{today} today</b></> : null}</span>
    </button>
  )
}

function DayCol({ d, items, colorOf, onOpen }: { d: string; items: TaskItem[]; colorOf: (t: TaskItem) => string; onOpen: (id: string) => void }) {
  const isToday = d === TODAY
  return (
    <section aria-label={`${WD[weekday(d)]} ${dword(d)}`} style={{ background: isToday ? tint(T.orange, 5) : T.card, border: `1px solid ${isToday ? tint(T.orange, 40) : T.border}`, borderRadius: 12, minHeight: 220, display: 'grid', alignContent: 'start', gap: 6, padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 4px 4px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: isToday ? T.orange : T.muted }}>{WD[weekday(d)]}</span>
        <span style={{ fontFamily: display, fontSize: 18, fontWeight: 700, color: isToday ? T.orange : T.text }}>{dnum(d)}</span>
      </div>
      {items.length === 0 ? <span style={{ fontSize: 12, color: T.faint, padding: '0 4px' }}>Nothing</span> : items.map(t => <Chip key={t.u.id} t={t} color={colorOf(t)} onOpen={onOpen} />)}
    </section>
  )
}

function Chip({ t, color, onOpen, small }: { t: TaskItem; color: string; onOpen: (id: string) => void; small?: boolean }) {
  const dashed = t.when === 'suggested'
  return (
    <button type="button" onClick={() => onOpen(t.u.id)} title={t.u.title}
      style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'grid', gap: 2, padding: small ? '4px 6px' : '7px 8px', borderRadius: 8, border: `1px ${dashed ? 'dashed' : 'solid'} ${tint(color, 45)}`, borderLeft: `4px solid ${color}`, background: tint(color, 8), minWidth: 0 }}>
      <span style={{ fontSize: small ? 11.5 : 12.5, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: small ? 'nowrap' : 'normal', display: small ? 'block' : '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.u.title}</span>
      {!small && <span style={{ fontSize: 11, color: t.when === 'late' ? 'var(--x-bad-text)' : T.faint, fontWeight: t.when === 'late' ? 700 : 400 }}>
        {t.when === 'late' ? `Late since ${dword(t.lateFrom!)}` : t.when === 'moved' ? 'Moved here' : t.when === 'due' ? 'Due' : 'Suggested'}{t.u.money ? ` · ${moneyL(t.u.money)}` : ''}
      </span>}
    </button>
  )
}

function TaskPanel({ t, color, onClose }: { t: TaskItem; color: string; onClose: () => void }) {
  useEscape(onClose)
  // Once it is answered or moved, the panel has done its job.
  const was = useRef(`${t.date}|${t.u.state}`)
  useEffect(() => { if (`${t.date}|${t.u.state}` !== was.current) onClose() }, [t.date, t.u.state, onClose])
  const u = t.u
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(var(--x-shadow),0.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside role="dialog" aria-modal aria-label={u.title} onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 100%)', height: '100%', overflowY: 'auto', background: T.card, borderLeft: `5px solid ${color}`, padding: '18px 20px', display: 'grid', alignContent: 'start', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{deptLabel(u.dept).toUpperCase()}</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 0 }}><X size={18} /></button>
        </div>
        <h2 style={{ margin: 0, fontFamily: display, fontSize: 19, color: T.text, lineHeight: 1.3 }}>{u.title}</h2>
        <div style={{ fontSize: 12.5, color: t.when === 'late' ? 'var(--x-bad-text)' : T.muted, fontWeight: t.when === 'late' ? 700 : 400 }}>
          {t.when === 'late' ? `Was due ${dword(t.lateFrom!)}, still open` : t.when === 'due' ? `Due ${t.date === TODAY ? 'today' : dword(t.date)}` : t.when === 'moved' ? `Moved to ${dword(t.date)}` : `No date in the record. XPLORIX suggests ${t.date === TODAY ? 'today' : dword(t.date)}.`}
          {u.money ? ` · ${moneyL(u.money)}${u.moneyNote ? ` ${u.moneyNote}` : ''}` : ''}
        </div>
        {u.items.length > 1 ? (
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 13.5, color: T.text, lineHeight: 1.5 }}>{u.items.map(f => <li key={f.id}>{f.title}</li>)}</ol>
        ) : <p style={{ margin: 0, fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>{u.detail}</p>}
        {u.action && <p style={{ margin: 0, fontSize: 13.5, color: T.text, lineHeight: 1.6 }}><b>What to do: </b>{u.action}</p>}
        <div style={{ paddingTop: 6 }}><UnitActions u={u} moveWord="Move to…" /></div>
      </aside>
    </div>
  )
}
