import { useEffect, useState } from 'react'

const EVENTS = [
  { sev: 'critical', to: 'Banks and microfinance', msg: 'Fake refund emails are tricking staff into entering their logins' },
  { sev: 'warning', to: 'Hospitals and clinics', msg: 'Patient portals are being scraped. Review access logs today' },
  { sev: 'critical', to: 'Fintechs and payment providers', msg: 'New transfer scam splits large amounts into small payments' },
  { sev: 'warning', to: 'Universities and schools', msg: 'Fake admission officers are asking for fee payments' },
  { sev: 'info', to: 'All institutions', msg: 'Reminder: confirm bank detail changes by phone, never by email' },
  { sev: 'critical', to: 'Government agencies', msg: 'Ghost-worker payroll scheme spotted. Verify new staff records' },
]
const COLORS = { critical: 'bg-signal', warning: 'bg-amber', info: 'bg-cyan' }

export default function LiveFeed() {
  const [items, setItems] = useState([{ ...EVENTS[0], id: 0, at: 'just now' }])

  useEffect(() => {
    let i = 1
    const t = setInterval(() => {
      setItems((prev) => [{ ...EVENTS[i % EVENTS.length], id: i, at: 'just now' }, ...prev.map((p) => ({ ...p, at: 'earlier' }))].slice(0, 4))
      i++
    }, 2800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-xl border border-line bg-surface p-5 text-fg" aria-label="Example alerts">
      <div className="mb-4 flex items-center justify-between text-sm text-fg/60">
        <span>Example alerts from AbiSentry</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mint" />Live</span>
      </div>
      <ul className="space-y-3" aria-live="polite">
        {items.map((e) => (
          <li key={e.id} className="flex gap-3 rounded-lg bg-white/[0.06] p-3.5 motion-safe:animate-arrive">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${COLORS[e.sev]}`} />
            <div className="min-w-0">
              <p className="text-[15px] leading-snug">{e.msg}</p>
              <p className="mt-1 text-xs text-white/50">Sent to {e.to} · {e.at}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
