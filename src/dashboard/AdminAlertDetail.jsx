import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, SevBadge, StatusPill, Progress } from './ui.jsx'
import History from './History.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'
import { timeAgo } from '../lib/time.js'

export default function AdminAlertDetail() {
  const { id } = useParams()
  const [a, setA] = useState(null)
  const [error, setError] = useState('')
  const load = () => api(`/admin/alerts/${id}`).then((d) => { setA(d); setError('') }).catch((e) => setError(e.message))
  usePoll(load, 10000, [id])
  const withdraw = () => window.confirm('Withdraw this alert? Institutions will see it as withdrawn and it stops counting as waiting for action.') &&
    api(`/admin/alerts/${id}/withdraw`, { method: 'POST' }).then(load).catch((e) => setError(e.message))

  if (error) return <p role="alert" className="text-signal">{error}</p>
  if (!a) return <p className="text-fg/60">Loading…</p>

  return (
    <>
      <Link to="/dashboard/admin/alerts" className="mb-4 inline-block text-sm text-cyan hover:underline">All alerts</Link>
      <div className="flex flex-wrap items-center gap-3"><SevBadge severity={a.severity} /><span className="text-sm text-fg/60">sent {timeAgo(a.sentAt)} by {a.sentBy}</span>{a.withdrawn && <span className="text-sm text-signal">Withdrawn</span>}</div>
      <h1 className="mt-2 text-3xl font-bold">{a.title}</h1>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-bold">What you told them</h2>
          <p className="mt-3 whitespace-pre-line text-fg/80">{a.summary}</p>
          <p className="mt-4 text-sm font-semibold">What to do</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-fg/80">{a.actions.map((s, i) => <li key={i}>{s}</li>)}</ol>
          {!a.withdrawn && <button className="btn-ghost mt-5 !px-3 !py-1.5" onClick={withdraw}>Withdraw this alert</button>}
        </Card>
        <Card className="self-start">
          <h2 className="font-display text-xl font-bold">Responses</h2>
          <p className="mt-3 text-sm text-fg/70">{a.stats.total} institution{a.stats.total === 1 ? '' : 's'} received it.</p>
          <div className="mt-2"><Progress s={a.stats} /></div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-xl font-bold">By institution</h2>
        <ul className="mt-3">
          {a.deliveries.map((d) => (
            <li key={d.id} className="border-t border-line py-4 first:border-t-0">
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/dashboard/admin/institutions/${d.orgId}`} className="font-medium text-cyan hover:underline">{d.orgName}</Link>
                <StatusPill status={d.status} /><span className="text-xs text-fg/50">updated {timeAgo(d.updatedAt)}</span>
              </div>
              <div className="mt-3"><History history={d.history} /></div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
