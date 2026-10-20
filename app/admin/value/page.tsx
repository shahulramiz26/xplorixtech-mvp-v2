'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Printer } from 'lucide-react'
import { useCosting, moneyL, money } from '../../../lib/costing-store'
import { useInventory, TODAY } from '../../../lib/inventory-store'
import { buildValue, VALUE_PERIODS, type ValueKind, type ValueLine } from '../../../lib/value'
import { useInbox } from '../../components/inbox'
import { deptLabel, type Dept } from '../../../lib/findings'
import { Page, PageHead, Card, Seg, Table, Empty, T, tint, display, th, thR, td, tdR, rowLine } from '../../components/kit'

/* ==========================================================================
 * VALUE — what has XPLORIX been worth to you?
 *
 * The owner's question after a month on XPLORIX, answered from his own
 * record (lib/value.ts). Proven money, money collected sooner, losses
 * avoided (estimated, with the working), and, beside them, what was found
 * and not acted on. Every proven line names the invoice, bill or transfer
 * that proves it. Built to be printed for the MD.
 * ========================================================================== */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthWord = (m?: string) => m ? `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}` : ''
const day = (d?: string) => d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}` : '—'
const deptName = (d: string) => { try { return deptLabel(d as Dept) } catch { return d } }

const COLOR: Record<ValueKind, string> = {
  proven: T.green, cash: T.blue, estimate: 'var(--x-faint)', pending: tint(T.blue, 55), open: T.red, waiting: T.blue, setaside: 'var(--x-muted)',
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'proven' | 'plain' | 'dashed' | 'open' }) {
  const style: React.CSSProperties = tone === 'proven'
    ? { background: 'color-mix(in srgb, var(--x-green) 82%, black)', color: '#fff', border: 'none' }
    : tone === 'open' ? { background: tint(T.red, 7), border: `1px solid ${tint(T.red, 30)}` }
    : tone === 'dashed' ? { background: T.card, border: `1px dashed ${T.border}` }
    : { background: T.card, border: `1px solid ${T.border}` }
  const sub = tone === 'proven' ? 'rgba(255,255,255,0.86)' : T.muted
  return (
    <div style={{ ...style, borderRadius: 16, padding: '16px 18px', display: 'grid', gap: 5, boxShadow: 'var(--x-card-shadow)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: tone === 'proven' ? '#fff' : tone === 'open' ? 'var(--x-bad-text)' : T.text }}>{label}</span>
      <span style={{ fontFamily: display, fontSize: 30, fontWeight: 700, color: tone === 'proven' ? '#fff' : tone === 'open' ? 'var(--x-bad-text)' : T.text, lineHeight: 1.1 }}>{value}</span>
      <span style={{ fontSize: 12.5, lineHeight: 1.45, color: sub }}>{note}</span>
    </div>
  )
}

export default function ValuePage() {
  const { state } = useCosting()
  const { state: inv } = useInventory()
  const inbox = useInbox()
  const periods = VALUE_PERIODS(TODAY)
  const [period, setPeriod] = useState('90')
  const from = periods.find(p => p.key === period)!.from
  const v = useMemo(() => buildValue(state, inv, inbox, from, TODAY), [state, inv, inbox, from])
  const of = (k: ValueKind) => v.lines.filter(l => l.kind === k)
  const counted = v.totals.proven + v.totals.pending + v.totals.estimate + v.totals.open
  const pct = (n: number) => `${counted ? (n / counted) * 100 : 0}%`
  const notActed = v.totals.open + v.totals.setaside
  const periodWord = periods.find(p => p.key === period)!.label.toLowerCase()

  return (
    <Page>
      <PageHead question="What has XPLORIX been worth to you?" tone={v.totals.proven > 0 ? 'good' : 'neutral'}
        answer={v.totals.proven + v.totals.estimate + v.totals.cash > 0
          ? <>In the {periodWord === 'since you started' ? 'time since you started' : periodWord}: <b style={{ color: T.text }}>{moneyL(v.totals.proven)} proven</b> in your record, {moneyL(v.totals.cash)} collected sooner, and {moneyL(v.totals.estimate)} of loss avoided by estimate. {moneyL(notActed)} of loss was found and is not acted on yet{v.totals.waiting ? <>, and {moneyL(v.totals.waiting)} you are owed or have not billed is waiting to come in</> : null}. Proven means an invoice, a bill or an order shows it. <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: tint(T.blue, 12), color: T.text }}>Demo data</span></>
          : <>Nothing proven in this period yet. A finding counts here once the record shows what came of it: an invoice paid, a bill cut, an order trimmed.</>}
        right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} className="xpl-noprint">
          <Seg value={period} onChange={setPeriod} options={periods.map(p => ({ value: p.key, label: p.label }))} />
          <button type="button" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 38, padding: '0 14px', borderRadius: 9, border: 'none', background: T.orange, color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            <Printer size={15} aria-hidden />Print for your MD
          </button>
        </div>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: 14 }}>
        <Tile tone="proven" label="Saved, proven" value={moneyL(v.totals.proven)} note={`${v.counts.proven} ${v.counts.proven === 1 ? 'finding' : 'findings'}, each in an invoice paid, a bill cut or an order trimmed`} />
        <Tile tone="plain" label="Cash in sooner" value={moneyL(v.totals.cash)} note={v.counts.cash ? `${v.counts.cash} overdue ${v.counts.cash === 1 ? 'invoice' : 'invoices'} paid after XPLORIX raised ${v.counts.cash === 1 ? 'it' : 'them'}. Your money anyway, only earlier` : 'No overdue invoice collected in this period'} />
        <Tile tone="dashed" label="Loss avoided, estimated" value={moneyL(v.totals.estimate)} note={v.counts.estimate ? 'A rig that did not stop for a part, at its own cost of a stopped day' : 'None in this period'} />
        <Tile tone="open" label="Found, not acted on" value={moneyL(notActed)} note={`${v.counts.open} still open with money on ${v.counts.open === 1 ? 'it' : 'them'}, ${v.counts.setaside} set aside with a reason`} />
      </div>

      {counted > 0 && (
        <Card title={`Of the ${moneyL(counted)} XPLORIX put a figure on`} subtitle="Cash in sooner is left out: it was your money anyway, only earlier.">
          <div aria-hidden style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden' }}>
            {(['proven', 'pending', 'estimate', 'open'] as ValueKind[]).map(k => <div key={k} style={{ width: pct(v.totals[k]), background: k === 'estimate' ? `repeating-linear-gradient(45deg, ${T.faint} 0 6px, color-mix(in srgb, var(--x-faint) 45%, transparent) 6px 12px)` : COLOR[k] }} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 10, fontSize: 13, color: T.text }}>
            {([['proven', 'proven'], ['pending', 'acted on, money not in yet'], ['estimate', 'loss avoided, estimated'], ['open', 'not acted on']] as [ValueKind, string][]).filter(([k]) => v.totals[k] > 0).map(([k, l]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: COLOR[k] }} /><b>{moneyL(v.totals[k])}</b> {l}</span>
            ))}
          </div>
        </Card>
      )}

      <Card title="Proven, one by one" subtitle="Each line names what in the record proves it." pad={false}>
        {of('proven').length === 0 ? <Empty>Nothing proven in this period yet.</Empty> : (<>
          <div className="xpl-narrow"><Stacked lines={of('proven')} total={v.totals.proven} /></div>
          <div className="xpl-wide"><Table>
            <thead><tr><th style={th}>What XPLORIX found</th><th style={th}>Who acted</th><th style={th}>What the record shows</th><th style={thR}>Saved</th></tr></thead>
            <tbody>{of('proven').map(l => <Row key={l.id} l={l} />)}</tbody>
            <tfoot><tr style={{ borderTop: `2px solid ${T.border}` }}><td style={{ ...td, fontWeight: 700, color: T.text }} colSpan={3}>Proven in total</td><td style={{ ...tdR, fontWeight: 800, color: 'var(--x-good-text)' }}>{money(v.totals.proven)}</td></tr></tfoot>
          </Table></div>
        </>)}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        <Card title="Cash, and loss avoided" subtitle="An estimate shows how it was worked out, so you can check it.">
          {of('cash').length + of('estimate').length === 0 ? <div style={{ fontSize: 13, color: T.muted }}>Nothing collected sooner or avoided in this period.</div> : (
            <div style={{ display: 'grid', gap: 14 }}>
              {[...of('cash'), ...of('estimate')].map(l => (
                <div key={l.id} style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 600, color: T.text, fontSize: 13.5 }}>
                    <span>{l.what}</span><span style={{ whiteSpace: 'nowrap' }}>{moneyL(l.money)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}><b style={{ color: T.text, fontWeight: 600 }}>{l.kind === 'cash' ? 'Cash in sooner' : 'Estimate'}.</b> Found {day(l.found)}, answered by {l.who}. {l.proof}.</div>
                  {l.method && <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>Worked out as {l.method}.</div>}
                </div>
              ))}
            </div>
          )}
          {of('waiting').length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: rowLine, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 700, color: T.text, fontSize: 13.5 }}>
                <span>Waiting to come in</span><span style={{ whiteSpace: 'nowrap' }}>{moneyL(v.totals.waiting)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>Your money, owed or not billed yet. It moves to cash in sooner when it is paid.</div>
              {of('waiting').map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  {l.href ? <Link href={l.href} style={{ color: T.text }}>{l.what}</Link> : <span style={{ color: T.text }}>{l.what}</span>}
                  <span style={{ color: T.muted, whiteSpace: 'nowrap' }}>{moneyL(l.money)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Found, not acted on" subtitle="Loss still open, or set aside with a reason." pad={false}>
          {of('open').length + of('setaside').length === 0 ? <Empty>Everything with money on it has been acted on.</Empty> : (
            <>
              {[...of('setaside'), ...of('open').slice(0, 8)].map((l, i) => (
                <div key={l.id} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '11px 18px', borderTop: i ? rowLine : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{l.what}</div>
                    <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{deptName(l.dept)} · {l.proof}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>{moneyL(l.money)}</span>
                </div>
              ))}
              {of('open').length > 8 && <div style={{ padding: '10px 18px', borderTop: rowLine, fontSize: 12.5, color: T.muted }}>and {of('open').length - 8} more: every one is in <Link href="/admin/tasks?dept=all" style={{ color: T.orange, fontWeight: 600 }}>Tasks</Link>.</div>}
            </>
          )}
        </Card>
      </div>

      {of('pending').length > 0 && (
        <Card title="Acted on, money not in yet" subtitle="Counted as proven the day the record shows it." pad={false}>
          <div className="xpl-narrow"><Stacked lines={of('pending')} /></div>
          <div className="xpl-wide"><Table>
            <thead><tr><th style={th}>What XPLORIX found</th><th style={th}>Who acted</th><th style={th}>Where it stands</th><th style={thR}>At stake</th></tr></thead>
            <tbody>{of('pending').map(l => <Row key={l.id} l={l} />)}</tbody>
          </Table></div>
        </Card>
      )}

      <Card title={`Before and after: ${monthWord(v.firstMonth)} against ${monthWord(v.lastMonth)}`} subtitle="The same measures, from the same record. Where a month has no figure, the nearest month that does is used and named.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
          {v.trends.map(t => {
            const both = t.before != null && t.after != null
            const delta = both ? (t.after as number) - (t.before as number) : 0
            // Under 2% either way is noise, not a change.
            const moved = both && Math.abs(delta) > Math.abs(t.before as number) * 0.02
            const better = moved ? (delta > 0) === t.goodWhenUp : null
            return (
              <div key={t.key} style={{ background: 'rgba(var(--x-ov),0.035)', borderRadius: 12, padding: '13px 14px', display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: T.muted, minHeight: 34 }}>{t.label}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, color: T.muted }}>{t.before != null ? t.fmt(t.before) : '—'}</span>
                  <span aria-hidden style={{ color: T.faint }}>→</span>
                  <span style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: T.text }}>{t.after != null ? t.fmt(t.after) : '—'}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: better === null ? T.muted : better ? 'var(--x-good-text)' : 'var(--x-bad-text)' }}>
                  {!both ? (t.before == null ? 'Not in the record yet' : `Only ${monthWord(t.beforeMonth)} so far: needs a second month`) : better === null ? 'No change' : better ? 'Better' : 'Worse'}
                  {both ? <span style={{ fontWeight: 400, color: T.faint }}> · {monthWord(t.beforeMonth)} → {monthWord(t.afterMonth)}</span> : null}
                </span>
                {t.note && <span style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.4 }}>{t.note}</span>}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="How this page counts">
        <ul style={{ margin: 0, paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.7 }}>
          <li><b style={{ color: T.text }}>Proven</b> only when the record shows the money: an invoice paid, a bill approved below the claim, a transfer instead of a purchase.</li>
          <li><b style={{ color: T.text }}>Cash in sooner</b> is money you were owed, collected after XPLORIX raised it. It is not counted as saved. Money still owed or not billed is shown as waiting, never as a loss.</li>
          <li><b style={{ color: T.text }}>Estimated</b> means the loss did not happen, so it cannot be proven. The working is shown and uses your own figures.</li>
          <li>A finding someone set aside stays here with the reason they gave. Nothing found is left out.</li>
        </ul>
      </Card>
    </Page>
  )
}

function Row({ l }: { l: ValueLine }) {
  return (
    <tr style={{ borderTop: rowLine, verticalAlign: 'top' }}>
      <td style={{ ...td, whiteSpace: 'normal', minWidth: 260 }}><div style={{ fontWeight: 600, color: T.text }}>{l.what}</div><div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{deptName(l.dept)}</div></td>
      <td style={td}>{l.who ?? '—'}</td>
      <td style={{ ...td, whiteSpace: 'normal', minWidth: 240 }}>{l.href ? <Link href={l.href} style={{ color: T.text, fontWeight: 600 }}>{l.proof}</Link> : l.proof}</td>
      <td style={{ ...tdR, fontWeight: 700, color: l.kind === 'proven' ? 'var(--x-good-text)' : T.text }}>{money(l.money)}</td>
    </tr>
  )
}

/* Phone: one finding per block, money beside the title, proof underneath. */
function Stacked({ lines, total }: { lines: ValueLine[]; total?: number }) {
  return (
    <div>
      {lines.map((l, i) => (
        <div key={l.id} style={{ padding: '12px 16px', borderTop: i ? rowLine : 'none', display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontWeight: 600, color: T.text, fontSize: 13.5 }}>{l.what}</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: l.kind === 'proven' ? 'var(--x-good-text)' : T.text }}>{moneyL(l.money)}</span>
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>{l.href ? <Link href={l.href} style={{ color: T.text, fontWeight: 600 }}>{l.proof}</Link> : l.proof}{l.who ? ` · ${l.who}` : ''}</div>
        </div>
      ))}
      {total != null && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: `2px solid ${T.border}`, fontWeight: 700, color: T.text }}><span>Proven in total</span><span style={{ color: 'var(--x-good-text)' }}>{money(total)}</span></div>}
    </div>
  )
}
