import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PageTitle, Card, Chip, Empty, SevBadge, StatusPill } from './ui.jsx'
import History from './History.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'
import { timeAgo } from '../lib/time.js'

const pill = (on) => `rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-cyan bg-cyan text-bg' : 'border-line hover:border-cyan'}`
const PROMPT = { done: 'What did you do to protect your systems?', not_applicable: 'Why does this not apply to your institution?' }

export default function Alerts() {
  const { organisation: org } = useOutletContext()
  const [status, setStatus] = useState('open')
  const [severity, setSeverity] = useState('all')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState(null) // { id, status } while a note is being written
  const [note, setNote] = useState('')
  const p = org?.profile || {}
  const canHandle = org?.permissions?.includes('alerts:handle')

  const load = () => api(`/alerts?status=${status}&severity=${severity}`).then((d) => { setData(d); setError('') }).catch((e) => setError(e.message))
  usePoll(load, 8000, [status, severity])
  const act = (id, s, text) => api(`/alerts/${id}`, { method: 'PATCH', body: { status: s, note: text } })
    .then(() => { setAsking(null); setNote(''); load() }).catch((e) => setError(e.message))

  return (
    <>
      <PageTitle title="Fraud alerts" intro="Alerts from the AbiSentry team about threats that could affect you, with what to do about each one. When you finish, note what your team did: it is kept as your record." />
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
              {[['open', 'Waiting for action'], ['done', 'Done'], ['not_applicable', 'Not applicable'], ['all', 'All']].map(([v, l]) => <button key={v} className={pill(status === v)} aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label="Severity">
              {[['all', 'Any severity'], ['critical', 'Critical'], ['warning', 'Warning'], ['info', 'Advisory']].map(([v, l]) => <button key={v} className={pill(severity === v)} aria-pressed={severity === v} onClick={() => setSeverity(v)}>{l}</button>)}
            </div>
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-signal">{error}</p>}
          {!data ? <p className="text-fg/60">Loading…</p> : !data.alerts.length ? (
            <Empty>{status === 'open' ? 'Nothing is waiting. When we see a threat that could affect you, it appears here and in your email.' : 'Nothing to show for this filter.'}</Empty>
          ) : (
            <ul>
              {data.alerts.map((a) => {
                const closed = ['done', 'not_applicable'].includes(a.status)
                const last = [...a.history].reverse().find((h) => h.note)
                return (
                  <li key={a.id} className="border-t border-line py-5 first:border-t-0">
                    <div className="flex flex-wrap items-center gap-3"><SevBadge severity={a.severity} /><StatusPill status={a.status} />{a.withdrawn && <span className="text-xs text-fg/50">Withdrawn by AbiSentry</span>}<span className="text-xs text-fg/50">{timeAgo(a.sentAt)}</span></div>
                    <h2 className="mt-2 font-display text-xl font-bold">{a.title}</h2>
                    <p className="mt-2 whitespace-pre-line text-fg/80">{a.summary}</p>
                    <p className="mt-4 text-sm font-semibold">What to do</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-fg/80">{a.actions.map((s, i) => <li key={i}>{s}</li>)}</ol>
                    {closed && last && <p className="mt-4 text-sm text-fg/70">What your team recorded: “{last.note}”</p>}
                    <details className="mt-3 text-sm"><summary className="cursor-pointer text-cyan">History</summary><div className="mt-3"><History history={a.history} /></div></details>

                    {canHandle && !a.withdrawn && (asking?.id === a.id ? (
                      <div className="mt-4">
                        <label htmlFor={`n${a.id}`} className="block text-sm font-semibold">{PROMPT[asking.status]}</label>
                        <textarea id={`n${a.id}`} rows={3} maxLength={500} autoFocus className="field mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
                        <div className="mt-2 flex gap-2">
                          <button className="btn-primary !px-3 !py-1.5" disabled={note.trim().length < 3} onClick={() => act(a.id, asking.status, note)}>Save</button>
                          <button className="btn-ghost !px-3 !py-1.5" onClick={() => { setAsking(null); setNote('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {a.status === 'new' && <button className="btn-ghost !px-3 !py-1.5" onClick={() => act(a.id, 'in_progress')}>Start working on it</button>}
                        {!closed && <>
                          <button className="btn-primary !px-3 !py-1.5" onClick={() => { setAsking({ id: a.id, status: 'done' }); setNote('') }}>Mark as done</button>
                          <button className="btn-ghost !px-3 !py-1.5" onClick={() => { setAsking({ id: a.id, status: 'not_applicable' }); setNote('') }}>Not applicable</button>
                        </>}
                        {closed && <button className="btn-ghost !px-3 !py-1.5" onClick={() => act(a.id, 'new')}>Reopen</button>}
                      </div>
                    ))}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card className="self-start">
          <h2 className="font-display text-lg font-bold">How we reach you</h2>
          <p className="mt-3 text-sm text-fg/60">Channels you chose</p>
          <ul className="mt-2 flex flex-wrap gap-2">{(p.channels || []).map((c) => <Chip key={c}>{c}</Chip>)}</ul>
          <p className="mt-4 text-sm text-fg/60">Email is live: owners, admins and analysts receive each alert. SMS, WhatsApp and chat are coming.</p>
        </Card>
      </div>
    </>
  )
}
