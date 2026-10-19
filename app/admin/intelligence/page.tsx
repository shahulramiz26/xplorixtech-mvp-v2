'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, UserRound, X, RotateCcw } from 'lucide-react'
import { useCosting, ADMIN_NAME, nowStamp, moneyL, money, type FindingStatus } from '../../../lib/costing-store'
import { useInventory, TODAY } from '../../../lib/inventory-store'
import { buildFindings, fleetTable, DEPTS, deptLabel, SEVERITY_LABEL, type Dept, type Finding, type Severity } from '../../../lib/findings'
import {
  T, tint, Page, PageHead, Card, Tile, Grid, Status, Table, Empty, inputStyle,
  th, thR, td, tdR, tdStrong, rowLine, type Tone,
} from '../../components/kit'
import { IntelTabs, n0, n1 } from './shared'

/* ==========================================================================
 * XPLORIX INTELLIGENCE — TODAY
 *
 * The one screen a 40-rig contractor opens first: everything the record says
 * needs doing, across every department, most urgent first. Each line says
 * what is wrong, the figures behind it, what to do, who should do it, by when
 * and what is at stake. Mark it done, hand it to someone, or say why it does
 * not apply; the record keeps who did what.
 *
 * Below it, the whole fleet ranked by what each metre leaves, so the rigs
 * losing money are on the first screen, not in a month-end report.
 * ========================================================================== */

const sevTone: Record<Severity, Tone> = { act: 'bad', plan: 'warn', watch: 'neutral' }
const SEVS: Severity[] = ['act', 'plan', 'watch']

