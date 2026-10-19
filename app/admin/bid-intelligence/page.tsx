'use client'

import { useState, useMemo, Fragment, ReactNode } from 'react'
import {
  useBids, computeBid, sectionStates, SECTIONS, blankBid, effectiveHours,
  METHODS, HOLE_SIZES, HARDNESS, ABRASIVENESS, FRACTURING, GROUND,
  SEED_CREW, RIG_WEIGHTS, BID_STATUSES, BID_STATUS_LABEL,
  SOURCE_LABEL, SOURCE_SHORT, SOURCE_CONFIDENCE,
  C, CONFIDENCE_TONE, SOURCE_TONE, HARDNESS_TONE, STATUS_TONE,
  money, moneyL, perMetre, pct, signed, fullDate, daysUntil, uid,
  type Bid, type BidResult, type SectionKey, type SectionState, type GeoBand,
  type Hardness, type Level4, type GroundCondition, type Source, type Method,
  type BidStatus, type PricingMethod,
} from '../../../lib/bid-store'
import { useInventory, stockInStore, TODAY } from '../../../lib/inventory-store'
import { useCosting } from '../../../lib/costing-store'
import { hexA } from '../../../lib/theme'
import Link from 'next/link'
import { buildRateBook, priceTender } from '../../../lib/own-rates'
import type { Formation } from '../../../lib/inventory-store'

/* ==========================================================================
 * XPLORIX BID INTELLIGENCE
 *
 * A contractor who has never priced a tender opens this and is walked through
 * the same arithmetic an experienced estimator does in a spreadsheet — except
 * every number shows its working, and every assumption shows where it came
 * from and how much to trust it.
 *
 * Sections rather than wizard steps, because estimating is not linear. You
 * find out the rig answer, then go back and change the shift pattern.
 * ========================================================================== */

const iStyle: React.CSSProperties = {
  padding: '6px 10px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, color: C.text, fontSize: 12.5, outline: 'none', fontFamily: 'inherit', width: '100%',
}
const numStyle: React.CSSProperties = { ...iStyle, textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }
const th: React.CSSProperties = {
  padding: '7px 12px', textAlign: 'left', fontSize: 10, color: C.faint, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
  borderBottom: `1px solid ${C.border}`, background: 'rgba(var(--x-ov),0.02)',
}
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '7px 12px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }
const tdN: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }
const tdMono: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, monospace' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const rowBorder = '1px solid color-mix(in srgb, var(--x-border) 50%, transparent)'

/* ── primitives ─────────────────────────────────────────────────────────── */

function Card({ title, subtitle, right, children, pad = true, accent }: {
  title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; pad?: boolean; accent?: string
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      {title && (
        <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: C.faint, marginTop: 3, maxWidth: 760, lineHeight: 1.55 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </div>
  )
}

function Stat({ label, value, note, color = C.text, big }: { label: string; value: string; note?: string; color?: string; big?: boolean }) {
  return (
    <div style={{ padding: '12px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 17, fontWeight: 900, color, fontFamily: 'ui-monospace, monospace', lineHeight: 1.15 }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: C.faint, marginTop: 5, lineHeight: 1.5 }}>{note}</div>}
    </div>
  )
}

function Tag({ children, tone = C.faint }: { children: ReactNode; tone?: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 5, color: tone, background: `${hexA(tone, 0x1A)}`, border: `1px solid ${hexA(tone, 0x33)}`, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function Btn({ children, onClick, tone = 'ghost', disabled, size = 'md' }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; size?: 'sm' | 'md' }) {
  const tones: Record<string, React.CSSProperties> = {
    primary: { background: `linear-gradient(135deg, ${C.orange}, ${C.orangeD})`, color: '#fff', border: 'none' },
    ghost: { background: 'rgba(var(--x-ov),0.04)', border: `1px solid ${C.border}`, color: C.muted },
    danger: { background: 'color-mix(in srgb, var(--x-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--x-red) 22%, transparent)', color: C.red },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: 8, fontWeight: 700, fontFamily: 'inherit', opacity: disabled ? 0.45 : 1, padding: size === 'sm' ? '5px 11px' : '8px 15px', fontSize: size === 'sm' ? 11.5 : 12.5, whiteSpace: 'nowrap', ...tones[tone] }}>
      {children}
    </button>
  )
}

function Note({ tone = C.blue, children }: { tone?: string; children: ReactNode }) {
  return <div style={{ padding: '9px 13px', borderRadius: 9, background: `${hexA(tone, 0x0F)}`, border: `1px solid ${hexA(tone, 0x33)}`, fontSize: 11.5, color: tone, lineHeight: 1.6 }}>{children}</div>
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: '34px 20px', textAlign: 'center', color: C.faint, fontSize: 12.5, lineHeight: 1.7 }}>{children}</div>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, height: 15 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 10, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

const Grid = ({ cols, children }: { cols: number; children: ReactNode }) =>
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>{children}</div>

function Num({ label, value, onChange, suffix, hint, color = C.text }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string; hint?: string; color?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <div style={{ position: 'relative' }}>
        <input type="number" value={Number.isFinite(value) ? value : 0}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...numStyle, color, paddingRight: suffix ? 42 : 10 }} />
        {suffix && <span style={{ position: 'absolute', right: 9, top: 7, fontSize: 10.5, color: C.dim, pointerEvents: 'none' }}>{suffix}</span>}
      </div>
    </Field>
  )
}

function Txt({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  return <Field label={label} hint={hint}><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={iStyle} /></Field>
}

function Sel<T extends string>({ label, value, options, onChange, hint, labels }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void; hint?: string; labels?: Record<string, string>
}) {
  return (
    <Field label={label} hint={hint}>
      <select value={value} onChange={e => onChange(e.target.value as T)} style={{ ...iStyle, cursor: 'pointer' }}>
        {options.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </Field>
  )
}

function DateF({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return <Field label={label} hint={hint}><input type="date" value={value} onChange={e => onChange(e.target.value)} style={{ ...iStyle }} /></Field>
}

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 0' }}>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} style={{
        width: 38, height: 22, borderRadius: 11, flexShrink: 0, marginTop: 1, cursor: 'pointer',
        border: 'none', padding: 0, position: 'relative', background: on ? C.orange : 'var(--x-border3)', transition: 'background .18s',
      }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s' }} />
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
      </div>
    </div>
  )
}

/* Every assumption wears its origin. A tender figure and a guess look
 * completely different at a glance, which is the entire point. */
function SourceTag({ source }: { source: Source }) {
  return <Tag tone={SOURCE_TONE[source]}>{SOURCE_SHORT[source]}</Tag>
}

function Bar({ value, max, tone, height = 6 }: { value: number; max: number; tone: string; height?: number }) {
  const w = max > 0 ? Math.max(1.5, (value / max) * 100) : 0
  return (
    <div style={{ height, background: 'rgba(var(--x-ov),0.045)', borderRadius: height / 2, overflow: 'hidden', minWidth: 50 }}>
      <div style={{ width: `${w}%`, height: '100%', background: tone, borderRadius: height / 2 }} />
    </div>
  )
}

/* ==========================================================================
 * BID LIST
 * ========================================================================== */

