'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import {
  useCosting, blankClientRate, uid, fullDate, monthOf, listOf, rigPool, peoplePool, HOLE_SIZES, PROJECT_STATUS_LABEL,
  type ClientRate, type ProjectRecord, type ProjectStatus, loginOfClient,
} from '../../../../lib/costing-store'
import { TODAY, addDays } from '../../../../lib/inventory-store'
import { projectById, projectStats, holeSeriesStart, contractOf, eventsFor, structureWords, day, whenIn, type ProjectHole } from '../../../../lib/projects'
import { financeLink } from '../../../../lib/admin-overview'
import { words, contractorOf, workOrderProgress } from '../../../../lib/contracting'
import {
  Page, Card, Tile, Grid, Split, Seg, Btn, Note, Modal, Field, Switch, Status, Empty, inputStyle, T, display,
} from '../../../components/kit'
import { RateSchedule, RateEditor, ratesUsable } from '../../../components/rate-card'
import { ProjectStatusTag, SharedTag, ChangeList, HolesTable, AddHolesModal, Fact } from '../../../components/project-ui'

/* ONE PROJECT — the contract and everything agreed under it.
 *
 *   Overview         where it stands and what needs the contractor
 *   Holes            the plan: add, change the depth, take one off
 *   Contract rates   what is agreed, what is waiting with the client, history
 *   Rigs and crew    what is on site
 *   Changes          every change, who made it, and whether the client saw it
 *
 * On a shared project a rate change is a proposal the client must accept;
 * everything else takes effect at once and the client is notified. */

type Tab = 'overview' | 'holes' | 'rates' | 'team' | 'changes'
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' }, { value: 'holes', label: 'Holes' }, { value: 'rates', label: 'Contract rates' },
  { value: 'team', label: 'Rigs and crew' }, { value: 'changes', label: 'Changes' },
]
const n0 = (v: number) => Math.round(v).toLocaleString('en-IN')
const link: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: T.orange, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }

// ── change the rates ──────────────────────────────────────────────────────