export default function IntelligenceToday() {
  const { state, setFindingStatus } = useCosting()
  const { state: inv } = useInventory()
  const { findings, audits, forecast } = useMemo(() => buildFindings(state, inv), [state, inv])
  const fleet = useMemo(() => fleetTable(state, inv), [state, inv])
  const [dept, setDept] = useState<'all' | Dept>('all')
  const [showHandled, setShowHandled] = useState(false)
  const status = state.findingStatus ?? {}

  const open = findings.filter(f => !status[f.id] || status[f.id].status === 'assigned')
  const handled = findings.filter(f => status[f.id] && status[f.id].status !== 'assigned')
  const shown = open.filter(f => dept === 'all' || f.dept === dept)
  const act = open.filter(f => f.severity === 'act')
  const atStake = open.reduce((s, f) => s + (f.money ?? 0), 0)
  const clean = audits.filter(a => a.checks.length === 0).length
  const cleanPct = audits.length ? Math.round((clean / audits.length) * 100) : 100
  const idleNext = forecast.rigs.reduce((s, r) => s + r.next.idleDays, 0)
  const counts = (d: Dept) => open.filter(f => f.dept === d).length

  const mark = (f: Finding, st: FindingStatus | null) => setFindingStatus(f.id, st)

  return (
    <Page>
      <IntelTabs />
      <PageHead question="What needs doing today, and by whom?" tone={act.length ? 'bad' : open.length ? 'warn' : 'good'}
        answer={open.length === 0 ? 'Nothing in the record needs action today.' : <>
          {open.length} things across {new Set(open.map(f => f.dept)).size} departments, with {moneyL(atStake)} at stake.{' '}
          <b style={{ color: T.text }}>{act.length} need action now.</b>{' '}
          {act[0] ? <>First: {act[0].title.replace(/\.$/, '')}.</> : null}
        </>} />

      <Grid min={175}>
        <Tile label="Act now" value={act.length} tone={act.length ? 'bad' : 'good'} note="Today, before anything else" />
        <Tile label="Plan for it" value={open.filter(f => f.severity === 'plan').length} tone="warn" note="This week" />
        <Tile label="Money at stake" value={moneyL(atStake)} note="Where it can be put in money" />
        <Tile label="Drill logs that pass every check" value={`${cleanPct}%`} tone={cleanPct >= 90 ? 'good' : cleanPct >= 70 ? 'warn' : 'bad'}
          note={<Link href="/admin/intelligence/drill-logs" style={{ color: T.orange, textDecoration: 'none', fontWeight: 600 }}>{audits.length - clean} of {audits.length} shifts to look at →</Link>} />
        <Tile label="Idle rig-days next month" value={idleNext} tone={idleNext ? 'warn' : 'good'} note={idleNext ? 'No planned hole for them' : 'Every rig has holes planned'} />
      </Grid>

      {/* departments */}
      <div role="tablist" aria-label="Department" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <DeptChip on={dept === 'all'} onClick={() => setDept('all')} label="All departments" n={open.length} />
        {DEPTS.map(d => <DeptChip key={d.key} on={dept === d.key} onClick={() => setDept(d.key)} label={d.label} n={counts(d.key)} />)}
      </div>

      <Card title={dept === 'all' ? 'What to do, most urgent first' : deptLabel(dept)} pad={false}
        subtitle="Every line is found in your own record: shift logs, maintenance, stock, bills and the forecast. Nothing is typed in.">
        {shown.length === 0 ? <Empty>Nothing open here.</Empty> : SEVS.map(sev => {
          const list = shown.filter(f => f.severity === sev)
          if (!list.length) return null
          return (
            <div key={sev}>
              <div style={{ padding: '10px 18px', background: 'rgba(var(--x-ov),0.03)', borderTop: rowLine, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.faint }}>
                {SEVERITY_LABEL[sev]} · {list.length}
              </div>
              {list.map(f => <FindingRow key={f.id} f={f} st={status[f.id]} onMark={st => mark(f, st)} />)}
            </div>
          )
        })}
      </Card>

      {handled.length > 0 && (
        <Card title={`Handled · ${handled.length}`} subtitle="Done, or marked not relevant. They come back on their own if the record changes." pad={false}
          right={<button type="button" onClick={() => setShowHandled(v => !v)} style={linkBtn}>{showHandled ? 'Hide' : 'Show'}</button>}>
          {showHandled && handled.map(f => {
            const st = status[f.id]
            return (
              <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 18px', borderTop: rowLine }}>
                <Status tone={st.status === 'done' ? 'good' : 'neutral'}>{st.status === 'done' ? 'Done' : 'Not relevant'}</Status>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: T.text }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{st.by} · {st.at.replace('T', ' ')}{st.note ? ` · “${st.note}”` : ''}</div>
                </div>
                <button type="button" onClick={() => mark(f, null)} style={linkBtn}><RotateCcw size={13} /> Reopen</button>
              </div>
            )
          })}
        </Card>
      )}

      <Card title="The fleet, rig by rig" pad={false}
        subtitle="Ranked by what each metre leaves you after its cost, since the start. A rig losing money is at the bottom, in red.">
        <Table>
          <thead><tr>
            <th style={th}>Rig</th><th style={th}>Whose</th><th style={thR}>Metres</th><th style={thR}>Metres a rig-day</th>
            <th style={thR}>Core</th><th style={thR}>Availability</th><th style={thR}>Costs you / m</th><th style={thR}>Leaves you / m</th>
            <th style={thR}>Idle days next month</th><th style={thR}>Open findings</th>
          </tr></thead>
          <tbody>
            {fleet.map(r => {
              const idle = forecast.rigs.find(x => x.rig === r.name)?.next.idleDays ?? 0
              const mine = open.filter(f => f.rig === r.name || f.title.startsWith(`${r.name}:`) || f.title.startsWith(`${r.name} `)).length
              return (
                <tr key={r.key} style={{ borderTop: rowLine }}>
                  <td style={tdStrong}>{r.name}</td>
                  <td style={td}>{r.party}</td>
                  <td style={tdR}>{n0(r.metres)}</td>
                  <td style={tdR}>{n1(r.perRigDay)}</td>
                  <td style={{ ...tdR, color: r.recoveryPct < 90 ? T.red : T.muted }}>{r.recoveryPct.toFixed(1)}%</td>
                  <td style={tdR}>{r.availabilityPct.toFixed(1)}%</td>
                  <td style={tdR}>{money(r.costPerMetre)}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: r.marginPerMetre < 0 ? T.red : T.text }}>{money(r.marginPerMetre)}</td>
                  <td style={{ ...tdR, color: idle ? T.amber : T.faint }}>{idle || '—'}</td>
                  <td style={tdR}>{mine || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <p style={{ fontSize: 12.5, color: T.faint, lineHeight: 1.6, margin: 0 }}>
        Worked out on {TODAY} from your own record. Each finding is a rule applied to your shift logs, maintenance, stock, bills and forecast; open it to see the figures behind it.
        Not a trained model: an AI layer that explains causes and drafts the actions comes later, reading these same findings.
      </p>
    </Page>
  )
}

const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: T.orange, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }

function DeptChip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      color: on ? T.text : n ? T.muted : T.faint, background: on ? tint(T.orange, 12) : T.card, border: `1px solid ${on ? tint(T.orange, 45) : T.border}`,
    }}>
      {label}
      <span style={{ minWidth: 18, padding: '0 5px', borderRadius: 9, fontSize: 11, lineHeight: '18px', textAlign: 'center', background: n ? tint(T.orange, 18) : 'rgba(var(--x-ov),0.06)', color: n ? T.text : T.faint }}>{n}</span>
    </button>
  )
}

