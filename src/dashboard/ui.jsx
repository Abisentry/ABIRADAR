import { timeAgo } from '../lib/time.js'

export const PageTitle = ({ title, intro }) => (
  <div className="mb-8"><h1 className="text-3xl font-bold">{title}</h1>{intro && <p className="mt-2 max-w-2xl text-fg/70">{intro}</p>}</div>
)
export const Card = ({ children, className = '' }) => <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</section>
export const Chip = ({ children }) => <li className="rounded-full border border-line px-3 py-1 text-sm">{children}</li>
export const Empty = ({ children }) => <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-fg/60">{children}</p>
export const Stat = ({ label, value, tone = '' }) => (
  <Card><p className="text-sm text-fg/60">{label}</p><p className={`mt-1 font-display text-3xl font-bold ${tone}`}>{value}</p></Card>
)

export const SEV = { critical: 'bg-signal', warning: 'bg-amber', info: 'bg-cyan' }
export const SEV_LABEL = { critical: 'Critical', warning: 'Warning', info: 'Advisory' }
export const SevBadge = ({ severity }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${SEV[severity]}`} />{SEV_LABEL[severity]}</span>
)

export const STATUS = { new: 'New', in_progress: 'In progress', done: 'Done', not_applicable: 'Not applicable' }
const STATUS_TONE = { new: 'bg-amber/15 text-amber', in_progress: 'bg-cyan/15 text-cyan', done: 'bg-mint/15 text-mint', not_applicable: 'bg-fg/10 text-fg/70' }
export const StatusPill = ({ status }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}>{STATUS[status]}</span>

const ORG_BADGE = { pending: 'bg-amber/15 text-amber', approved: 'bg-mint/15 text-mint', rejected: 'bg-signal/15 text-signal' }
export const OrgBadge = ({ status }) => <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${ORG_BADGE[status]}`}>{status}</span>

export const AlertRow = ({ a }) => (
  <li className="flex gap-3 border-t border-line py-3 first:border-t-0">
    <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${SEV[a.severity]}`} />
    <div className="min-w-0"><p className="font-medium">{a.title}</p><p className="mt-0.5 text-xs text-fg/55">{timeAgo(a.sentAt)} · {STATUS[a.status]}</p></div>
  </li>
)

// Counts of how institutions are responding to an alert (or how one institution is).
export const Progress = ({ s }) => (
  <p className="text-sm text-fg/70">
    <span className="text-amber">{s.new} new</span> · <span className="text-cyan">{s.inProgress} in progress</span> · <span className="text-mint">{s.done} done</span> · {s.notApplicable} not applicable
  </p>
)

// Plain text with blank lines between paragraphs. Never HTML, so nothing typed here can inject markup.
export const Prose = ({ text }) => text.split(/\n{2,}/).map((p, i) => <p key={i} className="mt-3 whitespace-pre-line text-fg/80 first:mt-0">{p}</p>)

// Page controls for long lists: "Showing 1 to 20 of 53", Previous, 1 ... 4 5 6 ... 12, Next.
export function Pagination({ page, pages, total, pageSize, onPage, noun = 'items' }) {
  if (!total) return null
  const from = (page - 1) * pageSize + 1, to = Math.min(page * pageSize, total)
  const nums = []
  for (let n = 1; n <= pages; n++) if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n)
  const items = []
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) items.push(`gap${n}`); items.push(n) })
  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-fg/60">Showing {from} to {to} of {total} {noun}</p>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <button className="btn-ghost !px-3 !py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
          {items.map((x) => typeof x === 'string'
            ? <span key={x} className="px-1 text-fg/50">...</span>
            : <button key={x} aria-current={x === page ? 'page' : undefined} onClick={() => onPage(x)}
                className={`min-w-9 rounded-md border px-2.5 py-1.5 ${x === page ? 'border-cyan bg-cyan text-bg' : 'border-line hover:border-cyan'}`}>{x}</button>)}
          <button className="btn-ghost !px-3 !py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
        </div>
      )}
    </nav>
  )
}
