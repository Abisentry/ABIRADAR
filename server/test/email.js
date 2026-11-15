// Checks what is sent to each email service's API, using a small local server in its place.
import http from 'node:http'
import { sendPasswordReset, sendInvite } from '../src/mailer.js'
import { emailMode, emailConfigured, describeEmail } from '../src/email.js'

let pass = 0, fail = 0
const ok = (c, label, extra) => { c ? pass++ : (fail++, console.log('  FAIL:', label, extra ?? '')) }

let seen, respond = 200
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { seen = { url: req.url, headers: req.headers, body: JSON.parse(b || '{}') }; res.statusCode = respond; res.end(respond === 200 ? '{}' : '{"message":"sender not verified"}') })
}).listen(0)
await new Promise((r) => srv.once('listening', r))
process.env.EMAIL_API_URL = `http://localhost:${srv.address().port}/send`
process.env.EMAIL_API_KEY = 'KEY123'
process.env.MAIL_FROM = '"AbiSentry Gossip" <no-reply@abisentry.com>'
const who = { fullName: 'Ada <b>Obi</b>', email: 'ada@example.com' }

for (const provider of ['altermail', 'resend', 'sendgrid', 'brevo', 'postmark']) {
  process.env.EMAIL_PROVIDER = provider; respond = 200; seen = null
  ok(emailMode().kind === 'api' && emailConfigured(), `${provider}: configured`)
  await sendPasswordReset({ user: who, url: 'https://x.test/reset?token=abc' })
  const h = seen.headers, b = seen.body, json = JSON.stringify(b)
  ok(json.includes('ada@example.com'), `${provider}: sends to the right person`)
  ok(json.includes('https://x.test/reset?token=abc'), `${provider}: includes the link`)
  const html = { altermail: b.mailBodyHtml, resend: b.html, sendgrid: b.content?.[1]?.value, brevo: b.htmlContent, postmark: b.HtmlBody }[provider]
  ok(html && !html.includes('<b>Obi</b>') && html.includes('&lt;b&gt;Obi'), `${provider}: escapes typed text in the HTML part`, html)
  ok(json.includes('no-reply@abisentry.com'), `${provider}: uses the sender address`)
  if (provider === 'altermail') {
    ok(h.token === 'KEY123' && !h.authorization, 'altermail: key goes in the token header')
    const allowed = ['email', 'fromEmail', 'fromName', 'subject', 'mailBodyHtml', 'mailBodyText', 'cc', 'bcc', 'replyTo', 'attachments', 'category']
    ok(Object.keys(b).every((k) => allowed.includes(k)), 'altermail: sends only documented fields', Object.keys(b).join())
    ok(b.email === 'ada@example.com' && b.fromEmail === 'no-reply@abisentry.com' && b.fromName === 'AbiSentry Gossip' && b.category === 'transactional' && seen.url === '/send', 'altermail: recipient, sender, name, category')
  }
  else if (provider === 'brevo') ok(h['api-key'] === 'KEY123', 'brevo: api-key header')
  else if (provider === 'postmark') ok(h['x-postmark-server-token'] === 'KEY123', 'postmark: token header')
  else ok(h.authorization === 'Bearer KEY123', `${provider}: bearer key`)
  if (provider === 'sendgrid') ok(b.content[0].type === 'text/plain' && b.from.name === 'AbiSentry Gossip', 'sendgrid: text part first, sender name split out')
  if (provider === 'resend') ok(b.from === 'AbiSentry Gossip <no-reply@abisentry.com>' && Array.isArray(b.to), 'resend: from and to shape')
  respond = 403
  let err = null; try { await sendInvite({ to: 'a@b.com', inviter: 'X', org: 'Y', role: 'viewer', url: 'u' }) } catch (e) { err = e }
  ok(err && err.message.includes(provider) && err.message.includes('sender not verified') && !err.message.includes('KEY123'), `${provider}: a refusal gives a clear error without the key`, err?.message)
}

