import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PageTitle, Card } from './ui.jsx'
import { api } from '../lib/api.js'
import { usePoll } from '../lib/usePoll.js'

export default function Playbooks() {
  const { organisation: org } = useOutletContext()
  const [entries, setEntries] = useState(null)
  usePoll(() => api('/library').then((d) => setEntries(d.entries)).catch(() => {}), 60000)
  const mine = org?.profile?.threats || []
  const sorted = [...(entries || [])].sort((a, b) => mine.includes(b.name) - mine.includes(a.name))

  return (
    <>
      <PageTitle title="Playbooks and response guides" intro="What to do, step by step, when a threat reaches you. Your priority threats are listed first." />
      <div className="max-w-3xl space-y-3">
        {sorted.map((f) => (
          <Card key={f.id} className="!p-0">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                <span className="font-display text-lg font-bold">{f.name}</span>
                {mine.includes(f.name) && <span className="rounded-full bg-cyan/15 px-2.5 py-0.5 text-xs text-cyan">Your priority</span>}
              </summary>
              <ol className="list-decimal space-y-2 border-t border-line px-10 py-5 text-fg/80">{f.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </details>
          </Card>
        ))}
      </div>
    </>
  )
}
