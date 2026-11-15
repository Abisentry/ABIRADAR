import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTitle, Card, Stat, Empty, SevBadge, Progress } from './ui.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'
import { timeAgo } from '../lib/time.js'

export default function AdminOverview() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  usePoll(() => api('/admin/overview').then(setD).catch((e) => setError(e.message)), 15000)
  if (error) return <p role="alert" className="text-signal">{error}</p>
  if (!d) return <p className="text-fg/60">Loading…</p>
  const { institutions: i, responses: r } = d

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Platform overview</h1><p className="mt-2 max-w-2xl text-fg/70">Every institution on AbiSentry Gossip, and how they are responding to the alerts you send.</p></div>
        <Link to="/dashboard/admin/alerts/new" className="btn-primary">Send an alert</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Institutions" value={i.total} />
        <Stat label="Waiting for approval" value={i.pending} tone={i.pending ? 'text-amber' : ''} />
        <Stat label="Approved" value={i.approved} tone="text-mint" />
        <Stat label="Rejected" value={i.rejected} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="People on the platform" value={d.people} />
        <Stat label="Alerts sent" value={d.alertsSent} />
        <Stat label="Waiting for a response" value={r.open} tone={r.open ? 'text-amber' : ''} />
        <Stat label="Done" value={r.done} tone="text-mint" />
        <Stat label="Not applicable" value={r.notApplicable} />
        <Stat label="Reports to review" value={d.newReports} tone={d.newReports ? 'text-amber' : ''} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-bold">Waiting for approval</h2>
          {!d.pending.length ? <div className="mt-3"><Empty>Nobody is waiting.</Empty></div> : (
            <ul className="mt-3">
              {d.pending.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
                  <div className="min-w-0"><p className="font-medium">{o.name}</p><p className="truncate text-sm text-fg/60">{o.type} · {o.country} · {o.owner.email} · {timeAgo(o.createdAt)}</p></div>
                  <Link to={`/dashboard/admin/institutions/${o.id}`} className="btn-ghost shrink-0 !px-3 !py-1.5">Review</Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/dashboard/admin/institutions" className="mt-3 inline-block text-sm font-semibold text-cyan hover:underline">See all institutions</Link>
        </Card>
        <Card>
          <h2 className="font-display text-xl font-bold">Latest alerts you sent</h2>
          {!d.recentAlerts.length ? <div className="mt-3"><Empty>You have not sent an alert yet.</Empty></div> : (
            <ul className="mt-3">
              {d.recentAlerts.map((a) => (
                <li key={a.id} className="border-t border-line py-3 first:border-t-0">
                  <div className="flex items-center gap-3"><SevBadge severity={a.severity} /><span className="text-xs text-fg/50">{timeAgo(a.sentAt)}</span></div>
                  <Link to={`/dashboard/admin/alerts/${a.id}`} className="mt-1 block font-medium hover:text-cyan">{a.title}</Link>
                  <div className="mt-1"><Progress s={a.stats} /></div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/dashboard/admin/alerts" className="mt-3 inline-block text-sm font-semibold text-cyan hover:underline">See all alerts</Link>
        </Card>
      </div>
    </>
  )
}
