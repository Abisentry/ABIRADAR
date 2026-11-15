import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PageTitle, Card, Empty, Prose } from './ui.jsx'
import { api } from '../lib/api.js'
import { timeAgo } from '../lib/time.js'

const WORD = { new: 'Received', reviewed: 'Reviewed by AbiSentry', dismissed: 'Closed' }

export default function Community() {
  const { organisation: org } = useOutletContext()
  const canReport = org?.permissions?.includes('alerts:handle')
  const [posts, setPosts] = useState(null)
  const [mine, setMine] = useState([])
  const [f, setF] = useState({ title: '', details: '', anonymous: true })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const loadMine = () => api('/community/reports').then((d) => setMine(d.reports)).catch(() => {})
  useEffect(() => { api('/posts?kind=community').then((d) => setPosts(d.posts)).catch(() => setPosts([])); loadMine() }, [])

  const submit = async (e) => {
    e.preventDefault(); setError(''); setMsg('')
    try { await api('/community/reports', { method: 'POST', body: f }); setF({ title: '', details: '', anonymous: true }); setMsg('Thank you. The AbiSentry team will review your report.'); loadMine() }
    catch (err) { setError(err.message) }
  }

  return (
    <>
      <PageTitle title="Community reporting" intro="Warnings from AbiSentry, and a way for you to tell us about fraud attempts so other institutions can be warned." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 font-display text-xl font-bold">Advisories from AbiSentry</h2>
          {!posts ? <p className="text-fg/60">Loading…</p> : !posts.length ? <Empty>No advisories yet.</Empty> : (
            <div className="space-y-3">{posts.map((p) => (
              <Card key={p.id} className="!p-0"><details><summary className="cursor-pointer list-none p-5"><span className="font-display text-lg font-bold">{p.title}</span>
                <span className="mt-1 block text-sm text-fg/60">{timeAgo(p.publishedAt)}</span></summary><div className="border-t border-line p-5"><Prose text={p.body} /></div></details></Card>))}</div>
          )}
        </div>
        <div className="space-y-6 self-start">
          {canReport && (
            <Card>
              <h2 className="font-display text-xl font-bold">Report a fraud attempt</h2>
              <p className="mt-1 text-sm text-fg/70">Tell us what happened. We check it, and may warn other institutions.</p>
              <form onSubmit={submit} className="mt-4 space-y-4">
                <div><label htmlFor="rt" className="mb-1.5 block text-sm font-semibold">Short title</label><input id="rt" className="field" maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                <div><label htmlFor="rd" className="mb-1.5 block text-sm font-semibold">What happened</label><textarea id="rd" rows={5} maxLength={3000} className="field" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></div>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /> Keep our institution's name out of anything shared with others.</label>
                {error && <p role="alert" className="text-sm text-signal">{error}</p>}
                {msg && <p role="status" className="text-sm text-mint">{msg}</p>}
                <button className="btn-primary" disabled={!f.title.trim() || !f.details.trim()}>Send report</button>
              </form>
            </Card>
          )}
          {mine.length > 0 && (
            <Card><h2 className="font-display text-lg font-bold">Your reports</h2>
              <ul className="mt-2">{mine.map((r) => (<li key={r.id} className="border-t border-line py-3 text-sm first:border-t-0"><p className="font-medium">{r.title}</p>
                <p className="text-fg/60">{WORD[r.status]} · {timeAgo(r.createdAt)}</p>{r.reviewNote && <p className="mt-1 text-fg/75">“{r.reviewNote}”</p>}</li>))}</ul></Card>
          )}
        </div>
      </div>
    </>
  )
}
