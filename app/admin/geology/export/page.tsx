'use client'

import { useMemo, useState } from 'react'
import { useAllHoles, useCore, className } from '../../../../lib/core/store'
import { intervals } from '../../../../lib/core/geotech'
import { EXPORT_COLUMNS, toCsv, download, type ExportRow } from '../../../../lib/core/export'
import { Page, PageHead, Card, Btn, Seg, Empty, Note, Table, th, td, rowLine, T } from '../../../components/kit'
import { DemoPhotos } from '../../../components/core-ui'

/* EXPORT — interval tables for geology software (Leapfrog, Micromine,
 * Datamine, acQuire): HOLE_ID, FROM, TO, then the measures. */

type Step = '0.5' | '1' | '2' | '3'

export default function ExportCore() {
  const all = useAllHoles()
  const { review } = useCore()
  const [pick, setPick] = useState<Record<string, boolean>>({})
  const [step, setStep] = useState<Step>('1')
  const [cols, setCols] = useState<string[]>(EXPORT_COLUMNS.map(c => c.key))
  const [onlyChecked, setOnlyChecked] = useState(false)

  const chosen = all.list.filter(h => pick[h.data.hole] ?? true)
  const rows: ExportRow[] = useMemo(() => chosen.flatMap(h => {
    const rs = step === '1' ? h.rows : intervals(h.flat, +step)
    return rs.map(r => ({
      ...r, hole: h.data.hole, className: className(review, r.cls),
      checked: h.trays.filter(t => t.from < r.to && t.usedTo > r.from).every(t => !!review.checked[t.id]),
    }))
  }).filter(r => !onlyChecked || r.checked), [chosen, step, review, onlyChecked])

  if (!all.ready) return <Page><Card><Empty>Loading the core photos…</Empty></Card></Page>
  const checkedRows = rows.filter(r => r.checked).length
  const fixed = ['HOLE_ID', 'FROM', 'TO']

  return (
    <Page>
      <PageHead question="Export the core logs"
        answer={<>{rows.length.toLocaleString('en-IN')} intervals from {chosen.length} holes, {checkedRows.toLocaleString('en-IN')} of them fully checked by a geologist. CSV with HOLE_ID, FROM, TO first, so Leapfrog, Micromine, Datamine and acQuire read it as an interval table.</>}
        right={<><DemoPhotos /><Btn kind="primary" disabled={!rows.length} onClick={() => download(`xplorix_core_${step}m.csv`, toCsv(rows, cols))}>Download CSV</Btn></>} />

      <Card title="Holes">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {all.list.map(h => (
            <label key={h.data.hole} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: T.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={pick[h.data.hole] ?? true} onChange={e => setPick({ ...pick, [h.data.hole]: e.target.checked })} />{h.data.hole}
            </label>
          ))}
        </div>
      </Card>

      <Card title="Interval and rows">
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <Seg<Step> value={step} onChange={setStep} options={[{ value: '0.5', label: '0.5 m' }, { value: '1', label: '1 m' }, { value: '2', label: '2 m' }, { value: '3', label: '3 m' }]} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: T.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyChecked} onChange={e => setOnlyChecked(e.target.checked)} />Only intervals a geologist has checked
          </label>
        </div>
      </Card>

      <Card title="Columns" pad={false}>
        <Table>
          <thead><tr><th style={th}>Include</th><th style={th}>Column</th><th style={th}>What it is</th><th style={th}>First row</th></tr></thead>
          <tbody>
            {EXPORT_COLUMNS.map(c => (
              <tr key={c.key} style={{ borderBottom: rowLine }}>
                <td style={td}><input type="checkbox" aria-label={c.key} disabled={fixed.includes(c.key)} checked={cols.includes(c.key)} onChange={e => setCols(e.target.checked ? EXPORT_COLUMNS.map(x => x.key).filter(k => k === c.key || cols.includes(k)) : cols.filter(k => k !== c.key))} /></td>
                <td style={{ ...td, fontFamily: 'ui-monospace, monospace', color: T.text }}>{c.key}</td>
                <td style={td}>{c.label}</td>
                <td style={td}>{rows[0] ? String(c.get(rows[0])) : ''}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>GSI and JRC are proxies from the photo: aperture and infill cannot be seen, so they are taken as typical. STATUS says SUGGESTED until every tray in the interval is checked.</Note>
    </Page>
  )
}
