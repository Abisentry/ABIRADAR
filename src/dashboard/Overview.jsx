import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { PageTitle, Card, AlertRow, Empty, Stat } from './ui.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'

export default function Overview() {
  const { user, organisation: org } = useOutletContext()
  const [d, setD] = useState(null)
  usePoll(() => api('/overview').then(setD).catch(() => {}), 10000)
  const p = org?.profile || {}
  const canSee = org?.permissions?.includes('alerts:view')

  return (
    <>
      <PageTitle title={`Welcome, ${user.fullName.split(' ')[0]}`} intro="Alerts from the AbiSentry team, and what your institution has done about them." />
      {d && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Alerts received" value={d.received ?? '–'} />
          <Stat label="Waiting for action" value={d.openAlerts ?? '–'} tone={d.openAlerts ? 'text-amber' : ''} />
          <Stat label="Critical, waiting" value={d.criticalOpen ?? '–'} tone={d.criticalOpen ? 'text-signal' : ''} />
        </div>
      )}
      {d && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="font-display text-xl font-bold">Latest alerts</h2>
            <div className="mt-3">
              {d.recent.length ? <ul>{d.recent.map((a) => <AlertRow key={a.id} a={a} />)}</ul>
                : <Empty>{canSee ? (org?.status === 'approved' ? 'No alerts yet. When we see a threat that could affect you, it appears here and in your email.' : 'Alerts start arriving once your institution is approved.') : 'Alerts are not part of your role.'}</Empty>}
            </div>
            {d.recent.length > 0 && <Link to="alerts" className="mt-3 inline-block text-sm font-semibold text-cyan hover:underline">See all alerts</Link>}
          </Card>
          <Card>
            <h2 className="font-display text-xl font-bold">What you asked us to watch</h2>
            <p className="mt-3 text-sm font-semibold">Systems you protect</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-fg/70">{(p.systems || []).map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="mt-4 text-sm font-semibold">Threats you worry about</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-fg/70">{(p.threats || []).map((s) => <li key={s}>{s}</li>)}</ul>
          </Card>
        </div>
      )}
    </>
  )
}