function FindingRow({ f, st, onMark }: { f: Finding; st?: FindingStatus; onMark: (st: FindingStatus | null) => void }) {
  const [mode, setMode] = useState<'none' | 'assign' | 'dismiss'>('none')
  const [text, setText] = useState('')
  const stamp = () => ({ by: ADMIN_NAME, at: nowStamp() })
  const due = f.due ? (f.due <= TODAY ? 'Today' : f.due) : undefined
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 18px', borderTop: rowLine, alignItems: 'flex-start' }}>
      <div style={{ width: 96, flexShrink: 0, display: 'grid', gap: 6, paddingTop: 1 }}>
        <Status tone={sevTone[f.severity]}>{SEVERITY_LABEL[f.severity]}</Status>
        <span style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.35 }}>{deptLabel(f.dept)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{f.title}</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>{f.detail}</div>
        {f.action && <div style={{ fontSize: 12.5, color: T.text, marginTop: 5, lineHeight: 1.5 }}><span style={{ color: T.faint }}>What to do: </span>{f.action}</div>}
        {f.evidence && f.evidence.length > 1 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
            {f.evidence.map(e => <span key={e} style={{ fontSize: 11.5, padding: '2px 7px', borderRadius: 6, background: 'rgba(var(--x-ov),0.05)', color: T.muted }}>{e}</span>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 9, fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.muted }}><UserRound size={13} />{st?.status === 'assigned' ? `Handed to ${st.to}` : f.owner}</span>
          {due && <span style={{ color: due === 'Today' ? T.red : T.muted }}>Due {due}</span>}
          {f.money != null && f.money > 0 && <span style={{ color: T.text, fontWeight: 600 }}>{moneyL(f.money)}{f.moneyNote ? <span style={{ color: T.faint, fontWeight: 400 }}> {f.moneyNote}</span> : null}</span>}
          <span style={{ flex: 1 }} />
          {mode === 'none' && <>
            <button type="button" onClick={() => onMark({ status: 'done', ...stamp() })} style={linkBtn}><Check size={13} /> Done</button>
            <button type="button" onClick={() => { setMode('assign'); setText('') }} style={linkBtn}>Hand to…</button>
            <button type="button" onClick={() => { setMode('dismiss'); setText('') }} style={{ ...linkBtn, color: T.faint }}><X size={13} /> Not relevant</button>
            {f.href && <Link href={f.href} style={{ ...linkBtn, textDecoration: 'none' }}>Open <ArrowRight size={13} /></Link>}
          </>}
        </div>
        {mode !== 'none' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 9, alignItems: 'center' }}>
            <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={mode === 'assign' ? 'Who should do it? (name or role)' : 'Why it does not apply'}
              style={{ ...inputStyle, fontSize: 13, maxWidth: 360 }} />
            <button type="button" disabled={!text.trim()} onClick={() => {
              onMark(mode === 'assign' ? { status: 'assigned', to: text.trim(), ...stamp() } : { status: 'dismissed', note: text.trim(), ...stamp() })
              setMode('none')
            }} style={{ ...linkBtn, opacity: text.trim() ? 1 : 0.4 }}>Save</button>
            <button type="button" onClick={() => setMode('none')} style={{ ...linkBtn, color: T.faint }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
