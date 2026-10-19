'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, UserRound, Clock, X, ArrowRight, RotateCcw, ShieldCheck } from 'lucide-react'
import { useCosting, ADMIN_NAME, nowStamp, moneyL, type FindingStatus } from '../../lib/costing-store'
import { useInventory, TODAY, addDays } from '../../lib/inventory-store'
import { buildInbox, type InboxResult, type InboxUnit } from '../../lib/inbox'
import { deptLabel, SEVERITY_LABEL, type Dept, type Severity } from '../../lib/findings'
import { T, tint, inputStyle, display } from './kit'

/* ==========================================================================
 * THE INBOX ON SCREEN
 *
 * One list, one design, everywhere. The Dashboard shows all of it; each
 * department's screen shows its share with <DeptInbox>. Every row has the
 * same four answers (Done, Hand to, Remind me, Not relevant) and they are
 * kept against the story, so it is answered once for every screen.
 * ========================================================================== */

const InboxCtx = createContext<InboxResult | null>(null)

/* Worked out once for the whole admin console (app/admin/layout.tsx). */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { state } = useCosting()
  const { state: inv } = useInventory()
  const inbox = useMemo(() => buildInbox(state, inv), [state, inv])
  return <InboxCtx.Provider value={inbox}>{children}</InboxCtx.Provider>
}

export function useInbox(): InboxResult {
  const ctx = useContext(InboxCtx)
  const { state } = useCosting()
  const { state: inv } = useInventory()
  // Only outside the admin console, where no provider is mounted.
  const own = useMemo(() => ctx ? null : buildInbox(state, inv), [ctx, state, inv])
  return (ctx ?? own) as InboxResult
}

export function useMark() {
  const { setFindingStatus } = useCosting()
  return (u: InboxUnit, st: Omit<FindingStatus, 'by' | 'at' | 'ids'> | null) =>
    setFindingStatus(u.id, st ? { ...st, by: ADMIN_NAME, at: nowStamp(), ids: u.items.map(f => f.id) } : null)
}

const SEV_STYLE: Record<Severity, { bg: string; fg: string }> = {
  act: { bg: T.red, fg: '#fff' },
  plan: { bg: tint(T.amber, 22), fg: 'var(--x-text)' },
  watch: { bg: 'rgba(var(--x-ov),0.07)', fg: 'var(--x-muted)' },
}
export function SevTag({ s }: { s: Severity }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', padding: '3px 7px', borderRadius: 6, background: SEV_STYLE[s].bg, color: SEV_STYLE[s].fg, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{SEVERITY_LABEL[s]}</span>
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dayWord = (d: string) => d === TODAY ? 'today' : d === addDays(TODAY, 1) ? 'tomorrow' : `${Number(d.slice(8))} ${MON[Number(d.slice(5, 7)) - 1]}`

const actBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 11px', borderRadius: 8,
  border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none',
}