function RatesModal({ project, current, minDate, onClose, onSave }: {
  project: ProjectRecord; current?: ClientRate; minDate: string; onClose: () => void; onSave: (c: ClientRate) => void
}) {
  const [rate, setRate] = useState<ClientRate>(() => current ? { ...current, id: uid('cr'), rateRows: current.rateRows.map(r => ({ ...r })) } : blankClientRate(project.name, minDate))
  const [from, setFrom] = useState(minDate)
  const [why, setWhy] = useState('')
  const early = from < minDate
  const ok = ratesUsable(rate) && !early && (!current || why.trim().length > 0)
  return (
    <Modal title={current ? 'Change the contract rates' : 'Set the contract rates'} width={860} onClose={onClose}
      subtitle={project.shared
        ? `${project.client} will see the old and new rates side by side. The new rates start only when he accepts them.`
        : 'Work already done keeps the rate it was done under. The new rates apply from the start date.'}
      footer={<><Btn onClick={onClose}>Cancel</Btn>
        <Btn kind="primary" disabled={!ok} onClick={() => onSave({ ...rate, project: project.name, effectiveFrom: from, note: why.trim() || 'Contract as awarded' })}>
          {project.shared ? `Send to ${project.client}` : 'Save rates'}
        </Btn></>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <RateEditor value={rate} onChange={setRate} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 220px) minmax(0, 1fr)', gap: 14 }}>
          <Field label="New rates start">
            <input type="date" value={from} min={minDate} onChange={e => setFrom(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Reason for the change" hint="Shown to the client and kept in the history.">
            <input value={why} onChange={e => setWhy(e.target.value)} placeholder="e.g. diesel escalation clause, change of core size" style={inputStyle} />
          </Field>
        </div>
        {early && <Note tone="warn">Rates can start on {day(minDate)} or later. Earlier work keeps the rate it was done under.</Note>}
      </div>
    </Modal>
  )
}

// ── pick rigs or people ───────────────────────────────────────────────────

function Roster({ title, subtitle, items, pool, busy, addLabel, allowNew, newHint = 'Or type a new name', onChange }: {
  title: string; subtitle?: string; items: string[]; pool: string[]; busy: Record<string, string>
  addLabel: string; allowNew?: boolean; newHint?: string; onChange: (next: string[], what: { added?: string; removed?: string }) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const free = pool.filter(x => !items.includes(x))
  return (
    <Card title={title} subtitle={subtitle} pad={false}
      right={<Btn size="sm" onClick={() => setAdding(a => !a)}>{adding ? 'Done' : addLabel}</Btn>}>
      {items.length === 0 && !adding && <Empty>None yet.</Empty>}
      {items.map((x, i) => (
        <div key={x} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 18px', borderTop: i ? `1px solid ${T.line}` : undefined }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{x}</span>
          <button type="button" onClick={() => onChange(items.filter(y => y !== x), { removed: x })} aria-label={`Take ${x} off the project`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: T.faint, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
            <X size={13} /> Take off
          </button>
        </div>
      ))}
      {adding && (
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.line}`, background: T.raised }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {free.length === 0 && <span style={{ fontSize: 13, color: T.faint }}>{pool.length === 0 ? 'None on record yet. Type the first one below.' : 'Everything on the list is already here.'}</span>}
            {free.map(x => (
              <button key={x} type="button" disabled={!!busy[x]} onClick={() => onChange([...items, x], { added: x })} style={{
                padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy[x] ? 'not-allowed' : 'pointer',
                background: 'transparent', border: `1px solid ${T.border}`, color: T.text, opacity: busy[x] ? 0.5 : 1,
              }}>
                + {x}{busy[x] && <span style={{ fontWeight: 400, color: T.faint }}> · on {busy[x]}</span>}
              </button>
            ))}
          </div>
          {allowNew && (
            <form onSubmit={e => { e.preventDefault(); const v = name.trim(); if (v && !items.includes(v)) { onChange([...items, v], { added: v }); setName('') } }}
              style={{ display: 'flex', gap: 8, marginTop: 12, maxWidth: 420 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={newHint} style={inputStyle} />
              <Btn size="sm" disabled={!name.trim()} onClick={() => { const v = name.trim(); if (v && !items.includes(v)) { onChange([...items, v], { added: v }); setName('') } }}>Add</Btn>
            </form>
          )}
        </div>
      )}
    </Card>
  )
}

// ── the page ──────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { state, updateProject, planHoles, proposeRates, withdrawProposal, markProjectSeen } = useCosting()
  const p = projectById(state, decodeURIComponent(id))
  const [tab, setTab] = useState<Tab>('overview')
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [addHoles, setAddHoles] = useState(false)
  const [depthOf, setDepthOf] = useState<ProjectHole | null>(null)
  const [depth, setDepth] = useState('')
  const [rates, setRates] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && TABS.some(x => x.value === t)) setTab(t as Tab)
  }, [])

  const events = useMemo(() => p ? eventsFor(state, p.name) : [], [state, p])
  /* Anything the client did that the contractor has not seen is marked new
   * while this screen is open, and counted as seen from now on. */
  useEffect(() => {
    if (!p) return
    const unseen = events.filter(e => !e.seenByContractor)
    if (!unseen.length) return
    setFresh(f => new Set([...Array.from(f), ...unseen.map(e => e.id)]))
    markProjectSeen(p.name, 'contractor')
  }, [events, p, markProjectSeen])

  const busy = useMemo(() => {
    const rig: Record<string, string> = {}, person: Record<string, string> = {}
    ;(state.projects ?? []).filter(x => x.status === 'active' && x.id !== p?.id).forEach(x => {
      x.rigs.forEach(r => { rig[r] = x.code })
      ;[...x.supervisors, ...x.drillers].forEach(n => { person[n] = x.code })
    })
    return { rig, person }
  }, [state.projects, p?.id])
  const takenHoles = useMemo(
    () => Array.from(new Set([...Object.keys(state.holePlans ?? {}), ...state.shiftLogs.map(l => l.holeNumber).filter(Boolean) as string[]])),
    [state.holePlans, state.shiftLogs])

  if (!p) {
    return <Page><Card><Empty>This project does not exist. <Link href="/admin/projects" style={{ color: T.orange, fontWeight: 600 }}>Back to projects</Link></Empty></Card></Page>
  }

  const stats = projectStats(state, p)
  const c = contractOf(state, p.name)
  // Contractors' rigs on this project, beside our own.
  const orders = state.workOrders.filter(o => o.project === p.name && o.status === 'active')
  const theirRigs = orders.flatMap(o => o.rigs)
  const w = words(state.wording)
  const contractorsLink = `/admin/contractors?tab=orders&project=${encodeURIComponent(p.name)}`
  const latest = c.versions[0]
  const minDate = latest && addDays(latest.effectiveFrom, 1) > TODAY ? addDays(latest.effectiveFrom, 1) : TODAY
  const client = p.client
  const fromClient = events.filter(e => fresh.has(e.id))

  const roster = (key: 'rigs' | 'supervisors' | 'drillers', kind: 'rig' | 'crew', word: string) =>
    (next: string[], what: { added?: string; removed?: string }) =>
      updateProject(p.id, { [key]: next } as Partial<ProjectRecord>, {
        kind, title: what.added ? `${what.added} ${kind === 'rig' ? 'assigned' : `added as ${word}`}` : `${what.removed} taken off the project`,
      })

  const setStatus = (s: ProjectStatus) => s !== p.status && updateProject(p.id, { status: s }, {
    kind: 'status', title: s === 'completed' ? 'Project completed' : s === 'on-hold' ? 'Project put on hold' : 'Project active again',
  })
  const setShared = (v: boolean) => updateProject(p.id, { shared: v }, v
    ? { kind: 'shared', title: `Shared with ${client}`, detail: 'Contract rates, planned holes, rigs and crew are now visible in the client login.' }
    : { kind: 'shared', title: `Stopped sharing with ${client}`, detail: 'The project is no longer visible in the client login.' })

  const holeAction = (h: ProjectHole) => {
    if (h.status === 'planned') return (
      <span style={{ display: 'inline-flex', gap: 14 }}>
        <button style={link} onClick={() => { setDepthOf(h); setDepth(String(h.planned ?? '')) }}>Change depth</button>
        <button style={{ ...link, color: T.faint }} onClick={() => planHoles(p.name, [{ id: h.id, plan: null }], 'contractor', { kind: 'hole', title: `${h.id} taken off the plan`, detail: `${h.planned} m had been planned` })}>Remove</button>
      </span>
    )
    if (h.status === 'drilling') return <button style={link} onClick={() => { setDepthOf(h); setDepth(String(h.planned ?? '')) }}>Change depth</button>
    return <Link href={financeLink({ project: p.name, rig: h.rig ?? '', month: monthOf(h.end ?? h.start ?? TODAY), tab: 'Drillholes' })} style={{ ...link, textDecoration: 'none' }}>Open in Finance</Link>
  }

  return (
    <Page>
      <div>
        <Link href="/admin/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.faint, textDecoration: 'none', marginBottom: 10 }}>
          <ArrowLeft size={14} /> Projects
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, fontFamily: display, letterSpacing: '-0.01em' }}>{p.name}</h1>
              <ProjectStatusTag status={p.status} />
              <SharedTag shared={p.shared} client={client} />
            </div>
            <div style={{ fontSize: 14, color: T.muted, marginTop: 7 }}>{p.code} · {client} · {p.location}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={() => setEditing(true)}>Edit details</Btn>
            <Btn kind="primary" onClick={() => { setTab('holes'); setAddHoles(true) }}>Add holes</Btn>
          </div>
        </div>
      </div>

      <div><Seg<Tab> options={TABS} value={tab} onChange={setTab} /></div>

      {tab === 'overview' && (
        <>
          {c.returned && (
            <Note tone="bad">
              <span style={{ fontWeight: 700, color: T.text }}>{client} sent the new rates back.</span> {c.returned.ownerNote ?? 'No reason given.'}{' '}
              <button style={link} onClick={() => setTab('rates')}>Open contract rates</button>
            </Note>
          )}
          {fromClient.length > 0 && (
            <Card title={`New from ${client}`} pad={false}>
              <ChangeList events={fromClient} viewer="contractor" otherSide={client} fresh={fresh} />
            </Card>
          )}
          <Grid min={200}>
            <Tile label="Metres drilled" value={`${n0(stats.drilled)} m`} note={stats.target ? `of ${n0(stats.target)} m · ${n0(stats.toGo)} m on open holes` : 'No quantity set'} />
            <Tile label="Holes" value={stats.holes.length} note={`${stats.counts.drilling} drilling · ${stats.counts.planned} planned · ${stats.counts.done} finished`} />
            <Tile label="On site" value={p.rigs.length ? p.rigs.join(', ') : theirRigs.length ? `${theirRigs.length} ${w.outLower} rigs` : 'No rig'}
              note={theirRigs.length && p.rigs.length ? `plus ${theirRigs.length} ${w.outLower} ${theirRigs.length === 1 ? 'rig' : 'rigs'} · ${p.supervisors.length} supervisors, ${p.drillers.length} drillers` : `${p.supervisors.length} supervisors, ${p.drillers.length} drillers`}
              tone={p.rigs.length || theirRigs.length || p.status !== 'active' ? undefined : 'warn'} />
            <Tile label="Contract rates" value={c.current ? structureWords(c.current) : 'Not set'} tone={c.current ? (c.waiting ? 'warn' : undefined) : 'bad'}
              note={c.waiting ? `A change is waiting for ${client}` : c.current ? `In force since ${fullDate(c.current.effectiveFrom)}` : 'Finance cannot bill this project yet'} />
          </Grid>

          <Split left={2} right={3}>
            <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              <Card title="The contract">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
                  <Fact label="Client">{client}</Fact>
                  <Fact label="Location">{p.location}</Fact>
                  <Fact label="Started">{day(p.startDate)}</Fact>
                  <Fact label="Metres in the contract">{p.plannedMetres ? `${n0(p.plannedMetres)} m` : 'Not fixed'}</Fact>
                  <Fact label="Main core size">{p.holeSize}</Fact>
                  <Fact label="Daily target per rig">{p.dailyTarget ? `${n0(p.dailyTarget)} m` : 'Not set'}</Fact>
                  <Fact label="Status">
                    <select value={p.status} onChange={e => setStatus(e.target.value as ProjectStatus)} aria-label="Project status"
                      style={{ ...inputStyle, padding: '5px 8px', width: 'auto', cursor: 'pointer' }}>
                      {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map(s => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
                    </select>
                  </Fact>
                </div>
              </Card>
              <Card title="Client login">
                {loginOfClient(state.users, client)?.active ? (
                  <Switch on={p.shared} onChange={setShared} label={`Show this project to ${client}`}
                    hint={p.shared
                      ? 'He sees the contract rates, the planned holes, the shift record and his invoices. He never sees your costs, margin or stock.'
                      : 'Turn this on to show the project in his login. Closed holes then go to him for approval and invoices for checking.'} />
                ) : (
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
                    {client} has no client login{loginOfClient(state.users, client) ? ' that is switched on' : ' yet'}, so nobody outside your company sees this project.{' '}
                    <Link href={`/admin/users?new=client&for=${encodeURIComponent(client)}`} style={{ color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Create it under Users</Link>
                  </div>
                )}
              </Card>
            </div>
            <Card title="Latest changes" pad={false} right={<button style={link} onClick={() => setTab('changes')}>See all</button>}>
              <ChangeList events={events} viewer="contractor" otherSide={client} fresh={fresh} limit={6} showSeen={p.shared} />
            </Card>
          </Split>
        </>
      )}

      {tab === 'holes' && (
        <Card title="Holes" pad={false}
          subtitle={`${stats.holes.length} on the plan · ${n0(stats.drilled)} m drilled · ${n0(stats.toGo)} m still to drill.${p.shared ? ` ${client} sees this list and can release holes himself.` : ''}`}
          >
          <HolesTable holes={stats.holes} client={client} contractor="You" action={holeAction} />
        </Card>
      )}

      {tab === 'rates' && (
        <>
          {c.waiting && (
            <Card title={`Waiting for ${client} to accept`} pad={false}
              subtitle={`Sent ${whenIn(c.waiting.proposedAt)} · would start ${fullDate(c.waiting.rate.effectiveFrom)} · ${c.waiting.rate.note ?? ''}`}
              right={<Btn size="sm" onClick={() => withdrawProposal(c.waiting!.id)}>Withdraw</Btn>}>
              <RateSchedule rate={c.waiting.rate} before={c.current} />
              <div style={{ padding: '11px 18px', fontSize: 12.5, color: T.faint, borderTop: `1px solid ${T.line}` }}>
                Until he accepts, every metre is priced at the rates in force below.
              </div>
            </Card>
          )}
          {c.returned && (
            <Note tone="bad">
              <span style={{ fontWeight: 700, color: T.text }}>{client} sent the new rates back{c.returned.answeredAt ? `, ${whenIn(c.returned.answeredAt)}` : ''}.</span>{' '}
              {c.returned.ownerNote ?? 'No reason given.'} The agreed rates stay in force. Change the proposal and send it again.
            </Note>
          )}

          <Card title={c.current ? 'In force' : 'Contract rates'} pad={false}
            subtitle={c.current ? `${structureWords(c.current)} · since ${fullDate(c.current.effectiveFrom)}${c.current.note ? ` · ${c.current.note}` : ''}` : undefined}
            right={<Btn kind={c.current ? 'ghost' : 'primary'} size="sm" onClick={() => setRates(true)}>{c.current ? 'Change rates' : 'Set contract rates'}</Btn>}>
            {c.current ? <RateSchedule rate={c.current} /> : <Empty>No rates yet. Until they are set, Finance cannot price a metre or raise an invoice on this project.</Empty>}
          </Card>

          {c.upcoming.map(u => (
            <Card key={u.id} title={`Agreed, starts ${fullDate(u.effectiveFrom)}`} subtitle={u.note} pad={false}>
              <RateSchedule rate={u} before={c.current} />
            </Card>
          ))}

          {c.versions.length > 1 && (
            <Card title="History" subtitle="Every set of rates this project has had. Work is always priced at the rates in force on the day it was done." pad={false}>
              {c.versions.map((v, i) => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '12px 18px', borderTop: i ? `1px solid ${T.line}` : undefined, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>From {fullDate(v.effectiveFrom)}</div>
                    <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{structureWords(v)}{v.note ? ` · ${v.note}` : ''}</div>
                  </div>
                  {v.id === c.current?.id ? <Status tone="good">In force</Status> : v.effectiveFrom > TODAY ? <Status tone="info">Starts later</Status> : <Status tone="neutral">Replaced</Status>}
                </div>
              ))}
            </Card>
          )}

          <div style={{ fontSize: 12.5, color: T.faint, lineHeight: 1.6, maxWidth: 820 }}>
            These are the rates the client pays. Your own costs — rig, fuel, crew, repairs — stay in Finance under Set costs, and are never part of the project the client sees.
          </div>
        </>
      )}

      {tab === 'team' && (
        <>
          <Roster title={orders.length ? w.ownRigs : 'Rigs'} subtitle="A rig can be on one running project at a time." items={p.rigs} pool={rigPool(state).map(r => r.rig)} busy={busy.rig}
            addLabel="Assign a rig" allowNew newHint="Or type a new rig's name or number" onChange={roster('rigs', 'rig', 'rig')} />
          <Card title={w.outRigs} pad={false}
            subtitle="Rigs a contractor brings under a work order. Their checked shifts count in the same record as your own."
            right={<Btn size="sm" href={contractorsLink}>{orders.length ? 'Open work orders' : 'Bring in a contractor'}</Btn>}>
            {orders.length === 0 && <Empty>None. Every rig on this project is your own.</Empty>}
            {orders.map((o, i) => {
              const pr = workOrderProgress(state, o, TODAY)
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '12px 18px', borderTop: i ? `1px solid ${T.line}` : undefined, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{o.rigs.join(', ')}</div>
                    <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>{contractorOf(state, o.contractorId)?.name} · {o.number} · {n0(pr.metres)} m of {n0(o.plannedMetres)} m · to finish by {day(o.endDate)}</div>
                  </div>
                  {pr.late ? <Status tone="bad">{pr.daysLate} days late</Status> : <Status tone="good">Running</Status>}
                </div>
              )
            })}
          </Card>
          <Split>
            <Roster title="Supervisors" items={p.supervisors} pool={peoplePool(state).supervisors} busy={busy.person} addLabel="Add a supervisor" allowNew onChange={roster('supervisors', 'crew', 'supervisor')} />
            <Roster title="Drillers" items={p.drillers} pool={peoplePool(state).drillers} busy={busy.person} addLabel="Add a driller" allowNew onChange={roster('drillers', 'crew', 'driller')} />
          </Split>
          <div style={{ fontSize: 12.5, color: T.faint, lineHeight: 1.6, maxWidth: 820 }}>
            Bits, rods and other parts are not listed on the project. They are issued to each rig in <Link href="/admin/inventory" style={{ color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Parts &amp; inventory</Link>.
            {p.shared && <> {client} is told when a rig or a person joins or leaves his site.</>}
          </div>
        </>
      )}

      {tab === 'changes' && (
        <Card title="Changes" subtitle={p.shared ? `Every change on this project. ${client} reads the same list.` : 'Every change on this project.'} pad={false}>
          <ChangeList events={events} viewer="contractor" otherSide={client} fresh={fresh} showSeen={p.shared} />
        </Card>
      )}

      {addHoles && (
        <AddHolesModal title="Add holes" taken={takenHoles} defaultSize={p.holeSize} series={{ mine: stats.holes.map(h => h.id), start: holeSeriesStart(p.code) }} confirm="Add to the plan"
          subtitle={p.shared ? `${client} will see them in his portal at once.` : 'They appear in the forecast and in the drill log.'}
          onClose={() => setAddHoles(false)}
          onAdd={holes => {
            planHoles(p.name, holes, 'contractor', {
              kind: 'hole', title: `${holes.length} ${holes.length === 1 ? 'hole' : 'holes'} added to the plan`,
              detail: holes.map(h => `${h.id} (${h.plan.plannedDepth} m)`).join(', '),
            })
            setAddHoles(false)
          }} />
      )}

      {depthOf && (
        <Modal title={`Planned depth of ${depthOf.id}`} width={440} onClose={() => setDepthOf(null)}
          subtitle={depthOf.drilled > 0 ? `${n0(depthOf.drilled)} m drilled so far.` : undefined}
          footer={<><Btn onClick={() => setDepthOf(null)}>Cancel</Btn>
            <Btn kind="primary" disabled={!(parseFloat(depth) > 0) || parseFloat(depth) < depthOf.drilled || parseFloat(depth) === depthOf.planned}
              onClick={() => {
                planHoles(p.name, [{ id: depthOf.id, plan: { plannedDepth: parseFloat(depth) } }], 'contractor', {
                  kind: 'hole', title: `${depthOf.id} planned depth changed`, detail: `${depthOf.planned ?? '—'} m → ${parseFloat(depth)} m`,
                })
                setDepthOf(null)
              }}>Save</Btn></>}>
          <Field label="Planned depth, m" hint={parseFloat(depth) < depthOf.drilled ? 'Cannot be less than what is already drilled.' : undefined}>
            <input type="number" value={depth} onChange={e => setDepth(e.target.value)} autoFocus style={{ ...inputStyle, textAlign: 'right' }} />
          </Field>
        </Modal>
      )}

      {rates && <RatesModal project={p} current={c.versions[0]} minDate={minDate} onClose={() => setRates(false)}
        onSave={r => { proposeRates(p.name, r); setRates(false) }} />}

      {editing && <DetailsModal p={p} onClose={() => setEditing(false)} onSave={(patch, detail) => {
        updateProject(p.id, patch, detail ? { kind: 'details', title: 'Project details changed', detail } : undefined)
        setEditing(false)
      }} />}
    </Page>
  )
}

function DetailsModal({ p, onClose, onSave }: { p: ProjectRecord; onClose: () => void; onSave: (patch: Partial<ProjectRecord>, detail: string) => void }) {
  const [f, setF] = useState({ location: p.location, client: p.client, plannedMetres: p.plannedMetres ? String(p.plannedMetres) : '', holeSize: p.holeSize, dailyTarget: p.dailyTarget ? String(p.dailyTarget) : '' })
  const metres = parseFloat(f.plannedMetres) || undefined
  const target = parseFloat(f.dailyTarget) || undefined
  const changes = [
    f.client.trim() !== p.client && `client ${p.client} → ${f.client.trim()}`,
    f.location.trim() !== p.location && `location ${p.location} → ${f.location.trim()}`,
    metres !== p.plannedMetres && `metres in the contract ${p.plannedMetres ?? 'not fixed'} → ${metres ?? 'not fixed'}`,
    f.holeSize !== p.holeSize && `main core size ${p.holeSize} → ${f.holeSize}`,
    target !== p.dailyTarget && `daily target ${p.dailyTarget ? `${p.dailyTarget} m` : 'none'} → ${target ? `${target} m` : 'none'}`,
  ].filter(Boolean) as string[]
  return (
    <Modal title="Project details" width={560} onClose={onClose}
      subtitle="The project name cannot be changed: shifts, rates and invoices are filed under it."
      footer={<><Btn onClick={onClose}>Cancel</Btn>
        <Btn kind="primary" disabled={!changes.length || !f.client.trim() || !f.location.trim()}
          onClick={() => onSave({ client: f.client.trim(), location: f.location.trim(), plannedMetres: metres, holeSize: f.holeSize, dailyTarget: target }, listOf(changes))}>Save</Btn></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Client"><input value={f.client} onChange={e => setF({ ...f, client: e.target.value })} style={inputStyle} /></Field>
        <Field label="Location"><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} style={inputStyle} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Metres in the contract"><input type="number" value={f.plannedMetres} onChange={e => setF({ ...f, plannedMetres: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} /></Field>
          <Field label="Main core size">
            <select value={f.holeSize} onChange={e => setF({ ...f, holeSize: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              {HOLE_SIZES.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Daily target, metres per rig" hint="Your KPI. The Dashboard flags a rig that falls under it. The client never sees it.">
          <input type="number" min={0} value={f.dailyTarget} onChange={e => setF({ ...f, dailyTarget: e.target.value })} placeholder="e.g. 18" style={{ ...inputStyle, textAlign: 'right' }} />
        </Field>
      </div>
    </Modal>
  )
}
