import { useState } from 'react'
import { Card, Empty, PageTitle } from './ui.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'
import { timeAgo } from '../lib/time.js'
import { steps } from '../data/questions.js'

const TYPES = steps.find((s) => s.id === 'org').fields.find((f) => f.name === 'orgType').options.map((o) => o.value)
const blank = { title: '', period: '', cadence: 'weekly', body: '', audience: [], published: false }

// Used for both fraud reviews (kind "review") and community advisories (kind "community").
export default function AdminPosts({ kind, embedded = false }) {
  const review = kind === 'review'
  const [posts, setPosts] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | post id
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const load = () => api(`/admin/posts?kind=${kind}`).then((d) => setPosts(d.posts)).catch((e) => setError(e.message))
  usePoll(load, 60000, [kind])

  const open = (p) => { setEditing(p ? p.id : 'new'); setF(p ? { title: p.title, period: p.period || '', cadence: p.cadence || 'weekly', body: p.body, audience: p.audience, published: p.published } : blank); setError('') }
  const toggle = (t) => setF((s) => ({ ...s, audience: s.audience.includes(t) ? s.audience.filter((x) => x !== t) : [...s.audience, t] }))
  const save = async (ev) => {
    ev.preventDefault(); setError('')
    const body = { kind, title: f.title, body: f.body, audience: f.audience, published: f.published, period: review ? f.period || null : null, cadence: review ? f.cadence : null }
    try { await api(editing === 'new' ? '/admin/posts' : `/admin/posts/${editing}`, { method: editing === 'new' ? 'POST' : 'PUT', body }); setEditing(null); load() }
    catch (err) { setError(err.message) }
  }
  const remove = (p) => window.confirm(`Delete “${p.title}”?`) && api(`/admin/posts/${p.id}`, { method: 'DELETE' }).then(() => { setEditing(null); load() }).catch((e) => setError(e.message))

  return (
    <>
      {embedded ? (
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-xl font-bold">Advisories you publish</h2><button className="btn-primary" onClick={() => open(null)}>Write an advisory</button></div>
      ) : (
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-3xl font-bold">Fraud reviews</h1><p className="mt-2 max-w-2xl text-fg/70">Weekly or monthly reviews of fraud trends. Institutions read them under Weekly / Monthly Reports. Leave the audience empty to reach everyone.</p></div>
          <button className="btn-primary" onClick={() => open(null)}>Write a review</button>
        </div>
      )}
      {error && !editing && <p role="alert" className="mb-3 text-sm text-signal">{error}</p>}
      {editing && (
        <Card className="mb-6 max-w-3xl">
          <h2 className="font-display text-xl font-bold">{editing === 'new' ? (review ? 'New review' : 'New advisory') : 'Edit'}</h2>
          <form onSubmit={save} className="mt-4 space-y-4">
            <div><label htmlFor="pt" className="mb-1.5 block text-sm font-semibold">Title</label><input id="pt" className="field" maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            {review && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="cd" className="mb-1.5 block text-sm font-semibold">Kind</label><select id="cd" className="field" value={f.cadence} onChange={(e) => setF({ ...f, cadence: e.target.value })}><option value="weekly">Weekly review</option><option value="monthly">Monthly review</option></select></div>
                <div><label htmlFor="pr" className="mb-1.5 block text-sm font-semibold">Period</label><input id="pr" className="field" maxLength={60} placeholder="Week of 5 Oct 2026" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></div>
              </div>
            )}
            <div><label htmlFor="bd" className="mb-1.5 block text-sm font-semibold">Text <span className="font-normal text-fg/50">(leave a blank line between paragraphs)</span></label><textarea id="bd" rows={10} maxLength={10000} className="field" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
            <fieldset><legend className="mb-1.5 text-sm font-semibold">Who can read it <span className="font-normal text-fg/50">(none ticked means everyone)</span></legend>
              <div className="grid gap-1.5 text-sm sm:grid-cols-2">{TYPES.map((t) => <label key={t} className="flex items-center gap-2"><input type="checkbox" checked={f.audience.includes(t)} onChange={() => toggle(t)} /> {t}</label>)}</div></fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Published (institutions can see it)</label>
            {error && <p role="alert" className="text-sm text-signal">{error}</p>}
            <div className="flex gap-3"><button className="btn-primary" disabled={!f.title.trim() || !f.body.trim()}>Save</button><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
          </form>
        </Card>
      )}
      <div className="max-w-3xl">
        {posts && !posts.length && <Empty>Nothing here yet.</Empty>}
        <ul className="space-y-3">
          {(posts || []).map((p) => (
            <li key={p.id}><Card className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-display text-lg font-bold">{p.title}</p>
                <p className="text-sm text-fg/60">{p.published ? <span className="text-mint">Published {timeAgo(p.publishedAt)}</span> : <span className="text-amber">Draft</span>}{p.period ? ` · ${p.period}` : ''} · {p.audience.length ? p.audience.join(', ') : 'Everyone'}</p></div>
              <div className="flex gap-2"><button className="btn-ghost !px-3 !py-1.5" onClick={() => open(p)}>Edit</button><button className="btn-ghost !px-3 !py-1.5 !text-signal" onClick={() => remove(p)}>Delete</button></div>
            </Card></li>
          ))}
        </ul>
      </div>
    </>
  )
}