/* One story or one finding, with its answers. */
export function UnitCard({ u, compact, first }: { u: InboxUnit; compact?: boolean; first?: boolean }) {
  const mark = useMark()
  const [mode, setMode] = useState<'none' | 'hand' | 'remind' | 'dismiss'>('none')
  const [text, setText] = useState('')
  const [date, setDate] = useState(addDays(TODAY, 1))
  const story = u.items.length > 1
  const closed = u.state === 'done' || u.state === 'dismissed'
  const due = u.due ? (u.due <= TODAY ? 'Due today' : `Due ${dayWord(u.due)}`) : undefined

  return (
    <article style={{ padding: compact ? '12px 16px' : '14px 18px', borderTop: first ? 'none' : `1px solid ${T.line}`, background: u.state === 'reminder' || closed ? 'rgba(var(--x-ov),0.015)' : undefined }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6, width: 92, flexShrink: 0, paddingTop: 1 }}>
          <SevTag s={u.severity} />
          <span style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.3 }}>{deptLabel(u.dept)}</span>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: compact ? 13.5 : 14.5, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{u.title}</h3>
            {u.isNew && !closed && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.blue, background: tint(T.blue, 12), borderRadius: 6, padding: '2px 6px' }}>NEW</span>}
          </div>
          {story
            ? <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>{u.items.length} findings about {u.about}, one story:</div>
            : !compact && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>{u.detail}</div>}
          {story && (
            <ol style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
              {u.items.map((f, i) => (
                <li key={f.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: T.text, lineHeight: 1.45 }}>
                  <span style={{ color: T.faint, fontWeight: 700, minWidth: 14 }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>{f.title}{f.money ? <span style={{ color: T.faint }}> · {moneyL(f.money)}</span> : null}</span>
                </li>
              ))}
            </ol>
          )}
          {!compact && u.action && <div style={{ fontSize: 12.5, color: T.text, marginTop: 6, lineHeight: 1.5 }}><span style={{ color: T.faint }}>What to do: </span>{u.action}</div>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.muted }}>
              <UserRound size={13} aria-hidden />{u.state === 'handed' ? `Handed to ${u.status?.to}` : u.owner}
            </span>
            {due && !closed && <span style={{ color: due === 'Due today' ? T.red : T.muted, fontWeight: due === 'Due today' ? 600 : 400 }}>{due}</span>}
            {u.state === 'reminder' && u.status?.until && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.blue, fontWeight: 600 }}><Clock size={13} aria-hidden />Back on {dayWord(u.status.until)}</span>}
            {closed && <span style={{ color: T.muted }}>{u.state === 'done' ? 'Done' : `Set aside: ${u.status?.note}`} · {u.status?.by}</span>}
          </div>
        </div>
        {u.money ? (
          <div style={{ textAlign: 'right', minWidth: 96 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: display }}>{moneyL(u.money)}</div>
            {u.moneyNote && <div style={{ fontSize: 11.5, color: T.faint }}>{u.moneyNote}</div>}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingLeft: 104 }} className="xpl-actions">
        {closed || u.state === 'reminder' ? (
          <button type="button" style={actBtn} onClick={() => mark(u, null)}><RotateCcw size={13} aria-hidden />{u.state === 'reminder' ? 'Bring back now' : 'Reopen'}</button>
        ) : mode === 'none' ? <>
          <button type="button" style={actBtn} onClick={() => mark(u, { status: 'done' })}><Check size={14} aria-hidden style={{ color: T.green }} />Done</button>
          <button type="button" style={actBtn} onClick={() => { setMode('hand'); setText(u.state === 'handed' ? u.status?.to ?? '' : '') }}><UserRound size={13} aria-hidden />Hand to…</button>
          <button type="button" style={actBtn} onClick={() => setMode('remind')}><Clock size={13} aria-hidden />Remind me…</button>
          <button type="button" style={{ ...actBtn, color: T.muted }} onClick={() => { setMode('dismiss'); setText('') }}><X size={13} aria-hidden />Not relevant</button>
          {u.href && <Link href={u.href} style={{ ...actBtn, background: tint(T.orange, 10), borderColor: tint(T.orange, 30), color: 'var(--x-text)' }}>Open<ArrowRight size={13} aria-hidden /></Link>}
        </> : mode === 'remind' ? <>
          {[{ l: 'Tomorrow', d: addDays(TODAY, 1) }, { l: 'In 3 days', d: addDays(TODAY, 3) }, { l: 'Next week', d: addDays(TODAY, 7) }].map(o => (
            <button key={o.l} type="button" style={actBtn} onClick={() => { mark(u, { status: 'snoozed', until: o.d }); setMode('none') }}>{o.l}</button>
          ))}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.muted }}>
            On <input type="date" min={addDays(TODAY, 1)} value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 150, padding: '6px 8px', fontSize: 12.5 }} />
          </label>
          <button type="button" style={actBtn} onClick={() => { mark(u, { status: 'snoozed', until: date }); setMode('none') }}>Set</button>
          <button type="button" style={{ ...actBtn, color: T.muted }} onClick={() => setMode('none')}>Cancel</button>
        </> : <>
          <label style={{ display: 'flex', flex: '1 1 260px', maxWidth: 380 }}>
            <span className="sr-only">{mode === 'hand' ? 'Who should do it' : 'Why it does not apply'}</span>
            <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={mode === 'hand' ? 'Who should do it? A name or a role' : 'Why it does not apply (kept with it)'}
              onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { mark(u, mode === 'hand' ? { status: 'assigned', to: text.trim() } : { status: 'dismissed', note: text.trim() }); setMode('none') } }}
              style={{ ...inputStyle, fontSize: 13, width: '100%' }} />
          </label>
          <button type="button" disabled={!text.trim()} style={{ ...actBtn, opacity: text.trim() ? 1 : 0.45 }}
            onClick={() => { mark(u, mode === 'hand' ? { status: 'assigned', to: text.trim() } : { status: 'dismissed', note: text.trim() }); setMode('none') }}>Save</button>
          <button type="button" style={{ ...actBtn, color: T.muted }} onClick={() => setMode('none')}>Cancel</button>
        </>}
      </div>
    </article>
  )
}

