import crypto from 'node:crypto'

// Dates come back from the database as Date objects; the browser wants ISO strings.
export const iso = (d) => (d ? new Date(d).toISOString() : null)
export const sha = (t) => crypto.createHash('sha256').update(t).digest('hex')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Platform admins are listed in ADMIN_EMAILS (comma separated). They review institutions and send alerts.
export const isAdmin = (email) =>
  (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).includes(String(email).toLowerCase())

// Cloud Run pauses work once a response is sent, so emails are awaited BEFORE responding.
// A failed email is logged but never fails the request.
export async function mailAll(label, ...promises) {
  const results = await Promise.allSettled(promises)
  for (const r of results) if (r.status === 'rejected') console.error(`${label} failed:`, r.reason?.message)
}
