// End-to-end test: starts the real server and exercises it over HTTP. Usage: node test/run.js [memory|fake]
import { spawn } from 'node:child_process'

const STORE = process.argv[2] || 'memory'
const PORT = 4100 + (STORE === 'convex' ? 1 : 0)
const BASE = `http://localhost:${PORT}/api`
const ADMIN_PW = 'long-secure-pass-1'

// The test server must never read your real .env or send real email. DOTENV_CONFIG_PATH points it at a file that does not
// exist, and the email settings are blanked, so verification and reset links are printed in its log instead.
const server = spawn('node', ['server/src/index.js'], { env: { ...process.env, DOTENV_CONFIG_PATH: 'test/no-such-env-file', EMAIL_PROVIDER: '', EMAIL_API_KEY: '', SMTP_HOST: '',
  SIGNUP_LIMIT_PER_HOUR: '1000', STORE, PORT, JWT_SECRET: 'x'.repeat(48), ADMIN_EMAILS: 'boss@example.com', ADMIN_PASSWORD: ADMIN_PW, NOTIFY_EMAIL: 'ops@example.com', NODE_ENV: 'test' } })
let log = ''
server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d))
const tokenFrom = (re) => [...log.matchAll(re)].pop()?.[1]

const client = () => {
  let cookie = ''
  return async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined })
    const sc = r.headers.getSetCookie?.() || []
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ')
    return { status: r.status, body: await r.json().catch(() => null) }
  }
}
let pass = 0, fail = 0
const ok = (cond, label, extra) => { cond ? pass++ : (fail++, console.log('  FAIL:', label, extra ?? '')) }
const is = (got, want, label) => ok(got === want, label, `(got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)

const signupBody = (name, email, org, type) => ({ fullName: name, email, password: 'correct-horse', orgName: org, orgType: type, orgSize: '51 to 250', country: 'Nigeria',
  profile: { systems: ['Payments'], threats: ['Phishing'], pastIncident: 'No', channels: ['Email'], minSeverity: 'all', responders: 'IT' } })
async function register(name, email, org, type) {
  const c = client()
  is((await c('POST', '/auth/signup', signupBody(name, email, org, type))).status, 201, `signup ${email}`)
  const t = tokenFrom(/token=([A-Za-z0-9_-]+)/g)
  is((await c('POST', '/auth/verify-email', { token: t })).status, 200, `verify ${email}`)
  return c
}

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/health')).ok) break } catch {} await new Promise((r) => setTimeout(r, 300)) }
  if (!/email NOT configured/.test(log)) { console.log('Refusing to run: the test server would send real email.\n' + log); server.kill(); process.exit(1) }
  is((await (await fetch(BASE + '/health')).json()).store, STORE, 'store backend')

  const boss = client()
  is((await boss('POST', '/auth/login', { email: 'boss@example.com', password: ADMIN_PW })).status, 200, 'owner logs in without signup')
  const me = (await boss('GET', '/auth/me')).body
  ok(me.user.isAdmin && !me.organisation, 'owner has no institution')

  const ada = await register('Ada', 'ada@example.com', 'Lagos Trust MFB', 'Bank or microfinance')
  const zed = await register('Zed', 'zed@example.com', 'Zed Clinic', 'Hospital or clinic')
  is((await ada('POST', '/auth/signup', signupBody('Ada', 'ada@example.com', 'x', 'Bank'))).status, 409, 'duplicate email refused')
  const orgs = (await boss('GET', '/admin/organisations')).body
  is(orgs.counts.pending, 2, 'both pending'); const adaOrg = orgs.organisations.find((o) => o.name === 'Lagos Trust MFB'), zedOrg = orgs.organisations.find((o) => o.name === 'Zed Clinic')
  is((await ada('GET', '/library')).body.entries.length, 8, 'starting library seeded')
  is((await ada('GET', '/alerts')).status, 200, 'pending institution can open alerts page')

  // ---- sending alerts ----
  is((await boss('POST', '/admin/organisations/' + adaOrg.id + '/decision', { decision: 'rejected' })).status, 400, 'reject needs a reason')
  is((await boss('POST', '/admin/organisations/' + adaOrg.id + '/decision', { decision: 'approved' })).status, 200, 'approve Ada')
  const A1 = { title: 'Fake CBN refund emails', severity: 'critical', summary: 'Staff get emails claiming a refund is due.', actions: ['Do not click the link.', 'Delete the email.'], threat: 'Phishing', audience: { mode: 'all' } }
  const s1 = await boss('POST', '/admin/alerts', A1)
  is(s1.body.delivered, 1, 'pending institution is not sent the alert'); is(s1.body.emailed, 1, 'one email sent')
  is((await boss('POST', '/admin/alerts', { ...A1, actions: [] })).status, 400, 'alert needs actions')
  is((await boss('POST', '/admin/alerts', { ...A1, audience: { mode: 'types', types: ['Insurance'] } })).status, 400, 'no match refused')
  is((await ada('POST', '/admin/alerts', A1)).status, 403, 'institution cannot send alerts')
  await boss('POST', '/admin/organisations/' + zedOrg.id + '/decision', { decision: 'approved' })
  const s2 = await boss('POST', '/admin/alerts', { title: 'Patient scraping', severity: 'warning', summary: 'Portal scraping.', actions: ['Rate limit the portal.'], audience: { mode: 'types', types: ['Hospital or clinic'] } })
  is(s2.body.delivered, 1, 'sector targeting')
  const s3 = await boss('POST', '/admin/alerts', { title: 'Heads up', severity: 'info', summary: 'Maintenance.', actions: ['Read the notice.'], audience: { mode: 'orgs', orgIds: [adaOrg.id] } })
  is(s3.body.delivered, 1, 'chosen institution targeting')

  // ---- institution responds ----
  const list = (await ada('GET', '/alerts?status=all')).body
  is(list.alerts.length, 2, 'Ada received 2'); is(list.counts.open, 2, 'Ada has 2 open')
  const a1 = list.alerts.find((a) => a.title === 'Fake CBN refund emails')
  is((await ada('PATCH', '/alerts/' + a1.id, { status: 'done' })).status, 400, 'done needs a note')
  is((await ada('PATCH', '/alerts/' + a1.id, { status: 'in_progress' })).status, 200, 'start working')
  is((await ada('PATCH', '/alerts/' + a1.id, { status: 'done', note: 'Blocked sender, reset 3 passwords, warned staff.' })).status, 200, 'mark done')
  is((await zed('PATCH', '/alerts/' + a1.id, { status: 'done', note: 'not mine to touch' })).status, 404, 'cannot touch another institution\'s alert')
  is((await ada('GET', '/alerts')).body.counts.open, 1, 'open count falls after done')
  const vic = client()
  const inv = (await ada('POST', '/team/invitations', { email: 'vic@example.com', role: 'viewer' })).body
  is((await vic('POST', '/auth/accept-invite', { token: inv.devLink.split('token=')[1], fullName: 'Vic', password: 'correct-horse' })).status, 201, 'viewer joins by invitation')
  is((await vic('GET', '/alerts')).status, 200, 'viewer reads alerts'); is((await vic('PATCH', '/alerts/' + a1.id, { status: 'new' })).status, 403, 'viewer cannot respond'); is((await vic('GET', '/team')).status, 403, 'viewer cannot manage team')
  is((await ada('GET', '/team')).body.members.length, 2, 'team has 2 members')
  const vicId = (await ada('GET', '/team')).body.members.find((m) => m.role === 'viewer').id
  is((await ada('PATCH', '/team/members/' + vicId, { role: 'analyst' })).status, 200, 'owner changes a role')
  is((await ada('DELETE', '/team/members/' + vicId)).status, 200, 'owner removes a member'); is((await vic('GET', '/auth/me')).status, 401, 'removed member is signed out')

  // ---- owner views ----
  const sent = (await boss('GET', '/admin/alerts')).body.alerts
  is(sent.length, 3, 'owner sees 3 sent alerts'); const sentA1 = sent.find((a) => a.title === 'Fake CBN refund emails')
  is(sentA1.stats.done, 1, 'alert tally shows 1 done')
  const det = (await boss('GET', '/admin/alerts/' + sentA1.id)).body
  is(det.deliveries[0].history.length, 2, 'history kept'); is(det.deliveries[0].history[1].note, 'Blocked sender, reset 3 passwords, warned staff.', 'note kept')
  const ov = (await boss('GET', '/admin/overview')).body
  is(ov.institutions.approved, 2, 'overview approved'); is(ov.alertsSent, 3, 'overview alerts sent'); is(ov.responses.done, 1, 'overview responses done')
  const adaDetail = (await boss('GET', '/admin/organisations/' + adaOrg.id)).body
  is(adaDetail.alertStats.total, 2, 'institution detail tally'); is(adaDetail.team[0].role, 'owner', 'institution detail team')
  is((await boss('POST', '/admin/alerts/' + s3.body.id + '/withdraw')).status, 200, 'withdraw')
  is((await ada('GET', '/alerts')).body.counts.open, 0, 'withdrawn alert stops counting'); is((await ada('PATCH', '/alerts/' + (await ada('GET', '/alerts?status=all')).body.alerts.find((a) => a.title === 'Heads up').id, { status: 'in_progress' })).status, 409, 'cannot respond to withdrawn')

  // ---- fraud library manager ----
  const entry = { name: 'SIM swap fraud', summary: 'A criminal takes over a phone number.', signs: ['Sudden loss of signal'], steps: ['Call the telco.', 'Freeze the account.'], published: true, sort: 20 }
  const made = await boss('POST', '/admin/library', entry)
  is(made.status, 201, 'library entry created'); is((await boss('POST', '/admin/library', entry)).status, 409, 'duplicate entry name refused')
  is((await ada('GET', '/library')).body.entries.length, 9, 'institutions see the new entry')
  is((await boss('PUT', '/admin/library/' + made.body.id, { ...entry, published: false })).status, 200, 'unpublish'); is((await ada('GET', '/library')).body.entries.length, 8, 'unpublished entry hidden')
  is((await boss('DELETE', '/admin/library/' + made.body.id)).status, 200, 'delete entry'); is((await ada('POST', '/admin/library', entry)).status, 403, 'institution cannot edit library')

  // ---- reviews and community posts ----
  const rv = await boss('POST', '/admin/posts', { kind: 'review', title: 'October fraud review', period: 'October 2026', cadence: 'monthly', body: 'Phishing rose sharply.\n\nWatch payroll changes.', audience: ['Bank or microfinance'], published: true })
  is(rv.status, 201, 'review published'); const draft = await boss('POST', '/admin/posts', { kind: 'review', title: 'Draft', body: 'x', audience: [], published: false })
  is((await ada('GET', '/posts?kind=review')).body.posts.length, 1, 'bank sees the review and not the draft'); is((await zed('GET', '/posts?kind=review')).body.posts.length, 0, 'clinic is outside the audience')
  is((await boss('PUT', '/admin/posts/' + draft.body.id, { kind: 'review', title: 'Draft', body: 'x', audience: [], published: true })).status, 200, 'publish a draft')
  is((await zed('GET', '/posts?kind=review')).body.posts.length, 1, 'clinic now sees the open review')
  is((await boss('POST', '/admin/posts', { kind: 'community', title: 'New SIM swap scam', body: 'Be careful.', audience: [], published: true })).status, 201, 'community advisory')
  is((await ada('GET', '/posts?kind=community')).body.posts.length, 1, 'institution sees advisory'); is((await boss('GET', '/admin/posts?kind=review')).body.posts.length, 2, 'owner lists all reviews')
  is((await boss('DELETE', '/admin/posts/' + draft.body.id)).status, 200, 'delete post')

  // ---- institution reports ----
  const rd1 = await ada('GET', '/readiness'); is(rd1.body.ready, false, 'score needs more alerts first')
  await boss('POST', '/admin/alerts', { title: 'Third', severity: 'warning', summary: 'x', actions: ['y'], audience: { mode: 'all' } })
  await boss('POST', '/admin/alerts', { title: 'Fourth', severity: 'warning', summary: 'x', actions: ['y'], audience: { mode: 'all' } })
  const rd2 = (await ada('GET', '/readiness')).body
  ok(rd2.ready && rd2.score >= 0 && rd2.score <= 100 && rd2.factors.length === 3, 'readiness score works', JSON.stringify(rd2))
  const rep = (await ada('GET', '/reports/summary?cadence=weekly&offset=0')).body
  ok(rep.received >= 4, 'weekly report counts alerts', rep.received); is(rep.outcomes.done, 1, 'report shows 1 done'); ok(rep.avgHoursToClose !== null, 'report has time to close')
  is(rep.actions[0].note, 'Blocked sender, reset 3 passwords, warned staff.', 'report lists what was done')
  is((await ada('GET', '/reports/summary?cadence=monthly&offset=1')).status, 200, 'monthly report, previous month'); is((await ada('GET', '/reports/summary?cadence=weekly&offset=99')).body.period.label.startsWith('Week of'), true, 'offset is clamped')

  // ---- community reports from institutions ----
  const ir = await ada('POST', '/community/reports', { title: 'Fake auditor calls', details: 'Callers claim to be CBN auditors.', anonymous: true })
  is(ir.status, 201, 'institution submits a report'); is((await ada('GET', '/community/reports')).body.reports.length, 1, 'institution sees its reports')
  const q = (await boss('GET', '/admin/incident-reports')).body; is(q.newCount, 1, 'owner sees the new report'); is(q.reports[0].orgName, 'Lagos Trust MFB', 'owner sees who sent it')
  is((await boss('PATCH', '/admin/incident-reports/' + ir.body.id, { status: 'reviewed', note: 'Sent as an alert.' })).status, 200, 'owner marks it reviewed'); is((await ada('GET', '/community/reports')).body.reports[0].status, 'reviewed', 'institution sees the outcome')
  is((await ada('GET', '/admin/incident-reports')).status, 403, 'institution cannot read the queue')

  // ---- the institutions list is paged ----
  for (let i = 1; i <= 24; i++) await client()('POST', '/auth/signup', signupBody(`P${i}`, `p${String(i).padStart(2, '0')}@example.com`, `Bulk Org ${i}`, 'Insurance'))
  const pg1 = (await boss('GET', '/admin/organisations?page=1&pageSize=20')).body, pg2 = (await boss('GET', '/admin/organisations?page=2&pageSize=20')).body
  is(pg1.total, 26, 'total counts every institution'); is(pg1.pages, 2, 'two pages of 20'); is(pg1.organisations.length, 20, 'first page has 20'); is(pg2.organisations.length, 6, 'second page has the rest')
  ok(pg1.organisations.every((o) => o.status === 'pending'), 'pending institutions come first'); ok(pg2.organisations.slice(-2).every((o) => o.status === 'approved'), 'approved ones follow')
  is(new Set([...pg1.organisations, ...pg2.organisations].map((o) => o.id)).size, 26, 'no institution is repeated or missing across pages')
  is((await boss('GET', '/admin/organisations')).body.organisations.length, 20, 'default page size is 20')
  is((await boss('GET', '/admin/organisations?page=99')).body.page, 2, 'a page past the end gives the last page'); is((await boss('GET', '/admin/organisations?page=0&pageSize=abc')).body.page, 1, 'nonsense values are tidied up')
  is((await boss('GET', '/admin/organisations?pageSize=1000')).body.pageSize, 100, 'page size is capped at 100')
  const ap = (await boss('GET', '/admin/organisations?status=approved')).body; is(ap.total, 2, 'filter by approved'); is(ap.pages, 1, 'filtered list has one page'); is(ap.counts.pending, 24, 'tab counts cover everyone')
  is((await boss('GET', '/admin/institution-options')).body.institutions.length, 2, 'alert audience list holds every approved institution, unpaged')
  is((await ada('GET', '/admin/institution-options')).status, 403, 'institutions cannot read the list')

  // ---- accounts ----
  for (let i = 0; i < 5; i++) await client()('POST', '/auth/login', { email: 'zed@example.com', password: 'wrong-wrong' })
  is((await client()('POST', '/auth/login', { email: 'zed@example.com', password: 'correct-horse' })).status, 429, 'lockout after 5 failures')
  const c2 = client(); await c2('POST', '/auth/login', { email: 'ada@example.com', password: 'correct-horse' })
  await client()('POST', '/auth/forgot-password', { email: 'ada@example.com' }); const rt = tokenFrom(/reset-password\?token=([A-Za-z0-9_-]+)/g)
  is((await client()('POST', '/auth/reset-password', { token: rt, password: 'brand-new-pass' })).status, 200, 'password reset'); is((await c2('GET', '/auth/me')).status, 401, 'old session ended by reset')
  is((await client()('POST', '/auth/reset-password', { token: rt, password: 'another-pass-1' })).status, 400, 'reset link works once')
  is((await client()('POST', '/auth/login', { email: 'ada@example.com', password: 'brand-new-pass' })).status, 200, 'login with new password')
} catch (e) { fail++; console.log('  CRASH:', e.stack) }

server.kill()
const bad = log.split('\n').filter((l) => /TypeError|FAILED_PRECONDITION|Error:/.test(l) && !/mail/.test(l))
if (bad.length) { fail++; console.log('  SERVER ERRORS:\n   ', bad.slice(0, 4).join('\n    ')) }
console.log(`[${STORE}] ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
