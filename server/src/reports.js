import { store } from './store/index.js'

const DAY = 864e5
const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
const hours = (from, to) => (to - from) / 36e5
const closing = (d) => (d.history || []).find((h) => h.status === 'done' || h.status === 'not_applicable')

// Weeks run Monday to Sunday and months are calendar months, both in UTC. offset 0 is the current one.
export function periodFor(cadence, offset, now = new Date()) {
  if (cadence === 'weekly') {
    const sinceMonday = (now.getUTCDay() + 6) % 7
    const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday)
    const start = new Date(monday - offset * 7 * DAY)
    return { cadence, start, end: new Date(+start + 7 * DAY), label: `Week of ${fmt(start)}` }
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1))
  return { cadence, start, end, label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}

const within = (list, p) => list.filter((d) => d.sentAt >= p.start && d.sentAt < p.end)

// The institution's own report, worked out from the alerts it received and how it responded.
export async function buildReport(orgId, cadence, offset) {
  const all = await store.find('deliveries', { where: { orgId }, orderBy: ['sentAt', 'desc'], limit: 1000 })
  const cur = periodFor(cadence, offset), prev = periodFor(cadence, offset + 1)
  const all_ = within(all, cur)
  const live = all_.filter((d) => !d.withdrawn)
  const first = live.map((d) => ({ d, h: d.history?.[0] })).filter((x) => x.h)

  const byThreat = {}
  for (const d of live) byThreat[d.threat || 'General'] = (byThreat[d.threat || 'General'] || 0) + 1
  const actions = live.flatMap((d) => (d.history || []).filter((h) => h.note && h.status !== 'in_progress').map((h) => ({ title: d.title, status: h.status, note: h.note, by: h.by, at: h.at })))
    .sort((a, b) => b.at - a.at).slice(0, 10)
  const prevLive = within(all, prev).filter((d) => !d.withdrawn)

  return {
    period: { label: cur.label, cadence, start: cur.start.toISOString(), end: cur.end.toISOString() },
    received: all_.length,
    withdrawn: all_.length - live.length,
    bySeverity: { critical: live.filter((d) => d.severity === 'critical').length, warning: live.filter((d) => d.severity === 'warning').length, info: live.filter((d) => d.severity === 'info').length },
    outcomes: { done: live.filter((d) => d.status === 'done').length, notApplicable: live.filter((d) => d.status === 'not_applicable').length,
      inProgress: live.filter((d) => d.status === 'in_progress').length, new: live.filter((d) => d.status === 'new').length },
    respondedWithin24h: first.filter((x) => hours(x.d.sentAt, x.h.at) <= 24).length,
    avgHoursToFirstResponse: mean(first.map((x) => hours(x.d.sentAt, x.h.at))),
    avgHoursToClose: mean(live.map((d) => ({ d, c: closing(d) })).filter((x) => x.c).map((x) => hours(x.d.sentAt, x.c.at))),
    byThreat: Object.entries(byThreat).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    actions: actions.map((a) => ({ ...a, at: a.at.toISOString() })),
    previous: { received: prevLive.length, done: prevLive.filter((d) => d.status === 'done').length },
  }
}

// A rule-based score from how the institution has actually responded in the last 90 days. It is not a prediction.
export async function readiness(orgId) {
  const since = new Date(Date.now() - 90 * DAY)
  const live = (await store.find('deliveries', { where: { orgId }, orderBy: ['sentAt', 'desc'], limit: 500 })).filter((d) => d.sentAt >= since && !d.withdrawn)
  const responders = (await store.find('members', { where: { orgId } })).filter((m) => ['owner', 'admin', 'analyst'].includes(m.role)).length
  if (live.length < 3) return { ready: false, have: live.length, needed: 3, responders }

  const closed = live.filter((d) => closing(d)).length / live.length
  const fast = live.filter((d) => d.history?.[0] && hours(d.sentAt, d.history[0].at) <= 24).length / live.length
  const factors = [
    { label: 'Alerts completed', detail: `${Math.round(closed * 100)}% of the ${live.length} alerts you received are marked done or not applicable`, points: Math.round(closed * 50), max: 50 },
    { label: 'Speed of response', detail: `${Math.round(fast * 100)}% got a first response within 24 hours`, points: Math.round(fast * 35), max: 35 },
    { label: 'People who can respond', detail: `${responders} ${responders === 1 ? 'person has' : 'people have'} a role that can respond to alerts`, points: responders >= 2 ? 15 : 5, max: 15 },
  ]
  const score = factors.reduce((a, f) => a + f.points, 0)
  return { ready: true, score, band: score >= 80 ? 'Strong' : score >= 60 ? 'Fair' : 'Needs attention', factors, basedOn: live.length }
}
