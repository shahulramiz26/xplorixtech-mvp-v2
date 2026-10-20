'use client'

import { useState } from 'react'
import { moneyL } from '../../lib/costing-store'
import type { MonthPoint, Bridge, Lever, Warning } from '../../lib/outlook-analytics'
import { T, tint, display } from './kit'

/* ==========================================================================
 * OUTLOOK CHARTS — drawn by hand in SVG so each says one thing plainly
 *
 *   ForecastBars   months as they closed, this month and next, with the
 *                  slow-to-best range as a band on the forecast bars
 *   Waterfall      last month's margin to this month's, step by step
 *   Tornado        what each thing that can happen does to next month
 *   WarningCard    a measure over six weeks, flagged when it turns
 * ========================================================================== */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const mon = (m: string) => MON[Number(m.slice(5, 7)) - 1]
const n0 = (n: number) => Math.round(n).toLocaleString('en-IN')
const short = (n: number) => { const a = Math.abs(n); const s = a >= 1e7 ? `${(a / 1e7).toFixed(1)}Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(1)}L` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : `${Math.round(a)}`; return `${n < 0 ? '−' : ''}₹${s}` }

export type Metric = 'metres' | 'revenue' | 'margin'

export function ForecastBars({ points, metric }: { points: MonthPoint[]; metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null)
  const val = (p: MonthPoint) => p[metric]
  const lo = (p: MonthPoint) => p.low?.[metric] ?? val(p)
  const hi = (p: MonthPoint) => p.high?.[metric] ?? val(p)
  const fmt = (n: number) => metric === 'metres' ? `${n0(n)} m` : short(n)
  const W = 760, H = 300, PL = 64, PR = 20, PT = 30, PB = 40
  const max = Math.max(...points.map(hi)) * 1.12 || 1
  const slot = (W - PL - PR) / points.length
  const bw = Math.min(70, slot * 0.5)
  const x = (i: number) => PL + slot * (i + 0.5)
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB)
  const base = H - PB
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img"
      aria-label={points.map(p => `${mon(p.month)} ${fmt(val(p))}${p.kind !== 'actual' ? `, range ${fmt(lo(p))} to ${fmt(hi(p))}` : ''}`).join('; ')} onMouseLeave={() => setHover(null)}>
      <defs>
        <pattern id="fc-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill={tint(T.orange, 18)} /><line x1="0" y1="0" x2="0" y2="7" stroke={tint(T.orange, 55)} strokeWidth="3" />
        </pattern>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(fr => (
        <g key={fr}>
          <line x1={PL} x2={W - PR} y1={y(max * fr)} y2={y(max * fr)} stroke="var(--x-border)" opacity={0.5} />
          <text x={PL - 8} y={y(max * fr) + 4} textAnchor="end" fontSize={11} fill="var(--x-faint)">{fr ? fmt(max * fr) : '0'}</text>
        </g>
      ))}
      {points.map((p, i) => {
        const on = hover === i
        const v = val(p)
        const isCur = p.kind === 'current', isFc = p.kind === 'forecast'
        const loggedShare = isCur && metric === 'metres' && p.logged != null ? Math.min(v, p.logged) : isCur ? v * ((p.logged ?? 0) / Math.max(1, p.metres)) : 0
        return (
          <g key={p.month} onMouseEnter={() => setHover(i)} opacity={hover == null || on ? 1 : 0.6}>
            {isFc ? <rect x={x(i) - bw / 2} y={y(v)} width={bw} height={base - y(v)} rx={4} fill="url(#fc-hatch)" stroke={T.orange} strokeDasharray="4 3" />
              : isCur ? <>
                <rect x={x(i) - bw / 2} y={y(v)} width={bw} height={base - y(v)} rx={4} fill="url(#fc-hatch)" stroke={T.orange} strokeDasharray="4 3" />
                <rect x={x(i) - bw / 2} y={y(loggedShare)} width={bw} height={base - y(loggedShare)} rx={4} fill={T.orange} />
              </> : <rect x={x(i) - bw / 2} y={y(v)} width={bw} height={base - y(v)} rx={4} fill="var(--x-muted)" opacity={0.55} />}
            {(isCur || isFc) && hi(p) - lo(p) > 0.5 && <>
              <line x1={x(i)} x2={x(i)} y1={y(hi(p))} y2={y(lo(p))} stroke={T.text} strokeWidth={1.6} />
              <line x1={x(i) - 9} x2={x(i) + 9} y1={y(hi(p))} y2={y(hi(p))} stroke={T.text} strokeWidth={1.6} />
              <line x1={x(i) - 9} x2={x(i) + 9} y1={y(lo(p))} y2={y(lo(p))} stroke={T.text} strokeWidth={1.6} />
            </>}
            <text x={x(i)} y={y(Math.max(v, hi(p))) - 8} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={T.text} fontFamily={display}>{fmt(v)}</text>
            <text x={x(i)} y={H - 20} textAnchor="middle" fontSize={12} fontWeight={isCur ? 700 : 500} fill={isCur ? T.orange : 'var(--x-muted)'}>{mon(p.month)}</text>
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={10.5} fill="var(--x-faint)">{p.kind === 'actual' ? 'closed' : isCur ? 'so far + forecast' : 'forecast'}</text>
            {on && (isCur || isFc) && hi(p) - lo(p) > 0.5 && <text x={x(i) + bw / 2 + 6} y={y(lo(p)) + 4} fontSize={11} fill="var(--x-muted)">slow {fmt(lo(p))} · best {fmt(hi(p))}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export function Waterfall({ b }: { b: Bridge }) {
  const steps = [
    { label: `${mon(b.from.month)} margin`, kind: 'total' as const, v: b.from.margin },
    { label: 'More or fewer metres', kind: 'step' as const, v: b.volume },
    { label: 'Rate a metre', kind: 'step' as const, v: b.rate },
    { label: 'Cost a metre', kind: 'step' as const, v: b.cost },
    { label: `${mon(b.to.month)} margin`, kind: 'total' as const, v: b.to.margin },
  ]
  let run = 0
  const bars = steps.map(s => {
    if (s.kind === 'total') { run = s.v; return { ...s, a: 0, b: s.v } }
    const a = run; run += s.v; return { ...s, a, b: run }
  })
  const W = 760, H = 290, PL = 64, PR = 16, PT = 30, PB = 52
  const max = Math.max(...bars.map(x => Math.max(x.a, x.b))) * 1.12 || 1
  const min = Math.min(0, ...bars.map(x => Math.min(x.a, x.b)))
  const slot = (W - PL - PR) / bars.length
  const bw = Math.min(80, slot * 0.56)
  const x = (i: number) => PL + slot * (i + 0.5)
  const y = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={steps.map(s => `${s.label} ${short(s.v)}`).join('; ')}>
      {[0, 0.5, 1].map(fr => { const v = min + (max - min) * fr; return (
        <g key={fr}><line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="var(--x-border)" opacity={0.5} /><text x={PL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--x-faint)">{short(v)}</text></g>
      ) })}
      {bars.map((s, i) => {
        const top = Math.max(s.a, s.b), bot = Math.min(s.a, s.b)
        const fill = s.kind === 'total' ? 'var(--x-muted)' : s.v >= 0 ? T.green : T.red
        return (
          <g key={s.label}>
            <rect x={x(i) - bw / 2} y={y(top)} width={bw} height={Math.max(2, y(bot) - y(top))} rx={4} fill={fill} opacity={s.kind === 'total' ? 0.6 : 0.9} />
            {i < bars.length - 1 && <line x1={x(i) + bw / 2} x2={x(i + 1) - bw / 2} y1={y(s.b)} y2={y(s.b)} stroke="var(--x-faint)" strokeDasharray="3 3" />}
            <text x={x(i)} y={y(top) - 8} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={s.kind === 'total' ? T.text : s.v >= 0 ? 'var(--x-good-text)' : 'var(--x-bad-text)'} fontFamily={display}>{s.kind === 'step' && s.v >= 0 ? '+' : ''}{short(s.v)}</text>
            {s.label.split(' ').reduce<string[]>((lines, w) => { const l = lines[lines.length - 1]; if (l && (l + ' ' + w).length <= 14) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); return lines }, []).map((line, k) => (
              <text key={k} x={x(i)} y={H - 32 + k * 14} textAnchor="middle" fontSize={11.5} fill="var(--x-muted)">{line}</text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export function Tornado({ levers, base }: { levers: Lever[]; base: number }) {
  const max = Math.max(1, ...levers.map(l => Math.max(Math.abs(l.low), Math.abs(l.high))))
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr', gap: 12, fontSize: 11.5, color: T.faint }}>
        <span />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Worse</span><span>Next month&apos;s margin as forecast, {short(base)}</span><span>Better</span></div>
      </div>
      {levers.map(l => (
        <div key={l.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{l.label}</span>
          <div style={{ position: 'relative', height: 34 }}>
            <div aria-hidden style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 2, background: T.text, opacity: 0.6 }} />
            {l.low < 0 && <div title={`${l.lowWord}: ${short(l.low)}`} style={{ position: 'absolute', right: '50%', top: 6, height: 22, width: `${(Math.abs(l.low) / max) * 36}%`, background: T.red, opacity: 0.85, borderRadius: '5px 0 0 5px' }} />}
            {l.high > 0 && <div title={`${l.highWord}: +${short(l.high)}`} style={{ position: 'absolute', left: '50%', top: 6, height: 22, width: `${(l.high / max) * 36}%`, background: T.green, opacity: 0.85, borderRadius: '0 5px 5px 0' }} />}
            {l.low < 0 && <span style={{ position: 'absolute', right: `calc(50% + ${(Math.abs(l.low) / max) * 36}% + 6px)`, top: 2, fontSize: 11.5, color: 'var(--x-bad-text)', whiteSpace: 'nowrap', textAlign: 'right' }}><b>{short(l.low)}</b><br /><span style={{ color: T.faint }}>{l.lowWord}</span></span>}
            {l.high > 0 && <span style={{ position: 'absolute', left: `calc(50% + ${(l.high / max) * 36}% + 6px)`, top: 2, fontSize: 11.5, color: 'var(--x-good-text)', whiteSpace: 'nowrap' }}><b>+{short(l.high)}</b><br /><span style={{ color: T.faint }}>{l.highWord}</span></span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function WarningCard({ w }: { w: Warning }) {
  const vals = w.weeks.map(x => x.value)
  const nums = vals.filter((v): v is number => v != null)
  const min = Math.min(...nums), max = Math.max(...nums)
  const W = 220, H = 56
  const pts = vals.map((v, i) => v == null ? null : [8 + (i / (vals.length - 1)) * (W - 16), 6 + (1 - (max === min ? 0.5 : (v - min) / (max - min))) * (H - 12)] as [number, number]).filter(Boolean) as [number, number][]
  const color = w.state === 'worse' ? T.red : w.state === 'better' ? T.green : 'var(--x-muted)'
  const fmt = (v: number | null) => v == null ? '—' : w.unit === '₹' ? short(v) : `${v.toFixed(w.unit === 'h' ? 0 : 1)}${w.unit === '%' ? '%' : ` ${w.unit}`}`
  const word = { worse: 'Turning the wrong way', better: 'Improving', steady: 'Steady', thin: 'Not enough weeks yet' }[w.state]
  return (
    <div style={{ background: w.state === 'worse' ? tint(T.red, 6) : T.card, border: `1px solid ${w.state === 'worse' ? tint(T.red, 35) : T.border}`, borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{w.label}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color }}>{word}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 56 }} aria-hidden>
        <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i >= pts.length - 2 ? 3.5 : 2.5} fill={i >= pts.length - 2 ? color : 'var(--x-faint)'} />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted }}>
        <span>4 weeks before: <b style={{ color: T.text }}>{fmt(w.before)}</b></span>
        <span>Last 2 weeks: <b style={{ color: T.text }}>{fmt(w.recent)}</b></span>
      </div>
      <span style={{ fontSize: 11.5, color: T.faint }}>{w.note}</span>
    </div>
  )
}

export { short as shortMoney, moneyL }
