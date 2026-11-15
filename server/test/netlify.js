// Calls the Netlify functions the way Netlify does (Lambda-style events), against whichever database STORE selects.
import http from 'node:http'

let pass = 0, fail = 0
const ok = (c, label, extra) => { c ? pass++ : (fail++, console.log('  FAIL:', label, extra ?? '')) }

// A stand-in for the site, to see the request that starts the background email job.
const jobs = []
const site = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { jobs.push({ url: req.url, secret: req.headers['x-internal-secret'], body: JSON.parse(b || '{}') }); res.statusCode = 202; res.end() }) })
await new Promise((r) => site.listen(0, r))

Object.assign(process.env, { DOTENV_CONFIG_PATH: 'test/no-such-env-file', JWT_SECRET: 'x'.repeat(48), ADMIN_EMAILS: 'boss@example.com', ADMIN_PASSWORD: 'long-secure-pass-1',
  NOTIFY_EMAIL: 'ops@example.com', EMAIL_PROVIDER: '', EMAIL_API_KEY: '', SMTP_HOST: '', NODE_ENV: 'test', NETLIFY: 'true', ALERT_EMAILS: 'background',
  INTERNAL_SECRET: 'internal-secret-123', SIGNUP_LIMIT_PER_HOUR: '1000', CLIENT_ORIGIN: `http://localhost:${site.address().port}` })
if (!process.env.STORE) process.env.STORE = 'memory'

const printed = []; const realLog = console.log
console.log = (...a) => { printed.push(a.join(' ')); if (process.env.SHOW) realLog(...a) }

const { handler } = await import('../../netlify/functions/api.js')
const bg = await import('../../netlify/functions/send-alert-emails-background.js')

async function call(method, path, { body, cookie, ip = '203.0.113.1' } = {}) {
  const res = await handler({ httpMethod: method, path, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), 'x-nf-client-connection-ip': ip },
    multiValueHeaders: {}, queryStringParameters: null, body: body ? JSON.stringify(body) : null, isBase64Encoded: false }, {})
  const sc = res.multiValueHeaders?.['set-cookie'] ?? (res.headers?.['set-cookie'] ? [].concat(res.headers['set-cookie']) : [])
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, cookie: sc.map((c) => c.split(';')[0]).join('; '), setCookie: sc.join(' ') }
}
const lastLink = (re) => [...printed.join('\n').matchAll(re)].pop()?.[1]

try {
  const h1 = await call('GET', '/api/health'), h2 = await call('GET', '/.netlify/functions/api/api/health')
  ok(h1.status === 200 && h1.body.ok, 'health, original path'); ok(h2.status === 200 && h2.body.ok, 'health, function path (prefix removed)')

  const boss = await call('POST', '/api/auth/login', { body: { email: 'boss@example.com', password: 'long-secure-pass-1' } })
  ok(boss.status === 200 && boss.cookie.startsWith('abi_session='), 'owner login works through the function and sets a cookie', boss.status)
  ok(/HttpOnly/i.test(boss.setCookie) && /Secure/i.test(boss.setCookie) && /SameSite=Lax/i.test(boss.setCookie), 'cookie is HttpOnly, Secure and SameSite=Lax', boss.setCookie)

  const signup = await call('POST', '/api/auth/signup', { body: { fullName: 'Ada Obi', email: 'ada@example.com', password: 'correct-horse', orgName: 'Lagos Trust', orgType: 'Bank or microfinance', orgSize: '51 to 250', country: 'Nigeria',
    profile: { systems: ['Payments'], threats: ['Phishing'], pastIncident: 'No', channels: ['Email'], minSeverity: 'all', responders: 'IT' } } })
  ok(signup.status === 201, 'signup', signup.status)
  const token = lastLink(/LINK:\s+\S+verify-email\?token=([A-Za-z0-9_-]+)/g)
  ok(!!token, 'verification link is printed (console mode)')
  ok((await call('POST', '/api/auth/verify-email', { body: { token } })).status === 200, 'verify')
  const ada = await call('POST', '/api/auth/login', { body: { email: 'ada@example.com', password: 'correct-horse' } })
  const me = await call('GET', '/api/auth/me', { cookie: ada.cookie }); ok(me.status === 200 && me.body.user.emailVerified, 'logged-in cookie works on the next request')
  ok((await call('GET', '/api/auth/me')).status === 401, 'no cookie, no access')

  // alerts: the email job is handed to the background function
  const orgs = (await call('GET', '/api/admin/organisations', { cookie: boss.cookie })).body.organisations
  await call('POST', `/api/admin/organisations/${orgs[0].id}/decision`, { cookie: boss.cookie, body: { decision: 'approved' } })
  const sent = await call('POST', '/api/admin/alerts', { cookie: boss.cookie, body: { title: 'Fake refund emails', severity: 'critical', summary: 'Staff are being phished.', actions: ['Do not click.'], audience: { mode: 'all' } } })
  ok(sent.status === 201 && sent.body.delivered === 1 && sent.body.emailed === 1, 'alert sent', JSON.stringify(sent.body))
  ok(jobs.length === 1 && jobs[0].url === '/.netlify/functions/send-alert-emails-background' && jobs[0].secret === 'internal-secret-123' && jobs[0].body.alertId === sent.body.id, 'the email job was handed to the background function with the secret', JSON.stringify(jobs))

  printed.length = 0
  ok((await bg.handler({ headers: { 'x-internal-secret': 'wrong' }, body: JSON.stringify({ alertId: sent.body.id }) })).statusCode === 401, 'background function refuses a wrong secret')
  ok(!printed.join('').includes('EMAIL (not sent)'), 'and sends nothing')
  const done = await bg.handler({ headers: { 'x-internal-secret': 'internal-secret-123' }, body: JSON.stringify({ alertId: sent.body.id }) })
  const out = printed.join('\n')
  ok(done.statusCode === 200 && out.includes('To:      ada@example.com') && out.includes('Subject: [CRITICAL] Fake refund emails'), 'background function emails the institution', out.slice(0, 300))

  // rate limiting: counts survive between invocations, and are kept per visitor
  const codes = []
  for (let i = 0; i < 22; i++) codes.push((await call('POST', '/api/auth/login', { ip: '198.51.100.9', body: { email: `nobody${i}@example.com`, password: 'wrong-wrong' } })).status)
  ok(codes.slice(0, 20).every((c) => c === 401) && codes[20] === 429 && codes[21] === 429, 'the 21st login attempt from one address is refused', codes.join(','))
  ok((await call('POST', '/api/auth/login', { ip: '198.51.100.10', body: { email: 'nobody@example.com', password: 'wrong-wrong' } })).status === 401, 'a different address is not affected')
} catch (e) { fail++; realLog('  CRASH:', e.stack) }

console.log = realLog
site.close()
console.log(`[netlify, ${process.env.STORE}] ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
