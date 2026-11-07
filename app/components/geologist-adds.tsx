'use client'

import { useState } from 'react'
import { useCore, ALTERATIONS, SULPHIDES, INFILLS, type GeoNote } from '../../lib/core/store'
import type { CoreTray } from '../../lib/core/model'
import { Btn, T } from './kit'

/* GEOLOGIST ADDS — what a photo cannot see, added on the tray screen so the
 * XPLORIX log is the whole log: alteration, minerals and sulphides, what
 * fills the cracks, and a note, for any stretch of the tray. Every entry is
 * kept with who and when, and goes into the export. */

type Draft = Omit<GeoNote, 'by' | 'at'>
const field: React.CSSProperties = { minHeight: 34, fontSize: 13, padding: '0 8px', borderRadius: 7, border: '1px solid var(--x-border3)', background: 'var(--x-card)', color: 'var(--x-text)' }
const lab: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: T.faint }

export function GeologistAdds({ tray, at }: { tray: CoreTray; at?: number | null }) {
  const core = useCore()
  const notes = (core.review.geoNotes ?? []).filter(n => n.tray === tray.id).sort((a, b) => a.from - b.from)
  const [d, setD] = useState<Draft | null>(null)

  const start = (n?: GeoNote) => setD(n
    ? { id: n.id, tray: n.tray, from: n.from, to: n.to, alteration: n.alteration, intensity: n.intensity, minerals: [...n.minerals], infill: n.infill, note: n.note }
    : { id: `${tray.id}-g${Date.now()}`, tray: tray.id, from: at != null ? +at.toFixed(2) : +tray.from.toFixed(2), to: at != null ? +Math.min(tray.usedTo, at + 0.5).toFixed(2) : +tray.usedTo.toFixed(2), minerals: [] })
  const ok = d && d.to > d.from && d.from >= tray.from - 0.01 && d.to <= tray.usedTo + 0.01
  const summary = (n: GeoNote | Draft) => [
    n.alteration && n.alteration !== 'None' ? `${n.alteration}${n.intensity ? ` (${n.intensity.toLowerCase()})` : ''} alteration` : n.alteration === 'None' ? 'No alteration' : '',
    n.minerals.length ? n.minerals.map(m => `${m.name} ${m.pct}%`).join(', ') : '',
    n.infill ? `cracks: ${n.infill.toLowerCase()}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'grid', gap: 10, paddingTop: 18, marginTop: 18, borderTop: '1px solid var(--x-border)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.faint, flex: 1 }}>Geologist adds: what a photo cannot see</div>
        {!d && <Btn size="sm" kind="primary" onClick={() => start()}>+ Add for a stretch</Btn>}
      </div>
      <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>Alteration, minerals and sulphides, and what fills the cracks need the geologist&apos;s eye and hand lens. Add them here and the XPLORIX log is the whole log: no separate hand log, and it all goes into the export.</div>

      {notes.length === 0 && !d && <div style={{ fontSize: 13, color: T.faint }}>Nothing added for this tray yet.</div>}
      {notes.map(n => (
        <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--x-border)', background: 'var(--x-raised)' }}>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <b style={{ fontFamily: 'var(--x-mono, monospace)' }}>{n.from.toFixed(2)}–{n.to.toFixed(2)} m</b> <span>{summary(n) || '—'}</span>
            {n.note && <div style={{ color: T.muted, fontSize: 12.5 }}>“{n.note}”</div>}
            <div style={{ color: T.faint, fontSize: 11.5 }}>{n.by} · {n.at.replace('T', ' ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn size="sm" onClick={() => start(n)}>Edit</Btn>
            <Btn size="sm" onClick={() => core.removeGeoNote(n.id)}>Remove</Btn>
          </div>
        </div>
      ))}

      {d && (
        <div style={{ display: 'grid', gap: 12, padding: 12, borderRadius: 10, border: `1px solid ${T.orange}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4 }}><span style={lab}>From (m)</span>
              <input type="number" step="0.05" value={d.from} onChange={e => setD({ ...d, from: +e.target.value })} style={{ ...field, width: 100, fontFamily: 'var(--x-mono, monospace)' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><span style={lab}>To (m)</span>
              <input type="number" step="0.05" value={d.to} onChange={e => setD({ ...d, to: +e.target.value })} style={{ ...field, width: 100, fontFamily: 'var(--x-mono, monospace)' }} /></label>
            <span style={{ fontSize: 12, color: ok ? T.faint : T.red }}>{ok ? `Tray runs ${tray.from.toFixed(2)}–${tray.usedTo.toFixed(2)} m` : `Keep it inside ${tray.from.toFixed(2)}–${tray.usedTo.toFixed(2)} m`}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4 }}><span style={lab}>Alteration</span>
              <select value={d.alteration ?? ''} onChange={e => setD({ ...d, alteration: e.target.value || undefined, intensity: e.target.value && e.target.value !== 'None' ? d.intensity ?? 'Moderate' : undefined })} style={{ ...field, minWidth: 170 }}>
                <option value="">Not logged</option>{ALTERATIONS.map(a => <option key={a}>{a}</option>)}
              </select></label>
            {d.alteration && d.alteration !== 'None' && (
              <div style={{ display: 'grid', gap: 4 }}><span style={lab}>How strong</span>
                <div style={{ display: 'flex', gap: 4 }}>{(['Weak', 'Moderate', 'Strong'] as const).map(i => (
                  <button key={i} onClick={() => setD({ ...d, intensity: i })} style={{ ...field, cursor: 'pointer', fontWeight: 600, borderColor: d.intensity === i ? T.orange : 'var(--x-border3)', background: d.intensity === i ? 'color-mix(in srgb, var(--x-orange) 14%, transparent)' : 'var(--x-card)' }}>{i}</button>
                ))}</div></div>
            )}
            <label style={{ display: 'grid', gap: 4 }}><span style={lab}>Crack infill</span>
              <select value={d.infill ?? ''} onChange={e => setD({ ...d, infill: e.target.value || undefined })} style={{ ...field, minWidth: 150 }}>
                <option value="">Not logged</option>{INFILLS.map(a => <option key={a}>{a}</option>)}
              </select></label>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <span style={lab}>Minerals and sulphides (tap to add, then the %)</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SULPHIDES.map(m => {
                const on = d.minerals.find(x => x.name === m)
                return (
                  <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 7, border: `1px solid ${on ? T.orange : 'var(--x-border3)'}`, background: on ? 'color-mix(in srgb, var(--x-orange) 12%, transparent)' : 'var(--x-card)', padding: '0 4px 0 0' }}>
                    <button onClick={() => setD({ ...d, minerals: on ? d.minerals.filter(x => x.name !== m) : [...d.minerals, { name: m, pct: 1 }] })}
                      style={{ all: 'unset', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 9px' }}>{on ? '✓ ' : ''}{m}</button>
                    {on && <><input aria-label={`${m} %`} type="number" min={0} max={100} step={0.1} value={on.pct} onChange={e => setD({ ...d, minerals: d.minerals.map(x => x.name === m ? { ...x, pct: Math.max(0, Math.min(100, +e.target.value)) } : x) })}
                      style={{ ...field, width: 58, minHeight: 28, padding: '0 4px', fontFamily: 'var(--x-mono, monospace)' }} /><span style={{ fontSize: 12, color: T.muted }}>%</span></>}
                  </span>
                )
              })}
            </div>
          </div>

          <label style={{ display: 'grid', gap: 4 }}><span style={lab}>Note</span>
            <textarea value={d.note ?? ''} onChange={e => setD({ ...d, note: e.target.value || undefined })} rows={2} placeholder="e.g. Fine disseminated pyrite along quartz veinlets; bleached contact at 124.9 m"
              style={{ ...field, padding: 8, minHeight: 56, fontFamily: 'inherit', resize: 'vertical' }} /></label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn kind="primary" disabled={!ok} onClick={() => { if (!d || !ok) return; core.saveGeoNote(d); setD(null) }}>Save</Btn>
            <Btn onClick={() => setD(null)}>Cancel</Btn>
            {d && summary(d) && <span style={{ fontSize: 12.5, color: T.muted }}>{d.from.toFixed(2)}–{d.to.toFixed(2)} m · {summary(d)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