function BidList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { state, deleteBid } = useBids()
  const { state: inv } = useInventory()
  const { state: cost } = useCosting()
  const [filter, setFilter] = useState<BidStatus | 'all'>('all')

  const stock = useMemo(() => {
    const out: Record<string, number> = {}
    stockInStore(inv.pos, TODAY).forEach(l => { out[l.itemId] = (out[l.itemId] ?? 0) + l.qty })
    return out
  }, [inv.pos])

  const rows = useMemo(() => state.bids
    .filter(b => filter === 'all' || b.status === filter)
    .map(b => ({ bid: b, r: computeBid(b, inv.catalogue, cost.ownership, stock) })),
  [state.bids, filter, inv.catalogue, cost.ownership, stock])

  const live = state.bids.filter(b => b.status === 'draft' || b.status === 'pricing' || b.status === 'submitted')
  const liveValue = live.reduce((s, b) => {
    const r = computeBid(b, inv.catalogue, cost.ownership, stock)
    return s + r.pricing.revenue
  }, 0)
  const won = state.bids.filter(b => b.status === 'won').length
  const decided = state.bids.filter(b => b.status === 'won' || b.status === 'lost').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Grid cols={4}>
        <Stat label="Live bids" value={String(live.length)} note="draft, pricing or submitted" color={C.orange} />
        <Stat label="Value in play" value={moneyL(liveValue)} note="at the price currently set" color={C.blue} />
        <Stat label="Closing within 14 days" value={String(state.bids.filter(b => {
          const d = daysUntil(TODAY, b.deadline)
          return d >= 0 && d <= 14 && b.status !== 'won' && b.status !== 'lost'
        }).length)} color={C.amber} />
        <Stat label="Win rate" value={decided > 0 ? pct((won / decided) * 100) : '—'} note={decided > 0 ? `${won} of ${decided} decided` : 'nothing decided yet'} color={C.green} />
      </Grid>

      <Card title="Bids" pad={false}
        subtitle="Margin and cost per metre are recalculated live from each bid's own assumptions — nothing here is a stored number."
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filter} onChange={e => setFilter(e.target.value as BidStatus | 'all')} style={{ ...iStyle, width: 140, cursor: 'pointer' }}>
              <option value="all">All statuses</option>
              {BID_STATUSES.map(s => <option key={s} value={s}>{BID_STATUS_LABEL[s]}</option>)}
            </select>
            <Btn size="sm" tone="primary" onClick={onNew}>New bid</Btn>
          </div>
        }>
        {rows.length === 0 ? <Empty>No bids yet. Start one and XPLORIX will walk you through the estimate.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead><tr>
                <th style={th}>Bid</th><th style={th}>Client</th><th style={th}>Location</th>
                <th style={th}>Method</th><th style={thR}>Metres</th><th style={thR}>Rigs</th>
                <th style={thR}>Duration</th><th style={thR}>Cost / m</th><th style={thR}>Bid / m</th>
                <th style={thR}>Margin</th><th style={th}>Confidence</th><th style={th}>Risk</th>
                <th style={th}>Deadline</th><th style={th}>Status</th><th style={th} />
              </tr></thead>
              <tbody>
                {rows.map(({ bid, r }) => {
                  const days = daysUntil(TODAY, bid.deadline)
                  const closing = days >= 0 && days <= 14
                  return (
                    <tr key={bid.id} onClick={() => onOpen(bid.id)} style={{ borderBottom: rowBorder, cursor: 'pointer' }}>
                      <td style={{ ...td, color: C.text, fontWeight: 700, whiteSpace: 'normal', maxWidth: 200 }}>
                        {bid.name || 'Untitled bid'}
                        <div style={{ fontSize: 10.5, color: C.faint, fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>{bid.number}</div>
                      </td>
                      <td style={td}>{bid.client || '—'}</td>
                      <td style={td}>{bid.district ? `${bid.district}, ${bid.state}` : bid.state || '—'}</td>
                      <td style={td}>{bid.scope.method} · {bid.scope.holeSize}</td>
                      <td style={{ ...tdN, color: C.text, fontWeight: 700 }}>{bid.scope.totalMetres.toLocaleString('en-IN')}</td>
                      <td style={tdN}>{bid.rigIds.length || '—'}</td>
                      <td style={tdN}>{r.plan.calendarDays > 0 ? `${r.plan.calendarDays}d` : '—'}</td>
                      <td style={{ ...tdN, color: C.orange }}>{perMetre(r.costs.perBillableMetre)}</td>
                      <td style={{ ...tdN, color: C.blue, fontWeight: 700 }}>{perMetre(r.pricing.bidPerMetre)}</td>
                      <td style={{ ...tdN, fontWeight: 800, color: r.pricing.marginPct >= 15 ? C.green : r.pricing.marginPct >= 8 ? C.amber : C.red }}>
                        {pct(r.pricing.marginPct)}
                      </td>
                      <td style={td}><Tag tone={CONFIDENCE_TONE[r.confidence]}>{r.confidence}</Tag></td>
                      <td style={td}><Tag tone={r.risk.band === 'Low' ? C.green : r.risk.band === 'Medium' ? C.amber : C.red}>{r.risk.band}</Tag></td>
                      <td style={{ ...td, color: closing ? C.red : C.muted }}>
                        {fullDate(bid.deadline)}
                        {closing && <div style={{ fontSize: 10, color: C.red }}>{days === 0 ? 'today' : `${days}d left`}</div>}
                      </td>
                      <td style={td}><Tag tone={STATUS_TONE[bid.status]}>{BID_STATUS_LABEL[bid.status]}</Tag></td>
                      <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <Btn size="sm" tone="danger" onClick={() => deleteBid(bid.id)}>Delete</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ==========================================================================
 * WORKSPACE
 * ========================================================================== */

const STATE_TONE: Record<SectionState, string> = { done: C.green, attention: C.amber, missing: C.red }

/* The estimate above is engineering: rates of penetration, a fleet, unit
 * prices. This puts it beside the company's own record for the same size,
 * ground and depth: what those metres cost last time, all-in. A big gap
 * between the two is the thing to look at before the bid goes in. */
function OwnRecordCheck({ bid, r }: { bid: Bid; r: BidResult }) {
  const { state: inv } = useInventory()
  const { state: cost } = useCosting()
  const book = useMemo(() => buildRateBook(cost, inv), [cost, inv])
  const mix: Record<Formation, number> = { Soft: 0, Medium: 0, Hard: 0, 'Very Hard': 0 }
  bid.bands.forEach(b => { const f: Formation = b.hardness === 'Extremely Hard' ? 'Very Hard' : b.hardness; mix[f] += b.sharePct })
  const own = priceTender(book, { holeSize: bid.scope.holeSize, totalMetres: bid.scope.totalMetres, avgDepth: bid.scope.avgDepth, mix, marginPct: 0, rigs: Math.max(1, bid.rigIds.length), kind: 'own' })
  const priced = bid.scope.totalMetres - own.missing
  if (book.totals.own.metres === 0) return null
  const ownCpm = priced > 0 ? own.cost / priced : null
  const est = r.costs.perDrilledMetre
  const gap = ownCpm != null && est > 0 ? ((est - ownCpm) / ownCpm) * 100 : null
  const tone = gap == null ? C.faint : Math.abs(gap) <= 15 ? C.green : C.amber
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 420px', fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
        <b style={{ color: C.text }}>Against your own record.</b>{' '}
        {ownCpm != null
          ? <>{bid.scope.holeSize} metres in this ground and depth have cost you {perMetre(ownCpm)} all-in{own.missing > 0 ? ` (${Math.round(own.missing).toLocaleString('en-IN')} m of this bid fall in ground you have not drilled in ${bid.scope.holeSize})` : ''}. This estimate says {perMetre(est)}{gap != null ? <>: <b style={{ color: tone }}>{gap > 0 ? `${gap.toFixed(0)}% above` : `${Math.abs(gap).toFixed(0)}% below`}</b> your record{Math.abs(gap) > 15 ? '. Check the assumptions that differ before you bid.' : '.'}</> : '.'}</>
          : <>You have not drilled {bid.scope.holeSize} in this ground yet, so this estimate is the only figure. Price it with care.</>}
      </div>
      <Link href="/admin/intelligence/pricing" style={{ fontSize: 12.5, color: C.orange, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Rates by band from your record →</Link>
    </div>
  )
}

function Workspace({ bid, onChange, onBack }: { bid: Bid; onChange: (b: Bid) => void; onBack: () => void }) {
  const { state: inv } = useInventory()
  const { state: cost } = useCosting()
  const { duplicateBid } = useBids()
  const [section, setSection] = useState<SectionKey>('scope')

  const stock = useMemo(() => {
    const out: Record<string, number> = {}
    stockInStore(inv.pos, TODAY).forEach(l => { out[l.itemId] = (out[l.itemId] ?? 0) + l.qty })
    return out
  }, [inv.pos])

  const r = useMemo(() => computeBid(bid, inv.catalogue, cost.ownership, stock),
    [bid, inv.catalogue, cost.ownership, stock])
  const states = useMemo(() => sectionStates(bid, r), [bid, r])

  const u = (p: Partial<Bid>) => onChange({ ...bid, ...p })
  const uScope = (p: Partial<Bid['scope']>) => u({ scope: { ...bid.scope, ...p } })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 5 }}>
            ← All bids
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, margin: 0 }}>{bid.name || 'Untitled bid'}</h2>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>{bid.number}</span>
            {bid.client && ` · ${bid.client}`}
            {bid.siteName && ` · ${bid.siteName}`}
            {' · closes '}{fullDate(bid.deadline)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={bid.status} onChange={e => u({ status: e.target.value as BidStatus })} style={{ ...iStyle, width: 130, cursor: 'pointer' }}>
            {BID_STATUSES.map(s => <option key={s} value={s}>{BID_STATUS_LABEL[s]}</option>)}
          </select>
          <Btn size="sm" onClick={() => duplicateBid(bid.id, `${bid.name} — scenario`)}>Duplicate as scenario</Btn>
        </div>
      </div>

      <OwnRecordCheck bid={bid} r={r} />

      {/* The six numbers that decide everything, always on screen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10 }}>
        <Stat label="Scope" value={`${bid.scope.totalMetres.toLocaleString('en-IN')} m`} note={`${bid.scope.holeCount} holes · ${bid.scope.method}`} />
        <Stat label="Duration" value={r.plan.calendarDays > 0 ? `${r.plan.calendarDays} d` : '—'}
          note={bid.scope.requiredDays ? `${bid.scope.requiredDays} d allowed` : `${r.plan.rigCount} rig${r.plan.rigCount === 1 ? '' : 's'}`}
          color={r.plan.meetsDeadline === false ? C.red : C.text} />
        <Stat label="Total cost" value={moneyL(r.costs.total)} note={`incl. ${moneyL(r.costs.contingency)} risk cover`} color={C.orange} />
        <Stat label="Cost / billable m" value={perMetre(r.costs.perBillableMetre)} note={`${pct(bid.acceptancePct)} of metres billable`} color={C.orange} />
        <Stat label="Bid price" value={perMetre(r.pricing.bidPerMetre)} note={moneyL(r.pricing.revenue)} color={C.blue} big />
        <Stat label="Margin" value={pct(r.pricing.marginPct)} note={moneyL(r.pricing.profit)}
          color={r.pricing.marginPct >= 15 ? C.green : r.pricing.marginPct >= 8 ? C.amber : C.red} big />
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', gap: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, overflowX: 'auto' }}>
        {SECTIONS.map(sec => {
          const on = section === sec.key
          const st = states[sec.key]
          return (
            <button key={sec.key} onClick={() => setSection(sec.key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              whiteSpace: 'nowrap', background: on ? C.orange : 'transparent', color: on ? '#fff' : C.muted,
            }}>
              <span style={{ fontSize: 9.5, opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>{sec.n}</span>
              {sec.label}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'rgba(var(--x-ov),0.85)' : STATE_TONE[st] }} />
            </button>
          )
        })}
      </div>

      {section === 'scope' && <ScopeSection bid={bid} u={u} uScope={uScope} />}
      {section === 'geology' && <GeologySection bid={bid} u={u} r={r} />}
      {section === 'rigs' && <RigsSection bid={bid} u={u} r={r} />}
      {section === 'production' && <ProductionSection bid={bid} u={u} r={r} />}
      {section === 'consumables' && <ConsumablesSection bid={bid} u={u} r={r} />}
      {section === 'costs' && <CostsSection bid={bid} u={u} r={r} />}
      {section === 'pricing' && <PricingSection bid={bid} u={u} r={r} />}
      {section === 'risk' && <RiskSection bid={bid} u={u} r={r} />}
      {section === 'review' && <ReviewSection bid={bid} r={r} states={states} onGo={setSection} />}
    </div>
  )
}

/* ── 01 Scope ──────────────────────────────────────────────────────────── */

function ScopeSection({ bid, u, uScope }: { bid: Bid; u: (p: Partial<Bid>) => void; uScope: (p: Partial<Bid['scope']>) => void }) {
  const s = bid.scope
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Tender" subtitle="Who wants the work, where it is, and when the bid has to be in.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Grid cols={3}>
            <Txt label="Bid name" value={bid.name} onChange={v => u({ name: v })} placeholder="e.g. Sandur Iron Ore Exploration" />
            <Txt label="Client" value={bid.client} onChange={v => u({ client: v })} />
            <Txt label="Bid number" value={bid.number} onChange={v => u({ number: v })} />
          </Grid>
          <Grid cols={3}>
            <Txt label="State" value={bid.state} onChange={v => u({ state: v })} />
            <Txt label="District" value={bid.district} onChange={v => u({ district: v })} />
            <Txt label="Site name" value={bid.siteName} onChange={v => u({ siteName: v })} />
          </Grid>
          <Grid cols={3}>
            <DateF label="Tender issued" value={bid.issueDate} onChange={v => u({ issueDate: v })} />
            <DateF label="Submission deadline" value={bid.deadline} onChange={v => u({ deadline: v })} />
            <DateF label="Expected start" value={bid.expectedStart} onChange={v => u({ expectedStart: v })}
              hint="Rig ownership and fuel are priced at the rates in force from this date" />
          </Grid>
        </div>
      </Card>

      <Card title="Drilling scope" subtitle="Straight off the tender schedule. Everything downstream is derived from these figures.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Grid cols={4}>
            <Sel label="Method" value={s.method} options={METHODS} onChange={v => uScope({ method: v as Method })} />
            <Sel label="Hole size" value={s.holeSize} options={HOLE_SIZES} onChange={v => uScope({ holeSize: v })} />
            <Num label="Total metres" value={s.totalMetres} onChange={n => uScope({ totalMetres: n })} suffix="m" color={C.orange} />
            <Num label="Number of holes" value={s.holeCount} onChange={n => uScope({ holeCount: n })} />
          </Grid>
          <Grid cols={4}>
            <Num label="Average depth" value={s.avgDepth} onChange={n => uScope({ avgDepth: n })} suffix="m"
              hint="Drives the depth penalty on rate of penetration" />
            <Num label="Deepest hole" value={s.maxDepth} onChange={n => uScope({ maxDepth: n })} suffix="m"
              hint="A rig rated below this is excluded outright" />
            <Num label="Inclination" value={s.inclinationDeg} onChange={n => uScope({ inclinationDeg: n })} suffix="°"
              hint="90 is vertical" />
            <Num label="Completion window" value={s.requiredDays ?? 0} onChange={n => uScope({ requiredDays: n || undefined })} suffix="d"
              hint="Leave at zero if the tender sets no deadline" />
          </Grid>
          <Grid cols={4}>
            <Num label="Shifts per day" value={s.shiftsPerDay} onChange={n => uScope({ shiftsPerDay: n })} />
            <Num label="Shift length" value={s.shiftHours} onChange={n => uScope({ shiftHours: n })} suffix="hr" />
            <Num label="Working days" value={s.workingDaysPerWeek} onChange={n => uScope({ workingDaysPerWeek: n })} suffix="/wk" />
            <Num label="Billable metres" value={bid.acceptancePct} onChange={n => u({ acceptancePct: n })} suffix="%"
              hint="Share of drilled metres the client actually pays for" />
          </Grid>
        </div>
      </Card>

      <Card title="Site conditions" subtitle="These do not change the drilling arithmetic. They change what can go wrong, and they feed the risk section directly.">
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '2px 14px' }}>
          <Switch on={bid.remoteSite} onChange={v => u({ remoteSite: v })} label="Remote site"
            hint="Long haul for crew, fuel, water and parts. Every shortage costs a day rather than an hour." />
          <div style={{ height: 1, background: C.border }} />
          <Switch on={!bid.waterOnSite} onChange={v => u({ waterOnSite: !v })} label="Water must be tankered in"
            hint="Both a standing cost and a stoppage risk." />
        </div>
      </Card>

      <Note tone={C.dim}>
        If the tender gives you nothing about the ground, do not guess quietly. Fill the geology section with reference
        bands and mark them as assumptions — the estimate will then tell you, at every step, how much of it rests on
        nothing more than your own judgement.
      </Note>
    </div>
  )
}

/* ── 02 Geology ────────────────────────────────────────────────────────── */

function GeologySection({ bid, u, r }: { bid: Bid; u: (p: Partial<Bid>) => void; r: BidResult }) {
  const total = bid.bands.reduce((s, b) => s + b.sharePct, 0)
  const off = Math.abs(total - 100) > 0.5

  const upd = (id: string, p: Partial<GeoBand>) =>
    u({ bands: bid.bands.map(b => b.id === id ? { ...b, ...p, ...(p.source ? { confidence: SOURCE_CONFIDENCE[p.source] } : {}) } : b) })

  const add = () => u({ bands: [...bid.bands, {
    id: uid('gb'), name: 'New band', lithology: '', hardness: 'Hard', abrasiveness: 'Medium',
    fracturing: 'Medium', ground: 'Competent', sharePct: 0, source: 'user',
    confidence: 'low', expectedRecoveryPct: 92,
  }] })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="What the hole passes through"
        subtitle="The single biggest lever on a drilling bid. A ten point shift from medium to very hard ground moves cost per metre further than fuel, labour and mobilisation put together."
        pad={false}
        right={<Btn size="sm" tone="primary" onClick={add}>Add band</Btn>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              <th style={th}>Band</th><th style={th}>Lithology</th>
              <th style={th}>Hardness</th><th style={th}>Abrasiveness</th><th style={th}>Fracturing</th><th style={th}>Ground</th>
              <th style={thR}>Share</th><th style={thR}>Metres</th><th style={thR}>Recovery</th>
              <th style={th}>Source</th><th style={th} />
            </tr></thead>
            <tbody>
              {bid.bands.length === 0 && <tr><td colSpan={11}><Empty>No formations yet. Add the bands the tender describes, or your own best reading of the ground.</Empty></td></tr>}
              {bid.bands.map(b => {
                const metres = bid.scope.totalMetres * (b.sharePct / 100)
                return (
                  <tr key={b.id} style={{ borderBottom: rowBorder }}>
                    <td style={{ padding: '4px 8px', minWidth: 150 }}>
                      <input value={b.name} onChange={e => upd(b.id, { name: e.target.value })} style={iStyle} />
                    </td>
                    <td style={{ padding: '4px 8px', minWidth: 130 }}>
                      <input value={b.lithology} onChange={e => upd(b.id, { lithology: e.target.value })} placeholder="optional" style={iStyle} />
                    </td>
                    <td style={{ padding: '4px 8px', width: 118 }}>
                      <select value={b.hardness} onChange={e => upd(b.id, { hardness: e.target.value as Hardness })}
                        style={{ ...iStyle, cursor: 'pointer', color: HARDNESS_TONE[b.hardness], fontWeight: 700 }}>
                        {HARDNESS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 8px', width: 104 }}>
                      <select value={b.abrasiveness} onChange={e => upd(b.id, { abrasiveness: e.target.value as Level4 })} style={{ ...iStyle, cursor: 'pointer' }}>
                        {ABRASIVENESS.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 8px', width: 104 }}>
                      <select value={b.fracturing} onChange={e => upd(b.id, { fracturing: e.target.value as Level4 })} style={{ ...iStyle, cursor: 'pointer' }}>
                        {FRACTURING.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 8px', width: 136 }}>
                      <select value={b.ground} onChange={e => upd(b.id, { ground: e.target.value as GroundCondition })} style={{ ...iStyle, cursor: 'pointer' }}>
                        {GROUND.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 8px', width: 82 }}>
                      <input type="number" value={b.sharePct} onChange={e => upd(b.id, { sharePct: parseFloat(e.target.value) || 0 })} style={{ ...numStyle, color: C.orange }} />
                    </td>
                    <td style={{ ...tdN, color: C.text, fontWeight: 700 }}>{Math.round(metres).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '4px 8px', width: 82 }}>
                      <input type="number" value={b.expectedRecoveryPct} onChange={e => upd(b.id, { expectedRecoveryPct: parseFloat(e.target.value) || 0 })} style={numStyle} />
                    </td>
                    <td style={{ padding: '4px 8px', width: 128 }}>
                      <select value={b.source} onChange={e => upd(b.id, { source: e.target.value as Source })}
                        style={{ ...iStyle, cursor: 'pointer', color: SOURCE_TONE[b.source], fontWeight: 700, fontSize: 11.5 }}>
                        {(Object.keys(SOURCE_LABEL) as Source[]).map(s => <option key={s} value={s}>{SOURCE_SHORT[s]}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Btn size="sm" tone="danger" onClick={() => u({ bands: bid.bands.filter(x => x.id !== b.id) })}>Remove</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}`, background: 'rgba(var(--x-ov),0.02)' }}>
                <td style={{ ...td, fontWeight: 800, color: C.text }} colSpan={6}>Whole hole</td>
                <td style={{ ...tdN, fontWeight: 900, color: off ? C.red : C.green }}>{total.toFixed(1)}%</td>
                <td style={{ ...tdN, fontWeight: 900, color: C.text }}>{bid.scope.totalMetres.toLocaleString('en-IN')}</td>
                <td style={td} colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {off && <Note tone={C.red}>The bands add up to {total.toFixed(1)}%, not 100%. Until they do, the metres in each formation are wrong and so is everything priced from them.</Note>}

      <Card title="Where these numbers came from"
        subtitle="An estimate is only as good as its weakest input, so confidence here is the floor of what went in — not an average that flatters it."
        accent={CONFIDENCE_TONE[r.confidence]}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {(Object.keys(SOURCE_LABEL) as Source[]).map(s => {
            const mine = bid.bands.filter(b => b.source === s)
            const share = mine.reduce((a, b) => a + b.sharePct, 0)
            if (!mine.length) return null
            return (
              <div key={s} style={{ flex: '1 1 180px', padding: '10px 12px', borderRadius: 10, background: `${hexA(SOURCE_TONE[s], 0x0F)}`, border: `1px solid ${hexA(SOURCE_TONE[s], 0x33)}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SOURCE_TONE[s] }}>{SOURCE_LABEL[s]}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: C.text, fontFamily: 'ui-monospace, monospace', marginTop: 3 }}>{share.toFixed(0)}%</div>
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>of the hole, across {mine.length} band{mine.length === 1 ? '' : 's'}</div>
              </div>
            )
          })}
        </div>
        <Note tone={CONFIDENCE_TONE[r.confidence]}>
          {r.confidence === 'high'
            ? 'Every band comes from the tender or your own completed projects. This estimate is as solid as a pre-award estimate gets.'
            : r.confidence === 'medium'
            ? 'Some of the ground is reference data rather than this project’s own. Treat the cost per metre as a centre point, not a promise.'
            : 'Every band is an assumption. The arithmetic below is sound, but it is arithmetic on guesses — price the uncertainty in the risk section rather than hoping it away.'}
        </Note>
      </Card>
    </div>
  )
}

/* ── 03 Rigs & crew ────────────────────────────────────────────────────── */

function RigsSection({ bid, u, r }: { bid: Bid; u: (p: Partial<Bid>) => void; r: BidResult }) {
  const { state: inv } = useInventory()
  const { state: cost } = useCosting()
  const stock = useMemo(() => {
    const out: Record<string, number> = {}
    stockInStore(inv.pos, TODAY).forEach(l => { out[l.itemId] = (out[l.itemId] ?? 0) + l.qty })
    return out
  }, [inv.pos])

  const toggle = (id: string) =>
    u({ rigIds: bid.rigIds.includes(id) ? bid.rigIds.filter(x => x !== id) : [...bid.rigIds, id] })

  /* How the job changes with more iron on it. More rigs finish sooner and
   * spread ownership over fewer days each, but mobilisation and crew multiply,
   * so the cheapest fleet is rarely the biggest or the smallest. */
  const fleets = useMemo(() => [1, 2, 3, 4].map(n => {
    const ids = r.scores.filter(s => s.eligible).slice(0, n).map(s => s.rig.id)
    if (ids.length < n) return null
    const trial = { ...bid, rigIds: ids }
    const res = computeBid(trial, inv.catalogue, cost.ownership, stock)
    return { n, plan: res.plan, costs: res.costs, pricing: res.pricing, rigs: ids }
  }).filter(Boolean) as { n: number; plan: BidResult['plan']; costs: BidResult['costs']; pricing: BidResult['pricing']; rigs: string[] }[],
  [bid, r.scores, inv.catalogue, cost.ownership, stock])

  const best = fleets.length ? fleets.reduce((a, b) => (a.costs.perBillableMetre <= b.costs.perBillableMetre ? a : b)) : null
  const maxScore = Math.max(...r.scores.map(s => s.total), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Which rig can do this job"
        subtitle="A rig that cannot reach the depth or run the size is excluded outright — no amount of cheapness fixes a rig that cannot do the work. The rest are scored, and the score explains itself."
        pad={false}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              <th style={th}>Rig</th><th style={th}>Use</th><th style={th}>Status</th>
              <th style={thR}>Max depth</th><th style={th}>Sizes</th>
              <th style={th}>Score</th><th style={thR}>Total</th><th style={th}>What it comes from</th>
            </tr></thead>
            <tbody>
              {r.scores.map(s => {
                const on = bid.rigIds.includes(s.rig.id)
                return (
                  <tr key={s.rig.id} style={{ borderBottom: rowBorder, background: on ? 'color-mix(in srgb, var(--x-orange) 6%, transparent)' : undefined, opacity: s.eligible ? 1 : 0.5 }}>
                    <td style={{ ...tdMono, color: C.text, fontWeight: 700 }}>{s.rig.name}</td>
                    <td style={td}>
                      <input type="checkbox" checked={on} disabled={!s.eligible} onChange={() => toggle(s.rig.id)} style={{ cursor: s.eligible ? 'pointer' : 'not-allowed' }} />
                    </td>
                    <td style={td}><Tag tone={s.rig.status === 'Available' ? C.green : s.rig.status === 'Decommissioned' ? C.dim : C.amber}>{s.rig.status}</Tag></td>
                    <td style={tdN}>{s.rig.maxDepth} m</td>
                    <td style={tdMono}>{s.rig.sizes.join(', ')}</td>
                    <td style={{ ...td, width: 150 }}>{s.eligible ? <Bar value={s.total} max={maxScore} tone={C.orange} /> : <span style={{ color: C.red, fontSize: 11 }}>{s.blockedBecause}</span>}</td>
                    <td style={{ ...tdN, fontWeight: 800, color: s.eligible ? C.orange : C.dim }}>{s.eligible ? Math.round(s.total) : '—'}</td>
                    <td style={{ ...td, whiteSpace: 'normal', maxWidth: 320, lineHeight: 1.6 }}>
                      {s.eligible ? (
                        <>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.faint }}>
                            tech {Math.round(s.technical)} · output {Math.round(s.productivity)} · cost {Math.round(s.operatingCost)} · free {Math.round(s.availability)} · move {Math.round(s.mobilisation)}
                          </span>
                          {s.notes.map((n, i) => <div key={i} style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>{n}</div>)}
                        </>
                      ) : <span style={{ color: C.dim }}>Excluded</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', fontSize: 11, color: C.faint, background: 'rgba(var(--x-ov),0.02)', lineHeight: 1.6 }}>
          Weighted {RIG_WEIGHTS.technical}% technical fit, {RIG_WEIGHTS.productivity}% measured output, {RIG_WEIGHTS.operatingCost}% running cost,
          {' '}{RIG_WEIGHTS.availability}% availability, {RIG_WEIGHTS.mobilisation}% distance to site. Under maintenance is not the same as unavailable —
          a rig with a return date is a scheduling question, not a dead end.
        </div>
      </Card>

      {fleets.length > 0 && (
        <Card title="How many rigs to put on it"
          subtitle="More rigs finish sooner and spread ownership across fewer days each, but crew and mobilisation multiply. The cheapest fleet is rarely the biggest or the smallest."
          pad={false}>
          <table style={tableStyle}>
            <thead><tr>
              <th style={th}>Fleet</th><th style={thR}>Metres / day</th><th style={thR}>Duration</th>
              <th style={thR}>Total cost</th><th style={thR}>Cost / billable m</th><th style={thR}>Margin at current price</th><th style={th} />
            </tr></thead>
            <tbody>
              {fleets.map(f => {
                const on = bid.rigIds.length === f.n
                const cheapest = best?.n === f.n
                const late = bid.scope.requiredDays ? f.plan.calendarDays > bid.scope.requiredDays : false
                return (
                  <tr key={f.n} style={{ borderBottom: rowBorder, background: on ? 'color-mix(in srgb, var(--x-orange) 6%, transparent)' : undefined }}>
                    <td style={{ ...td, color: C.text, fontWeight: 700 }}>
                      {f.n} rig{f.n === 1 ? '' : 's'}
                      {cheapest && <span style={{ marginLeft: 7 }}><Tag tone={C.green}>lowest cost / m</Tag></span>}
                    </td>
                    <td style={tdN}>{Math.round(f.plan.metresPerRigDay * f.n)} m</td>
                    <td style={{ ...tdN, color: late ? C.red : C.text, fontWeight: 700 }}>
                      {f.plan.calendarDays} d{late && <span style={{ fontSize: 10, display: 'block', color: C.red }}>over the window</span>}
                    </td>
                    <td style={tdN}>{moneyL(f.costs.total)}</td>
                    <td style={{ ...tdN, color: C.orange, fontWeight: 700 }}>{perMetre(f.costs.perBillableMetre)}</td>
                    <td style={{ ...tdN, fontWeight: 700, color: f.pricing.marginPct >= 15 ? C.green : f.pricing.marginPct >= 8 ? C.amber : C.red }}>{pct(f.pricing.marginPct)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Btn size="sm" tone={on ? 'ghost' : 'primary'} disabled={on} onClick={() => u({ rigIds: f.rigs })}>{on ? 'Selected' : 'Use this'}</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Crew" subtitle={`Headcount follows the fleet. ${r.plan.rigCount} rig${r.plan.rigCount === 1 ? '' : 's'} over ${r.plan.calendarDays} days.`} pad={false}>
        <table style={tableStyle}>
          <thead><tr>
            <th style={th}>Role</th><th style={thR}>Per rig</th><th style={thR}>Project wide</th><th style={thR}>Heads</th>
            <th style={thR}>Wage / day</th><th style={thR}>Accommodation</th><th style={thR}>Cost</th>
          </tr></thead>
          <tbody>
            {r.crew.map(c => {
              const def = SEED_CREW.find(x => x.role === c.role)!
              return (
                <tr key={c.role} style={{ borderBottom: rowBorder }}>
                  <td style={{ ...td, color: C.text, fontWeight: 600 }}>{c.role}</td>
                  <td style={{ ...tdN, color: def.perRig ? C.muted : C.dim }}>{def.perRig || '—'}</td>
                  <td style={{ ...tdN, color: def.projectWide ? C.muted : C.dim }}>{def.projectWide || '—'}</td>
                  <td style={{ ...tdN, color: C.text, fontWeight: 700 }}>{c.heads}</td>
                  <td style={tdN}>{money(c.perDay)}</td>
                  <td style={tdN}>{money(c.accommodation)}</td>
                  <td style={{ ...tdN, color: C.amber, fontWeight: 700 }}>{moneyL(c.total)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.border}`, background: 'rgba(var(--x-ov),0.02)' }}>
              <td style={{ ...td, fontWeight: 800, color: C.text }} colSpan={3}>Total</td>
              <td style={{ ...tdN, fontWeight: 900, color: C.text }}>{r.crew.reduce((s, c) => s + c.heads, 0)}</td>
              <td style={td} colSpan={2} />
              <td style={{ ...tdN, fontWeight: 900, color: C.amber }}>{moneyL(r.crew.reduce((s, c) => s + c.total, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  )
}

/* ── 04 Production ─────────────────────────────────────────────────────── */

function ProductionSection({ bid, u, r }: { bid: Bid; u: (p: Partial<Bid>) => void; r: BidResult }) {
  const b = bid.budget
  const ub = (p: Partial<Bid['budget']>) => u({ budget: { ...b, ...p } })
  const eff = effectiveHours(bid.scope, b)
  const lost = bid.scope.shiftHours - eff

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="What a shift actually spends its hours on"
        subtitle="Assuming twelve hours of drilling in a twelve-hour shift is the most common way a tender is underpriced. Itemise the losses and they become arguable instead of invisible.">
        <Grid cols={5}>
          <Num label="Bit changes" value={b.bitChangeHrs} onChange={n => ub({ bitChangeHrs: n })} suffix="hr" />
          <Num label="Rod handling" value={b.rodHandlingHrs} onChange={n => ub({ rodHandlingHrs: n })} suffix="hr" />
          <Num label="Routine maintenance" value={b.maintenanceHrs} onChange={n => ub({ maintenanceHrs: n })} suffix="hr" />
          <Num label="Survey & sampling" value={b.surveyHrs} onChange={n => ub({ surveyHrs: n })} suffix="hr" />
          <Num label="Other downtime" value={b.otherDowntimeHrs} onChange={n => ub({ otherDowntimeHrs: n })} suffix="hr" />
        </Grid>
        <div style={{ marginTop: 14, padding: '13px 15px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 11 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
            <span style={{ color: C.muted }}>{bid.scope.shiftHours} hr shift</span>
            <span style={{ color: C.dim }}>−</span>
            <span style={{ color: C.red }}>{lost.toFixed(1)} hr lost</span>
            <span style={{ color: C.dim }}>=</span>
            <span style={{ color: C.orange, fontWeight: 900, fontSize: 18 }}>{eff.toFixed(1)} hr drilling</span>
            <span style={{ color: C.faint, fontSize: 11.5 }}>
              {bid.scope.shiftHours > 0 ? `${((eff / bid.scope.shiftHours) * 100).toFixed(0)}% of the shift on the bottom of the hole` : ''}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Grid cols={2}>
            <Num label="Rig availability" value={bid.availabilityPct} onChange={n => u({ availabilityPct: n })} suffix="%"
              hint="Covers what no shift budget can predict — a rig down for three days, a week of rain, a client stopping work. Kept separate so the two are argued about independently." />
          </Grid>
        </div>
      </Card>

      <Card title="Rate of penetration, band by band"
        subtitle="A base rate from the rule table, then every adjustment named and shown. Nothing here is a black box — disagree with any line and change it."
        pad={false}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              <th style={th}>Band</th><th style={th}>Hardness</th><th style={thR}>Metres</th>
              <th style={thR}>Base</th><th style={th}>Adjustments</th><th style={thR}>Final ROP</th><th style={thR}>Hours</th>
            </tr></thead>
            <tbody>
              {r.rops.map(x => (
                <tr key={x.band.id} style={{ borderBottom: rowBorder }}>
                  <td style={{ ...td, color: C.text, fontWeight: 600, whiteSpace: 'normal', maxWidth: 180 }}>
                    {x.band.name}
                    <span style={{ marginLeft: 7 }}><SourceTag source={x.band.source} /></span>
                  </td>
                  <td style={td}><Tag tone={HARDNESS_TONE[x.band.hardness]}>{x.band.hardness}</Tag></td>
                  <td style={{ ...tdN, color: C.text, fontWeight: 700 }}>{Math.round(x.metres).toLocaleString('en-IN')}</td>
                  <td style={{ ...tdN, color: C.muted }}>{x.baseRop.toFixed(1)}</td>
                  <td style={{ ...td, whiteSpace: 'normal', maxWidth: 330 }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {x.factors.length === 0 && <span style={{ color: C.dim }}>none</span>}
                      {x.factors.map((f, i) => (
                        <span key={i} style={{ fontSize: 10.5, padding: '1.5px 6px', borderRadius: 5, fontFamily: 'ui-monospace, monospace',
                          color: f.pct < 0 ? C.red : C.green, background: f.pct < 0 ? 'color-mix(in srgb, var(--x-red) 8%, transparent)' : 'color-mix(in srgb, var(--x-green) 8%, transparent)' }}>
                          {f.label} {signed(f.pct)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...tdN, color: C.orange, fontWeight: 800 }}>{x.finalRop.toFixed(2)} m/hr</td>
                  <td style={{ ...tdN, color: C.faint }}>{x.finalRop > 0 ? Math.round(x.metres / x.finalRop).toLocaleString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}`, background: 'rgba(var(--x-ov),0.02)' }}>
                <td style={{ ...td, fontWeight: 800, color: C.text }} colSpan={2}>Blended across the job</td>
                <td style={{ ...tdN, fontWeight: 900, color: C.text }}>{bid.scope.totalMetres.toLocaleString('en-IN')}</td>
                <td style={td} colSpan={2} />
                <td style={{ ...tdN, fontWeight: 900, color: C.orange }}>{r.plan.blendedRop.toFixed(2)} m/hr</td>
                <td style={{ ...tdN, fontWeight: 800, color: C.faint }}>
                  {r.plan.blendedRop > 0 ? Math.round(bid.scope.totalMetres / r.plan.blendedRop).toLocaleString('en-IN') : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ padding: '10px 16px', fontSize: 11, color: C.faint, background: 'rgba(var(--x-ov),0.02)', lineHeight: 1.6 }}>
          Blended by metres, not by band count — a 5% seam of extremely hard rock should not drag the average as hard as a 60% one.
        </div>
      </Card>

      <Card title="What that produces">
        <Grid cols={4}>
          <Stat label="Drilling hours / day" value={`${r.plan.effHoursPerDay.toFixed(1)} hr`} note={`${bid.scope.shiftsPerDay} × ${eff.toFixed(1)} hr`} />
          <Stat label="Metres / rig / day" value={`${r.plan.metresPerRigDay.toFixed(1)} m`} note={`at ${bid.availabilityPct}% availability`} color={C.orange} />
          <Stat label="Rig days needed" value={String(r.plan.rigDays)} note={`${r.plan.rigCount} rig${r.plan.rigCount === 1 ? '' : 's'}`} />
          <Stat label="Calendar duration" value={`${r.plan.calendarDays} d`}
            note={`${bid.scope.workingDaysPerWeek} days a week`}
            color={r.plan.meetsDeadline === false ? C.red : C.text} />
        </Grid>
        {r.plan.meetsDeadline === false && (
          <div style={{ marginTop: 12 }}>
            <Note tone={C.red}>
              {r.plan.calendarDays} days against a {bid.scope.requiredDays}-day window. Add a rig, add a shift, or price
              the delay penalty — the risk section has already switched that on for you.
            </Note>
          </div>
        )}
        {r.plan.meetsDeadline === true && (
          <div style={{ marginTop: 12 }}>
            <Note tone={C.green}>
              {r.plan.calendarDays} days against a {bid.scope.requiredDays}-day window, {bid.scope.requiredDays! - r.plan.calendarDays} days of slack.
            </Note>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── 05 Consumables ────────────────────────────────────────────────────── */

function ConsumablesSection({ bid, u, r }: { bid: Bid; u: (p: Partial<Bid>) => void; r: BidResult }) {
  const short = r.consumables.filter(c => c.shortfall > 0)
  const total = r.consumables.reduce((s, c) => s + c.cost, 0)
  const shortValue = short.reduce((s, c) => s + c.shortfall * c.rate, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="What the job will consume"
        subtitle="Read straight off your parts catalogue, so a bid and a live project agree on what a bit costs and how long it lasts. Life is shortened by the ground, the same way it is in the field."
        right={<div style={{ width: 190 }}><Num label="Contingency" value={bid.consumableContingencyPct} onChange={n => u({ consumableContingencyPct: n })} suffix="%" /></div>}
        pad={false}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              <th style={th}>Part number</th><th style={th}>Item</th>
              <th style={thR}>Catalogue life</th><th style={thR}>Life in this ground</th>
              <th style={thR}>Needed</th><th style={thR}>With contingency</th>
              <th style={thR}>In store</th><th style={thR}>To buy</th><th style={thR}>Cost</th>
            </tr></thead>
            <tbody>
              {r.consumables.length === 0 && <tr><td colSpan={9}><Empty>Add formation bands and the consumable forecast builds itself from the catalogue.</Empty></td></tr>}
              {r.consumables.map(c => {
                const worse = c.effectiveLife < c.catalogueLife
                return (
                  <tr key={c.itemId} style={{ borderBottom: rowBorder, background: c.shortfall > 0 ? 'color-mix(in srgb, var(--x-amber) 4.5%, transparent)' : undefined }}>
                    <td style={{ ...tdMono, color: C.text, fontWeight: 700 }}>{c.partNumber || '—'}</td>
                    <td style={{ ...td, color: C.text, fontWeight: 600, whiteSpace: 'normal', maxWidth: 210 }}>{c.name}</td>
                    <td style={{ ...tdN, color: C.faint }}>{c.catalogueLife.toLocaleString('en-IN')} m</td>
                    <td style={{ ...tdN, color: worse ? C.red : C.green, fontWeight: 700 }}>
                      {Math.round(c.effectiveLife).toLocaleString('en-IN')} m
                      <div style={{ fontSize: 9.5, opacity: .8 }}>
                        {signed(((c.effectiveLife - c.catalogueLife) / c.catalogueLife) * 100)}
                      </div>
                    </td>
                    <td style={tdN}>{c.qtyNeeded}</td>
                    <td style={{ ...tdN, color: C.text, fontWeight: 700 }}>{c.withContingency}</td>
                    <td style={{ ...tdN, color: c.inStock > 0 ? C.green : C.dim }}>{c.inStock || '—'}</td>
                    <td style={{ ...tdN, color: c.shortfall > 0 ? C.amber : C.dim, fontWeight: c.shortfall > 0 ? 800 : 400 }}>{c.shortfall || '—'}</td>
                    <td style={{ ...tdN, color: C.amber, fontWeight: 700 }}>{moneyL(c.cost)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}`, background: 'rgba(var(--x-ov),0.02)' }}>
                <td style={{ ...td, fontWeight: 800, color: C.text }} colSpan={8}>Tooling and consumables</td>
                <td style={{ ...tdN, fontWeight: 900, color: C.amber }}>{moneyL(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {short.length > 0 && (
        <Card title="What you would have to buy" accent={C.amber}
          subtitle="Measured against what is on the shelf right now. Lead times decide whether this is a purchase order or a problem.">
          <Note tone={C.amber}>
            {short.length} item{short.length === 1 ? '' : 's'} short, {moneyL(shortValue)} of procurement before this job can run
            at the assumed consumption. That money is already inside the cost below — this is about whether it can arrive in time.
          </Note>
        </Card>
      )}
    </div>
  )
}

/* ── 06 Costs ──────────────────────────────────────────────────────────── */

function CostsSection({ bid, u, r }: { bid: Bid; u: (p: Partial<Bid>) => void; r: BidResult }) {
  const p = bid.prices
  const up = (x: Partial<Bid['prices']>) => u({ prices: { ...p, ...x } })
  const max = Math.max(...r.costs.lines.map(l => l.amount), 1)
  const LAYER_TONE = { operating: C.amber, ownership: C.purple, indirect: C.teal }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Unit prices" subtitle="The only figures typed here. Everything else is a quantity the engine worked out above.">
        <Grid cols={4}>
          <Num label="Fuel" value={p.fuelPerLitre} onChange={n => up({ fuelPerLitre: n })} suffix="₹/L" color={C.amber} />
          <Num label="Water" value={p.waterPerMetre} onChange={n => up({ waterPerMetre: n })} suffix="₹/m" />
          <Num label="Drilling fluids" value={p.additivesPerMetre} onChange={n => up({ additivesPerMetre: n })} suffix="₹/m" />
          <Num label="Core boxes & sampling" value={p.coreBoxPerMetre} onChange={n => up({ coreBoxPerMetre: n })} suffix="₹/m" />
        </Grid>
        <div style={{ marginTop: 12 }}>
          <Grid cols={4}>
            <Num label="Mobilisation" value={p.mobPerRig} onChange={n => up({ mobPerRig: n })} suffix="₹" hint="per rig" />
            <Num label="Demobilisation" value={p.demobPerRig} onChange={n => up({ demobPerRig: n })} suffix="₹" hint="per rig" />
            <Num label="Site support" value={p.sitePerDay} onChange={n => up({ sitePerDay: n })} suffix="₹/day" hint="camp, water tanker, vehicles" />
            <Num label="Overhead" value={p.overheadPct} onChange={n => up({ overheadPct: n })} suffix="%" />
          </Grid>
        </div>
      </Card>

      <Card title="What the job costs" pad={false}
        subtitle="The same three layers the costing module uses on live projects, so a won bid converts into a project that costs out identically.">
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              <th style={th}>Line</th><th style={th}>Layer</th><th style={th}>Share</th>
              <th style={thR}>Amount</th><th style={thR}>Per metre</th><th style={th}>How it was worked out</th>
            </tr></thead>
            <tbody>
              {r.costs.lines.map((l, i) => (
                <tr key={i} style={{ borderBottom: rowBorder }}>
                  <td style={{ ...td, color: C.text, fontWeight: 600 }}>{l.label}</td>
                  <td style={td}><Tag tone={LAYER_TONE[l.layer]}>{l.layer}</Tag></td>
                  <td style={{ ...td, width: 130 }}><Bar value={l.amount} max={max} tone={LAYER_TONE[l.layer]} /></td>
                  <td style={{ ...tdN, color: C.text, fontWeight: 700 }}>{moneyL(l.amount)}</td>
                  <td style={{ ...tdN, color: C.faint }}>{perMetre(bid.scope.totalMetres > 0 ? l.amount / bid.scope.totalMetres : 0)}</td>
                  <td style={{ ...td, color: C.faint, whiteSpace: 'normal', maxWidth: 260 }}>{l.note ?? '—'}</td>
                </tr>
              ))}
              <tr style={{ borderBottom: rowBorder, background: 'rgba(var(--x-ov),0.02)' }}>
                <td style={{ ...td, color: C.text, fontWeight: 700 }}>Risk contingency</td>
                <td style={td}><Tag tone={C.red}>priced risk</Tag></td>
                <td style={{ ...td, width: 130 }}><Bar value={r.costs.contingency} max={max} tone={C.red} /></td>
                <td style={{ ...tdN, color: C.red, fontWeight: 700 }}>{moneyL(r.costs.contingency)}</td>
                <td style={{ ...tdN, color: C.red }}>{perMetre(r.risk.contingencyPerMetre)}</td>
                <td style={{ ...td, color: C.faint, whiteSpace: 'normal' }}>{r.risk.active.length} risk{r.risk.active.length === 1 ? '' : 's'} carried, priced rather than scored</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}`, background: 'rgba(var(--x-ov),0.02)' }}>
                <td style={{ ...td, fontWeight: 900, color: C.text, fontSize: 13 }} colSpan={3}>Total project cost</td>
                <td style={{ ...tdN, fontWeight: 900, color: C.orange, fontSize: 13 }}>{moneyL(r.costs.total)}</td>
                <td style={{ ...tdN, fontWeight: 900, color: C.orange }}>{perMetre(r.costs.perDrilledMetre)}</td>
                <td style={td} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Grid cols={3}>
        <Stat label="Cost per drilled metre" value={perMetre(r.costs.perDrilledMetre)} note={`${bid.scope.totalMetres.toLocaleString('en-IN')} m in the ground`} />
        <Stat label="Cost per billable metre" value={perMetre(r.costs.perBillableMetre)} color={C.orange}
          note={`${Math.round(r.costs.billableMetres).toLocaleString('en-IN')} m the client pays for`} big />
        <Stat label="The gap" value={perMetre(r.costs.perBillableMetre - r.costs.perDrilledMetre)} color={C.red}
          note={`${(100 - bid.acceptancePct).toFixed(0)}% of metres drilled and not paid for`} />
      </Grid>

      <Note tone={C.red}>
        Price against drilled metres and you quietly give away the difference. At {pct(bid.acceptancePct)} acceptance
        that is {moneyL(r.costs.total - r.costs.perDrilledMetre * r.costs.billableMetres)} across this job — a margin
        that exists on the spreadsheet and nowhere else.
      </Note>
    </div>
  )
}

/* ── 07 Pricing ────────────────────────────────────────────────────────── */

function PricingSection({ bid, u, r }: { bid: Bid; u: (p: Partial<Bid>) => void; r: BidResult }) {
  const lo = r.costs.perBillableMetre * 0.95
  const hi = r.costs.perBillableMetre * 1.9
  const current = r.pricing.bidPerMetre

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="How to arrive at a price" subtitle="Three ways to the same number. Pick the one your business actually thinks in.">
        <Grid cols={3}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Sel label="Method" value={bid.pricingMethod} options={['margin', 'markup', 'manual'] as const}
              onChange={v => u({ pricingMethod: v as PricingMethod })}
              labels={{ margin: 'Target margin', markup: 'Cost plus markup', manual: 'Set the rate myself' }} />
          </div>
          {bid.pricingMethod === 'margin' && (
            <Num label="Target margin" value={bid.targetMarginPct} onChange={n => u({ targetMarginPct: n })} suffix="%" color={C.green}
              hint="Margin on revenue, not markup on cost — they are not the same and the difference grows fast" />
          )}
          {bid.pricingMethod === 'markup' && (
            <Num label="Markup on cost" value={bid.markupPct} onChange={n => u({ markupPct: n })} suffix="%" color={C.green} />
          )}
          {bid.pricingMethod === 'manual' && (
            <Num label="Bid rate" value={bid.manualRate} onChange={n => u({ manualRate: n })} suffix="₹/m" color={C.blue}
              hint="What you intend to quote. The margin below is what it leaves you" />
          )}
          <Stat label="Break even" value={perMetre(r.pricing.breakEvenPerMetre)} note="below this the job loses money" color={C.red} />
        </Grid>

        {/* Move the price and watch everything move with it. */}
        <div style={{ marginTop: 18, padding: '16px 18px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bid price</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: C.blue, fontFamily: 'ui-monospace, monospace' }}>{perMetre(current)}</span>
          </div>
          <input type="range" min={Math.round(lo)} max={Math.round(hi)} step={10} value={Math.round(current)}
            onChange={e => u({ pricingMethod: 'manual', manualRate: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: C.orange, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.dim, fontFamily: 'ui-monospace, monospace', marginTop: 3 }}>
            <span>{perMetre(lo)}</span>
            <span style={{ color: C.red }}>break even {perMetre(r.pricing.breakEvenPerMetre)}</span>
            <span>{perMetre(hi)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
            <Stat label="Revenue" value={moneyL(r.pricing.revenue)} color={C.blue} />
            <Stat label="Cost" value={moneyL(r.pricing.cost)} color={C.orange} />
            <Stat label="Profit" value={moneyL(r.pricing.profit)} color={r.pricing.profit >= 0 ? C.green : C.red} />
            <Stat label="Margin" value={pct(r.pricing.marginPct)} color={r.pricing.marginPct >= 15 ? C.green : r.pricing.marginPct >= 8 ? C.amber : C.red} big />
          </div>
        </div>
      </Card>

      <Card title="What each formation is worth"
        subtitle="A flat rate across mixed ground overprices the soft metres and underprices the hard ones. If the tender lets you quote per formation, this is the shape of it."
        pad={false}>
        <table style={tableStyle}>
          <thead><tr>
            <th style={th}>Band</th><th style={th}>Hardness</th><th style={thR}>Metres</th>
            <th style={thR}>Cost / m here</th><th style={thR}>At a flat rate</th><th style={thR}>Margin on these metres</th>
          </tr></thead>
          <tbody>
            {r.rops.map(x => {
              /* Share of cost follows drilling hours, because that is what the
               * ground actually consumes — a slow band eats crew, fuel and
               * ownership in proportion to the time it takes. */
              const hrs = x.finalRop > 0 ? x.metres / x.finalRop : 0
              const totalHrs = r.rops.reduce((s, y) => s + (y.finalRop > 0 ? y.metres / y.finalRop : 0), 0)
              const cost = totalHrs > 0 ? r.costs.total * (hrs / totalHrs) : 0
              const perM = x.metres > 0 ? cost / x.metres : 0
              const rev = x.metres * r.pricing.bidPerMetre * (bid.acceptancePct / 100)
              const marginPct = rev > 0 ? ((rev - cost) / rev) * 100 : 0
              return (
                <tr key={x.band.id} style={{ borderBottom: rowBorder }}>
                  <td style={{ ...td, color: C.text, fontWeight: 600 }}>{x.band.name}</td>
                  <td style={td}><Tag tone={HARDNESS_TONE[x.band.hardness]}>{x.band.hardness}</Tag></td>
                  <td style={tdN}>{Math.round(x.metres).toLocaleString('en-IN')}</td>
                  <td style={{ ...tdN, color: C.orange, fontWeight: 700 }}>{perMetre(perM)}</td>
                  <td style={{ ...tdN, color: C.blue }}>{perMetre(r.pricing.bidPerMetre)}</td>
                  <td style={{ ...tdN, fontWeight: 800, color: marginPct >= 15 ? C.green : marginPct >= 5 ? C.amber : C.red }}>{pct(marginPct)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', fontSize: 11, color: C.faint, background: 'rgba(var(--x-ov),0.02)', lineHeight: 1.6 }}>
          Cost is shared out by drilling hours rather than metres, because a slow band consumes crew, fuel and ownership
          in proportion to the time it takes — not the distance it covers.
        </div>
      </Card>
    </div>
  )
}

/* ── 08 Risk ───────────────────────────────────────────────────────────── */

function RiskSection({ bid, u, r }: { bid: Bid; u: (p: Partial<Bid>) => void; r: BidResult }) {
  const toggle = (id: string) =>
    u({ risks: bid.risks.map(k => k.id === id ? { ...k, active: !k.active } : k) })
  const setCost = (id: string, n: number) =>
    u({ risks: bid.risks.map(k => k.id === id ? { ...k, costPerMetre: n } : k) })

  const bandTone = r.risk.band === 'Low' ? C.green : r.risk.band === 'Medium' ? C.amber : r.risk.band === 'High' ? C.red : C.purple
  const risks = bid.risks.map(k => r.auto.some(a => a.id === k.id) ? { ...k, active: true, auto: true } : k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Grid cols={4}>
        <Stat label="Risk band" value={r.risk.band} color={bandTone} note={`${r.risk.score} of 100`} big />
        <Stat label="Cover carried" value={perMetre(r.risk.contingencyPerMetre)} color={C.red} note="added to cost per metre" big />
        <Stat label="Total cover" value={moneyL(r.costs.contingency)} color={C.red} note={`across ${bid.scope.totalMetres.toLocaleString('en-IN')} m`} />
        <Stat label="Margin without it" value={pct(
          r.pricing.revenue > 0 ? ((r.pricing.revenue - (r.costs.total - r.costs.contingency)) / r.pricing.revenue) * 100 : 0
        )} color={C.faint} note="what the bid looks like uncovered" />
      </Grid>

      <Note tone={C.orange}>
        Risk here is <b>priced, not scored</b>. A number out of a hundred means nothing to whoever signs this bid;
        {' '}{perMetre(r.risk.contingencyPerMetre)} of cover is a figure they can accept, argue with, or strike out.
      </Note>

      {r.auto.length > 0 && (
        <Card title="Raised by the engine" accent={C.red}
          subtitle="Things XPLORIX can see for itself. You can switch them off, but you have to do it deliberately.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {r.auto.map(a => {
              const item = bid.risks.find(k => k.id === a.id)
              return (
                <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{item?.label}</span>
                    <span style={{ fontSize: 11.5, color: C.faint, marginLeft: 8 }}>{a.reason}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card title="What could go wrong, and what covering it costs" pad={false}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              <th style={th}>Carry</th><th style={th}>Risk</th><th style={th}>Category</th>
              <th style={th}>Why it matters</th><th style={thR}>Weight</th><th style={thR}>Cover ₹/m</th><th style={thR}>Cost</th>
            </tr></thead>
            <tbody>
              {risks.map(k => (
                <tr key={k.id} style={{ borderBottom: rowBorder, background: k.active ? 'color-mix(in srgb, var(--x-red) 4.5%, transparent)' : undefined, opacity: k.active ? 1 : 0.62 }}>
                  <td style={td}>
                    <input type="checkbox" checked={k.active} onChange={() => toggle(k.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ ...td, color: C.text, fontWeight: 600, whiteSpace: 'normal', maxWidth: 220 }}>
                    {k.label}
                    {k.auto && <span style={{ marginLeft: 7 }}><Tag tone={C.red}>auto</Tag></span>}
                  </td>
                  <td style={td}><Tag tone={C.dim}>{k.category}</Tag></td>
                  <td style={{ ...td, color: C.faint, whiteSpace: 'normal', maxWidth: 340, lineHeight: 1.6 }}>{k.detail}</td>
                  <td style={{ ...tdN, color: C.faint }}>{k.weight}</td>
                  <td style={{ padding: '4px 8px', width: 100 }}>
                    <input type="number" value={k.costPerMetre} disabled={!k.active}
                      onChange={e => setCost(k.id, parseFloat(e.target.value) || 0)}
                      style={{ ...numStyle, color: k.active ? C.red : C.muted, opacity: k.active ? 1 : 0.4 }} />
                  </td>
                  <td style={{ ...tdN, color: k.active ? C.red : C.dim, fontWeight: k.active ? 700 : 400 }}>
                    {k.active ? moneyL(k.costPerMetre * bid.scope.totalMetres) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}`, background: 'rgba(var(--x-ov),0.02)' }}>
                <td style={{ ...td, fontWeight: 800, color: C.text }} colSpan={4}>Carried on this bid</td>
                <td style={{ ...tdN, fontWeight: 800, color: C.faint }}>{r.risk.score}</td>
                <td style={{ ...tdN, fontWeight: 900, color: C.red }}>{perMetre(r.risk.contingencyPerMetre)}</td>
                <td style={{ ...tdN, fontWeight: 900, color: C.red }}>{moneyL(r.costs.contingency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {r.risk.byCategory.length > 0 && (
        <Card title="Where the exposure sits" pad={false}>
          <table style={tableStyle}>
            <thead><tr><th style={th}>Category</th><th style={th}>Share of the cover</th><th style={thR}>Items</th><th style={thR}>Weight</th><th style={thR}>Cover ₹/m</th></tr></thead>
            <tbody>
              {r.risk.byCategory.sort((a, b) => b.cost - a.cost).map(c => (
                <tr key={c.category} style={{ borderBottom: rowBorder }}>
                  <td style={{ ...td, color: C.text, fontWeight: 700 }}>{c.category}</td>
                  <td style={{ ...td, width: '45%' }}><Bar value={c.cost} max={Math.max(...r.risk.byCategory.map(x => x.cost), 1)} tone={C.red} /></td>
                  <td style={tdN}>{c.count}</td>
                  <td style={{ ...tdN, color: C.faint }}>{c.score}</td>
                  <td style={{ ...tdN, color: C.red, fontWeight: 700 }}>{perMetre(c.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

/* ── 09 Review ─────────────────────────────────────────────────────────── */

/* No traffic light telling a contractor whether to bid. Software that issues
 * verdicts gets overridden, then ignored, then distrusted. What it can do is
 * lay out exactly what would have to be true for this bid to work, and let the
 * person who carries the consequence decide. */
function ReviewSection({ bid, r, states, onGo }: {
  bid: Bid; r: BidResult; states: Record<SectionKey, SectionState>; onGo: (s: SectionKey) => void
}) {
  const conditions: { ok: boolean; text: string; go?: SectionKey }[] = [
    { ok: r.confidence !== 'low',
      text: r.confidence === 'low'
        ? 'The ground behaves roughly as you have assumed — every band on this bid is your own estimate, not the tender’s'
        : 'The ground behaves roughly as the tender describes it',
      go: 'geology' },
    { ok: r.plan.meetsDeadline !== false,
      text: r.plan.meetsDeadline === false
        ? `${r.plan.calendarDays} days of work fits a ${bid.scope.requiredDays}-day window, which today it does not`
        : `The job finishes inside ${r.plan.calendarDays} days`,
      go: 'production' },
    { ok: r.chosen.every(c => c.rig.status === 'Available'),
      text: r.chosen.every(c => c.rig.status === 'Available')
        ? 'The chosen rig is free when the project starts'
        : `${r.chosen.filter(c => c.rig.status !== 'Available').map(c => c.rig.name).join(', ')} is released in time`,
      go: 'rigs' },
    { ok: r.consumables.every(c => c.shortfall === 0),
      text: r.consumables.some(c => c.shortfall > 0)
        ? `${r.consumables.filter(c => c.shortfall > 0).length} consumable lines are procured before the start date`
        : 'Consumables are already on the shelf',
      go: 'consumables' },
    { ok: bid.acceptancePct >= 95,
      text: `The client accepts at least ${pct(bid.acceptancePct)} of drilled metres`,
      go: 'scope' },
    { ok: r.plan.effHoursPerShift / bid.scope.shiftHours >= 0.6,
      text: `Crews hold ${r.plan.effHoursPerShift.toFixed(1)} drilling hours in a ${bid.scope.shiftHours} hour shift`,
      go: 'production' },
  ]
  const unmet = conditions.filter(c => !c.ok)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="The bid" accent={C.orange}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <Stat label="Scope" value={`${bid.scope.totalMetres.toLocaleString('en-IN')} m`} note={`${bid.scope.holeCount} holes, ${bid.scope.method} ${bid.scope.holeSize}`} />
          <Stat label="Fleet & duration" value={`${r.plan.rigCount} rig · ${r.plan.calendarDays} d`} note={`${r.plan.metresPerRigDay.toFixed(1)} m per rig per day`} />
          <Stat label="Total cost" value={moneyL(r.costs.total)} color={C.orange} note={`${perMetre(r.costs.perBillableMetre)} billable`} />
          <Stat label="Bid price" value={perMetre(r.pricing.bidPerMetre)} color={C.blue} note={moneyL(r.pricing.revenue)} big />
          <Stat label="Profit" value={moneyL(r.pricing.profit)} color={r.pricing.profit >= 0 ? C.green : C.red} />
          <Stat label="Margin" value={pct(r.pricing.marginPct)} color={r.pricing.marginPct >= 15 ? C.green : r.pricing.marginPct >= 8 ? C.amber : C.red} big />
          <Stat label="Risk cover" value={perMetre(r.risk.contingencyPerMetre)} color={C.red} note={`${r.risk.band.toLowerCase()} exposure`} />
          <Stat label="Estimate confidence" value={r.confidence} color={CONFIDENCE_TONE[r.confidence]} note="the floor of what went in" />
        </div>
      </Card>

      <Card title="What would have to be true"
        subtitle="XPLORIX will not tell you whether to bid — it does not carry the consequence. What it can do is name every assumption this price rests on, so the decision is made with eyes open."
        accent={unmet.length === 0 ? C.green : C.amber}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {conditions.map((c, i) => (
            <div key={i} onClick={() => c.go && onGo(c.go)} style={{
              display: 'flex', gap: 11, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 9,
              background: c.ok ? 'color-mix(in srgb, var(--x-green) 5%, transparent)' : 'color-mix(in srgb, var(--x-amber) 7%, transparent)',
              border: `1px solid ${c.ok ? 'color-mix(in srgb, var(--x-green) 20%, transparent)' : 'color-mix(in srgb, var(--x-amber) 28%, transparent)'}`,
              cursor: c.go ? 'pointer' : 'default',
            }}>
              <span style={{ fontSize: 13, color: c.ok ? C.green : C.amber, lineHeight: 1.3 }}>{c.ok ? '✓' : '!'}</span>
              <span style={{ fontSize: 12, color: c.ok ? C.muted : C.text, lineHeight: 1.6, flex: 1 }}>{c.text}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 13 }}>
          <Note tone={unmet.length === 0 ? C.green : C.amber}>
            {unmet.length === 0
              ? `Every assumption behind ${perMetre(r.pricing.bidPerMetre)} holds up on what you have entered. The margin is ${pct(r.pricing.marginPct)}.`
              : `${unmet.length} of these are not true today. That does not mean walk away — it means ${perMetre(r.pricing.bidPerMetre)} is priced on ${unmet.length} thing${unmet.length === 1 ? '' : 's'} going your way.`}
          </Note>
        </div>
      </Card>

      <Card title="Sections" pad={false} subtitle="Anything amber is worth a second look before this goes out.">
        <table style={tableStyle}>
          <thead><tr><th style={th}>Section</th><th style={th}>State</th><th style={th} /></tr></thead>
          <tbody>
            {SECTIONS.filter(s => s.key !== 'review').map(s => (
              <tr key={s.key} style={{ borderBottom: rowBorder }}>
                <td style={{ ...td, color: C.text, fontWeight: 600 }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: C.dim, marginRight: 8 }}>{s.n}</span>{s.label}
                </td>
                <td style={td}><Tag tone={STATE_TONE[states[s.key]]}>{states[s.key] === 'done' ? 'complete' : states[s.key] === 'attention' ? 'needs a look' : 'missing'}</Tag></td>
                <td style={{ ...td, textAlign: 'right' }}><Btn size="sm" onClick={() => onGo(s.key)}>Open</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {bid.status === 'won' && (
        <Card title="Convert to a project" accent={C.green}
          subtitle="Everything in this bid — client, holes, formations, rigs, crew, consumables and rates — carries across. Nothing is re-entered.">
          <Btn tone="primary">Convert to project</Btn>
        </Card>
      )}
    </div>
  )
}

/* ==========================================================================
 * SCREEN
 * ========================================================================== */

export default function BidIntelligencePage() {
  const { state, saveBid } = useBids()
  const [openId, setOpenId] = useState<string | null>(null)
  const bid = state.bids.find(b => b.id === openId) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 48 }}>
      {!bid && (
        <>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: 0 }}>Bid Intelligence</h1>
            <p style={{ fontSize: 13, color: C.faint, marginTop: 5, maxWidth: 760, lineHeight: 1.65 }}>
              A tender is the costing engine run forwards. Give XPLORIX the scope, the ground and your own assumptions,
              and it works out the rate of penetration, the fleet, the duration, the consumables, the cost per metre and
              the price — showing its working at every step, and telling you which parts of the answer rest on evidence
              and which rest on a guess.
            </p>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 6, maxWidth: 760, lineHeight: 1.65 }}>
              The rates of penetration and unit prices here are sample figures. For rates straight from what your own metres
              have cost, by ground, size and depth, open <Link href="/admin/intelligence/pricing" style={{ color: C.orange, fontWeight: 700, textDecoration: 'none' }}>Price a tender</Link>.
            </p>
          </div>
          <BidList onOpen={setOpenId} onNew={() => {
            const b = blankBid(state.bids.length + 1)
            saveBid(b); setOpenId(b.id)
          }} />
        </>
      )}
      {bid && <Workspace bid={bid} onChange={saveBid} onBack={() => setOpenId(null)} />}
    </div>
  )
}
