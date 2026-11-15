import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PageTitle, Card, Stat, Empty, Prose, SEV, SEV_LABEL } from './ui.jsx'
import { api } from '../lib/api.js'

const pill = (on) => `rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-cyan bg-cyan text-bg' : 'border-line hover:border-cyan'}`
const hrs = (h) => (h === null ? 'No data' : h < 1 ? `${Math.round(h * 60)} min` : `${h} hours`)
const STATUS_WORD = { done: 'Done', not_applicable: 'Not applicable' }

function Bars({ rows, color = 'bg-cyan' }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return <ul className="mt-3 space-y-2">{rows.map((r) => (
    <li key={r.name} className="text-sm"><div className="flex justify-between"><span>{r.name}</span><span className="text-fg/60">{r.count}</span></div>
      <div className="mt-1 h-2 rounded bg-bg"><div className={`h-2 rounded ${r.color || color}`} style={{ width: `${(r.count / max) * 100}%` }} /></div></li>
  ))}</ul>
}

function MyReport() {
  const [cadence, setCadence] = useState('weekly')
  const [offset, setOffset] = useState(0)
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { setR(null); api(`/reports/summary?cadence=${cadence}&offset=${offset}`).then((d) => { setR(d); setError('') }).catch((e) => setError(e.message)) }, [cadence, offset])

  const delta = r ? r.received - r.previous.received : 0
  const open = r ? r.outcomes.new + r.outcomes.inProgress : 0
  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        {[['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) => <button key={v} className={pill(cadence === v)} aria-pressed={cadence === v} onClick={() => { setCadence(v); setOffset(0) }}>{l}</button>)}
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-ghost !px-3 !py-1.5" disabled={offset >= 11} onClick={() => setOffset(offset + 1)}>Earlier</button>
          <button className="btn-ghost !px-3 !py-1.5" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>Later</button>
          <button className="btn-primary !px-3 !py-1.5" onClick={() => window.print()}>Print or save as PDF</button>
        </div>
      </div>
      {error && <p role="alert" className="text-signal">{error}</p>}
      {!r ? !error && <p className="text-fg/60">Loading…</p> : (
        <>
          <h2 className="font-display text-2xl font-bold">{r.period.label}</h2>
          {r.received === 0 ? <div className="mt-4"><Empty>No alerts were sent to your institution in this period.</Empty></div> : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Alerts received" value={r.received} />
                <Stat label="Done" value={r.outcomes.done} tone="text-mint" />
                <Stat label="Not applicable" value={r.outcomes.notApplicable} />
                <Stat label="Still open" value={open} tone={open ? 'text-amber' : ''} />
              </div>
              <p className="mt-3 text-sm text-fg/60">{delta === 0 ? 'The same number as the period before.' : `${Math.abs(delta)} ${delta > 0 ? 'more' : 'fewer'} than the period before (${r.previous.received}).`}{r.withdrawn > 0 && ` ${r.withdrawn} withdrawn by AbiSentry.`}</p>
              <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <Card><h3 className="font-display text-lg font-bold">How fast you responded</h3>
                  <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><dt className="text-fg/60">First response, on average</dt><dd>{hrs(r.avgHoursToFirstResponse)}</dd></div>
                    <div className="flex justify-between"><dt className="text-fg/60">Finished, on average</dt><dd>{hrs(r.avgHoursToClose)}</dd></div>
                    <div className="flex justify-between"><dt className="text-fg/60">Responded within 24 hours</dt><dd>{r.respondedWithin24h} of {r.received - r.withdrawn}</dd></div></dl></Card>
                <Card><h3 className="font-display text-lg font-bold">By seriousness</h3>
                  <Bars rows={['critical', 'warning', 'info'].map((s) => ({ name: SEV_LABEL[s], count: r.bySeverity[s], color: SEV[s] }))} /></Card>
                <Card><h3 className="font-display text-lg font-bold">By type of threat</h3>{r.byThreat.length ? <Bars rows={r.byThreat} /> : <p className="mt-3 text-sm text-fg/60">None.</p>}</Card>
              </div>
              <Card className="mt-6">
                <h3 className="font-display text-lg font-bold">What your team did</h3>
                {!r.actions.length ? <p className="mt-3 text-sm text-fg/60">No notes were recorded in this period.</p> : (
                  <ul className="mt-3">{r.actions.map((a, i) => (
                    <li key={i} className="border-t border-line py-3 text-sm first:border-t-0"><p className="font-medium">{a.title} <span className="font-normal text-fg/50">· {STATUS_WORD[a.status]}</span></p>
                      <p className="mt-1 text-fg/75">“{a.note}” <span className="text-fg/50">by {a.by}</span></p></li>))}</ul>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </>
  )
}

function Reviews() {
  const [posts, setPosts] = useState(null)
  useEffect(() => { api('/posts?kind=review').then((d) => setPosts(d.posts)).catch(() => setPosts([])) }, [])
  if (!posts) return <p className="text-fg/60">Loading…</p>
  if (!posts.length) return <Empty>No reviews have been published yet.</Empty>
  return (
    <div className="max-w-3xl space-y-3">
      {posts.map((p) => (
        <Card key={p.id} className="!p-0"><details><summary className="cursor-pointer list-none p-5">
          <span className="font-display text-lg font-bold">{p.title}</span>
          <span className="mt-1 block text-sm text-fg/60">{p.period || new Date(p.publishedAt).toLocaleDateString()}{p.cadence ? ` · ${p.cadence} review` : ''}</span></summary>
          <div className="border-t border-line p-5"><Prose text={p.body} /></div></details></Card>
      ))}
    </div>
  )
}

export default function Reports() {
  const { organisation: org } = useOutletContext()
  const canAlerts = org?.permissions?.includes('alerts:view')
  const [tab, setTab] = useState(canAlerts ? 'mine' : 'reviews')
  return (
    <>
      <PageTitle title="Weekly and monthly reports" intro="Your own report on the alerts you received and how you responded, and the fraud reviews AbiSentry publishes." />
      <div className="no-print mb-6 flex gap-2" role="group" aria-label="Report type">
        {canAlerts && <button className={pill(tab === 'mine')} aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>Your report</button>}
        <button className={pill(tab === 'reviews')} aria-pressed={tab === 'reviews'} onClick={() => setTab('reviews')}>Fraud reviews from AbiSentry</button>
      </div>
      {tab === 'mine' && canAlerts ? <MyReport /> : <Reviews />}
    </>
  )
}
