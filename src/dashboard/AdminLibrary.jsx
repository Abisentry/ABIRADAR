import { useState } from 'react'
import { PageTitle, Card, Empty } from './ui.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'

const lines = (t) => t.split('\n').map((s) => s.trim()).filter(Boolean)
const blank = { name: '', summary: '', signs: '', steps: '', published: true, sort: 50 }
const toForm = (e) => ({ name: e.name, summary: e.summary, signs: e.signs.join('\n'), steps: e.steps.join('\n'), published: e.published, sort: e.sort })

export default function AdminLibrary() {
  const [entries, setEntries] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | entry id
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const load = () => api('/admin/library').then((d) => setEntries(d.entries)).catch((e) => setError(e.message))
  usePoll(load, 60000)

  const open = (e) => { setEditing(e ? e.id : 'new'); setF(e ? toForm(e) : { ...blank, sort: (entries?.length || 0) + 1 }); setError('') }
  const save = async (ev) => {
    ev.preventDefault(); setError('')
    const body = { name: f.name, summary: f.summary, signs: lines(f.signs), steps: lines(f.steps), published: f.published, sort: Number(f.sort) || 0 }
    try { await api(editing === 'new' ? '/admin/library' : `/admin/library/${editing}`, { method: editing === 'new' ? 'POST' : 'PUT', body }); setEditing(null); load() }
    catch (err) { setError(err.message) }
  }
  const remove = (e) => window.confirm(`Delete “${e.name}”? Institutions will no longer see it.`) && api(`/admin/library/${e.id}`, { method: 'DELETE' }).then(() => { setEditing(null); load() }).catch((err) => setError(err.message))

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Fraud library and playbooks</h1><p className="mt-2 max-w-2xl text-fg/70">What institutions read in their Fraud Library and Playbooks pages. Changes appear for everyone straight away. Entries can also be used as the starting steps for an alert.</p></div>
        <button className="btn-primary" onClick={() => open(null)}>Add an entry</button>
      </div>
      {error && !editing && <p role="alert" className="mb-3 text-sm text-signal">{error}</p>}
      {editing && (
        <Card className="mb-6 max-w-3xl">
          <h2 className="font-display text-xl font-bold">{editing === 'new' ? 'New entry' : 'Edit entry'}</h2>
          <form onSubmit={save} className="mt-4 space-y-4">
            <div><label htmlFor="n" className="mb-1.5 block text-sm font-semibold">Name</label><input id="n" className="field" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <p className="mt-1 text-xs text-fg/50">Names that match a threat chosen at signup (for example “Phishing”) are shown first to those institutions.</p></div>
            <div><label htmlFor="s" className="mb-1.5 block text-sm font-semibold">What it is</label><textarea id="s" rows={2} maxLength={600} className="field" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></div>
            <div><label htmlFor="g" className="mb-1.5 block text-sm font-semibold">Warning signs <span className="font-normal text-fg/50">(one per line)</span></label><textarea id="g" rows={4} className="field" value={f.signs} onChange={(e) => setF({ ...f, signs: e.target.value })} /></div>
            <div><label htmlFor="p" className="mb-1.5 block text-sm font-semibold">Response steps <span className="font-normal text-fg/50">(one per line, in order)</span></label><textarea id="p" rows={5} className="field" value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} /></div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Visible to institutions</label>
              <label className="flex items-center gap-2 text-sm">Order <input type="number" min="0" max="1000" className="field !w-24 !py-1.5" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} /></label>
            </div>
            {error && <p role="alert" className="text-sm text-signal">{error}</p>}
            <div className="flex gap-3"><button className="btn-primary" disabled={!f.name.trim() || !f.summary.trim() || !lines(f.steps).length}>Save</button><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
          </form>
        </Card>
      )}
      <div className="max-w-3xl">
        {entries && !entries.length && <Empty>No entries yet.</Empty>}
        <ul className="space-y-3">
          {(entries || []).map((e) => (
            <li key={e.id}><Card className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-display text-lg font-bold">{e.name}</p><p className="text-sm text-fg/60">{e.signs.length} warning signs · {e.steps.length} steps · {e.published ? <span className="text-mint">Visible</span> : <span className="text-amber">Hidden</span>}</p></div>
              <div className="flex gap-2"><button className="btn-ghost !px-3 !py-1.5" onClick={() => open(e)}>Edit</button><button className="btn-ghost !px-3 !py-1.5 !text-signal" onClick={() => remove(e)}>Delete</button></div>
            </Card></li>
          ))}
        </ul>
      </div>
    </>
  )
}