// Altermail's limits: space out bulk sends, and retry when it says "too many"
process.env.EMAIL_PROVIDER = 'altermail'; process.env.EMAIL_BULK_PER_MINUTE = '600'
const { sendEmail } = await import('../src/email.js')
const stamps = []; const origRespond = respond; respond = 200
srv.removeAllListeners('request'); srv.on('request', (req, res) => { stamps.push(Date.now()); req.resume(); req.on('end', () => { res.statusCode = 200; res.end('{}') }) })
await Promise.all([1, 2, 3].map((i) => sendEmail({ to: `u${i}@x.com`, subject: 's', text: 't', html: 'h' }, { bulk: true })))
ok(stamps.length === 3 && stamps[1] - stamps[0] >= 80 && stamps[2] - stamps[1] >= 80, 'bulk sends are spaced out', stamps.map((t) => t - stamps[0]).join())
const t0 = Date.now(); stamps.length = 0
await Promise.all([1, 2, 3].map((i) => sendEmail({ to: `u${i}@x.com`, subject: 's', text: 't', html: 'h' })))
ok(Date.now() - t0 < 80, 'one-off emails are not delayed')
let calls = 0; process.env.EMAIL_RETRY_MS = '20'
srv.removeAllListeners('request'); srv.on('request', (req, res) => { calls++; req.resume(); req.on('end', () => { if (calls < 3) { res.statusCode = 429; res.end('{"message":"Too many send requests for this account. Please wait before sending again."}') } else { res.statusCode = 202; res.end('{"Status":"Queued"}') } }) })
await sendEmail({ to: 'a@b.com', subject: 's', text: 't', html: 'h' })
ok(calls === 3, 'a rate-limit reply is retried until it goes through', calls)
calls = -10
srv.removeAllListeners('request'); srv.on('request', (req, res) => { calls++; req.resume(); req.on('end', () => { res.statusCode = 429; res.end('{"message":"Free plan daily limit exceeded. Limit is 100 emails/day."}') }) })
let derr = null; try { await sendEmail({ to: 'a@b.com', subject: 's', text: 't', html: 'h' }) } catch (e) { derr = e }
ok(derr && derr.message.includes('daily limit') && calls === -9, 'the daily limit is reported at once, not retried', derr?.message)
delete process.env.EMAIL_BULK_PER_MINUTE

process.env.EMAIL_PROVIDER = 'resend'; delete process.env.EMAIL_API_KEY
ok(emailMode().kind === 'missing-key' && !emailConfigured(), 'provider without a key is flagged')
process.env.EMAIL_PROVIDER = 'mailchimp'; process.env.EMAIL_API_KEY = 'K'
ok(emailMode().kind === 'invalid' && describeEmail().includes('not supported'), 'unknown provider is flagged')
delete process.env.EMAIL_PROVIDER
ok(emailMode().kind === 'invalid', 'a key with no provider named is flagged')
delete process.env.EMAIL_API_KEY
ok(emailMode().kind === 'console' && !emailConfigured(), 'nothing configured prints to the console')
process.env.SMTP_HOST = 'smtp.example.com'
ok(emailMode().kind === 'smtp' && emailConfigured(), 'SMTP still works')

// Console mode: EMAIL_PROVIDER=console prints emails in the terminal and sends nothing, even with a key set
process.env.EMAIL_PROVIDER = 'console'; process.env.EMAIL_API_KEY = 'KEY123'; seen = null
ok(emailMode().kind === 'console' && !emailConfigured() && describeEmail().includes('EMAIL_PROVIDER=console'), 'console mode is switched on by EMAIL_PROVIDER=console')
const printed = []; const origLog = console.log; console.log = (...a) => printed.push(a.join(' '))
await sendPasswordReset({ user: who, url: 'https://x.test/reset?token=abc' })
const { sendDecision } = await import('../src/mailer.js')
await sendDecision({ user: who, org: 'Lagos Trust', decision: 'approved' })
console.log = origLog
ok(seen === null, 'console mode sends nothing over the network')
ok(printed[0].includes('LINK:    https://x.test/reset?token=abc') && printed[0].includes('To:      ada@example.com'), 'the reset link is printed on its own LINK line', printed[0])
ok(printed[1].includes('/dashboard/alerts') && !/API key|connect your systems|dashboard\/connect/i.test(printed[1]), 'approval email no longer mentions API keys or the removed page', printed[1])

srv.close()
console.log(`[email] ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
