import { useEffect, useState } from 'react'
import { PageTitle, Card, Empty } from './ui.jsx'
import { api } from '../lib/api.js'

const TONE = { Strong: 'text-mint', Fair: 'text-amber', 'Needs attention': 'text-signal' }

export default function RiskScore() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api('/readiness').then(setD).catch((e) => setError(e.message)) }, [])

  return (
    <>
      <PageTitle title="Risk readiness score" intro="How ready your institution is to deal with the alerts it receives, based on what your team has actually done in the last 90 days." />
      {error && <p role="alert" className="text-signal">{error}</p>}
      {d && !d.ready && <Empty>Your score appears after you have received at least {d.needed} alerts. You have {d.have} so far.</Empty>}
      {d?.ready && (
        <div className="grid max-w-4xl gap-6 lg:grid-cols-[14rem_1fr]">
          <Card className="text-center">
            <p className="text-sm text-fg/60">Readiness</p>
            <p className={`font-display text-6xl font-bold ${TONE[d.band]}`}>{d.score}</p>
            <p className="text-sm text-fg/60">out of 100</p>
            <p className={`mt-2 font-semibold ${TONE[d.band]}`}>{d.band}</p>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-bold">How it is worked out</h2>
            <ul className="mt-3 space-y-4">
              {d.factors.map((f) => (
                <li key={f.label}>
                  <div className="flex justify-between font-medium"><span>{f.label}</span><span>{f.points} / {f.max}</span></div>
                  <div className="mt-1 h-2 rounded bg-bg"><div className="h-2 rounded bg-cyan" style={{ width: `${(f.points / f.max) * 100}%` }} /></div>
                  <p className="mt-1 text-sm text-fg/60">{f.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-fg/50">This is a simple score based on {d.basedOn} alerts and your team. It measures how you respond. It does not predict whether you will be attacked.</p>
          </Card>
        </div>
      )}
    </>
  )
}
