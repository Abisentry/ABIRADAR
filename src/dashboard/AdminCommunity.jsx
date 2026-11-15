import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTitle, Card, Empty } from './ui.jsx'
import AdminPosts from './AdminPosts.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'
import { timeAgo } from '../lib/time.js'

const pill = (on) => `rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-cyan bg-cyan text-bg' : 'border-line hover:border-cyan'}`

export default function AdminCommunity() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('new')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState({})
  const load = () => api(`/admin/incident-reports?status=${tab}`).then((d) => { setData(d); setError('') }).catch((e) => setError(e.message))
  usePoll(load, 15000, [tab])
  const mark = (id, status) => api(`/admin/incident-reports/${id}`, { method: 'PATCH', body: { status, note: notes[id] || undefined } }).then(load).catch((e) => setError(e.message))
  const toAlert = (r) => navigate('/dashboard/admin/alerts/new', { state: { title: r.title, summary: r.details } })

  return (
    <>
      <PageTitle title="Community" intro="What institutions report to you, and the advisories you publish back to them." />
      <h2 className="mb-3 font-display text-xl font-bold">Reports from institutions</h2>
      <div className="mb-4 flex gap-2" role="group" aria-label="Status">
        {[['new', `New${data && tab === 'new' ? ` (${data.newCount})` : ''}`], ['reviewed', 'Reviewed'], ['dismissed', 'Dismissed']].map(([v, l]) => <button key={v} className={pill(tab === v)} aria-pressed={tab === v} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-signal">{error}</p>}
      <div className="mb-10 max-w-3xl space-y-3">
        {data && !data.reports.length && <Empty>No reports here.</Empty>}
        {data?.reports.map((r) => (
          <Card key={r.id}>
            <p className="font-display text-lg font-bold">{r.title}</p>
            <p className="mt-1 text-sm text-fg/60">{r.orgName} · {r.orgType} · {r.by} · {timeAgo(r.createdAt)}{r.anonymous && <span className="text-amber"> · asked to stay anonymous when shared</span>}</p>
            <p className="mt-3 whitespace-pre-line text-fg/80">{r.details}</p>
            {r.reviewNote && <p className="mt-2 text-sm text-fg/60">Your note: “{r.reviewNote}”</p>}
            <label htmlFor={`rn${r.id}`} className="mt-4 block text-sm font-semibold">Note back to them <span className="font-normal text-fg/50">(optional)</span></label>
            <input id={`rn${r.id}`} className="field mt-1.5" maxLength={500} value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary !px-3 !py-1.5" onClick={() => toAlert(r)}>Write an alert from this</button>
              {r.status !== 'reviewed' && <button className="btn-ghost !px-3 !py-1.5" onClick={() => mark(r.id, 'reviewed')}>Mark reviewed</button>}
              {r.status !== 'dismissed' && <button className="btn-ghost !px-3 !py-1.5" onClick={() => mark(r.id, 'dismissed')}>Dismiss</button>}
            </div>
          </Card>
        ))}
      </div>
      <AdminPosts kind="community" embedded />
    </>
  )
}