/* A department's share of the inbox, at the top of its own screen. */
export function DeptInbox({ depts, name, show = 5 }: { depts: Dept[]; name: string; show?: number }) {
  const inbox = useInbox()
  const [tag, setTag] = useState<string>('all')
  const [all, setAll] = useState(false)
  const mine = inbox.open.filter(u => u.depts.some(d => depts.includes(d)))
  const reminders = inbox.reminders.filter(u => u.depts.some(d => depts.includes(d)))
  const tags = Array.from(new Set(mine.flatMap(u => u.tags)))
  const shown = mine.filter(u => tag === 'all' || u.tags.includes(tag))
  const act = mine.filter(u => u.severity === 'act').length
  const list = all ? shown : shown.slice(0, show)
  const review = `/admin/inbox?dept=${depts.join(',')}`

  return (
    <section aria-label={`To act on in ${name}`} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--x-card-shadow)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${T.line}` }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>To act on in {name} · {mine.length}{act ? <span style={{ color: T.red }}> · {act} now</span> : null}</h2>
          <span style={{ fontSize: 12, color: T.faint }}>The Dashboard&apos;s list, for {name}. Answer one here and it is answered on the Dashboard too.{reminders.length ? ` ${reminders.length} waiting for a reminder date.` : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tags.length > 1 && ['all', ...tags].map(t => {
            const n = t === 'all' ? mine.length : mine.filter(u => u.tags.includes(t)).length
            const on = tag === t
            return <button key={t} type="button" aria-pressed={on} onClick={() => setTag(t)} style={{ ...actBtn, minHeight: 32, background: on ? tint(T.orange, 14) : T.card, borderColor: on ? tint(T.orange, 40) : T.border }}>{t === 'all' ? 'All' : t} · {n}</button>
          })}
          {mine.length > 0 && <Link href={review} style={{ ...actBtn, minHeight: 32 }}>One by one<ArrowRight size={13} aria-hidden /></Link>}
        </div>
      </div>
      {mine.length === 0
        ? <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '16px 18px', fontSize: 13, color: T.muted }}><ShieldCheck size={16} aria-hidden style={{ color: T.green }} />Nothing open for {name}. New findings appear here the moment the record shows them.</div>
        : list.map((u, i) => <UnitCard key={u.id} u={u} compact first={i === 0} />)}
      {shown.length > show && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: `1px solid ${T.line}`, background: 'rgba(var(--x-ov),0.015)', fontSize: 12.5, color: T.muted }}>
          <span>{all ? `All ${shown.length} shown.` : `Showing ${list.length} of ${shown.length}, most urgent first. None is hidden: open the rest here.`}</span>
          <button type="button" style={actBtn} onClick={() => setAll(a => !a)}>{all ? 'Show fewer' : `Show all ${shown.length}`}</button>
        </div>
      )}
    </section>
  )
}
