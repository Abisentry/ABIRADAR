import { Router } from 'express'
import crypto from 'node:crypto'
import { limiter } from './ratelimit.js'
import { store, newId } from './store/index.js'
import { requireAuth, requireVerified } from './auth.js'
import { withOrg, need, canAssign } from './access.js'
import { inviteSchema, roleSchema } from './validate.js'
import { sendInvite } from './mailer.js'
import { iso, mailAll, sha } from './util.js'
import { emailConfigured } from './email.js'

const router = Router()
router.use(requireAuth, requireVerified, withOrg, need('team:manage'))

const CLIENT = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
const WEEK = 7 * 24 * 60 * 60 * 1000
const forbidden = (res) => res.status(403).json({ error: 'Your role cannot do that for this person.' })
const byDate = (k, dir = 1) => (a, b) => dir * (a[k] - b[k])

router.get('/', async (req, res) => {
  const members = (await store.find('members', { where: { orgId: req.org.id } })).sort(byDate('createdAt'))
  const invites = (await store.find('invitations', { where: { orgId: req.org.id } })).filter((i) => !i.acceptedAt && i.expiresAt > new Date()).sort(byDate('createdAt', -1))
  res.json({
    myRole: req.org.role,
    members: members.map((m) => ({ id: m.id, fullName: m.userName, email: m.userEmail, role: m.role, joinedAt: iso(m.createdAt), isYou: m.id === req.user.id })),
    invitations: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, invitedAt: iso(i.createdAt), expiresAt: iso(i.expiresAt) })),
  })
})

router.post('/invitations', limiter(20, 60, 'Too many invitations. Try again later.'), async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { email, role } = parsed.data
  if (!canAssign(req.org.role, role)) return forbidden(res)
  if (await store.get('emailIndex', sha(email)))
    return res.status(409).json({ error: 'That email already has an AbiSentry account. Invite a different address.' })

  const raw = crypto.randomBytes(32).toString('base64url')
  for (const old of await store.find('invitations', { where: { orgId: req.org.id, email } })) if (!old.acceptedAt) await store.delete('invitations', old.id)
  await store.set('invitations', newId(), { orgId: req.org.id, orgName: req.org.name, email, role, tokenHash: sha(raw), invitedBy: req.user.id,
    inviterName: req.user.fullName, expiresAt: new Date(Date.now() + WEEK), acceptedAt: null, createdAt: new Date() })

  const url = `${CLIENT}/accept-invite?token=${raw}`
  await mailAll('Invite email', sendInvite({ to: email, inviter: req.user.fullName, org: req.org.name, role, url }))
  // With no email server configured, hand the link back to the inviter so it can be shared by hand.
  res.status(201).json({ ok: true, ...(emailConfigured() ? {} : { devLink: url }) })
})

router.delete('/invitations/:id', async (req, res) => {
  const inv = await store.get('invitations', req.params.id)
  if (!inv || inv.orgId !== req.org.id) return res.status(404).json({ error: 'Invitation not found.' })
  await store.delete('invitations', inv.id)
  res.json({ ok: true })
})

const target = async (req) => { const m = await store.get('members', req.params.userId); return m && m.orgId === req.org.id ? m : null }

router.patch('/members/:userId', async (req, res) => {
  const parsed = roleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid role.' })
  const t = await target(req)
  if (!t) return res.status(404).json({ error: 'Member not found.' })
  if (t.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' })
  if (!canAssign(req.org.role, t.role) || !canAssign(req.org.role, parsed.data.role)) return forbidden(res)
  await store.update('members', t.id, { role: parsed.data.role })
  res.json({ ok: true })
})

// Removing a teammate deletes their login, so they are signed out immediately.
router.delete('/members/:userId', async (req, res) => {
  const t = await target(req)
  if (!t) return res.status(404).json({ error: 'Member not found.' })
  if (t.id === req.user.id) return res.status(400).json({ error: 'You cannot remove yourself.' })
  if (!canAssign(req.org.role, t.role)) return forbidden(res)
  await store.tx(async (tx) => {
    const org = await tx.get('organisations', req.org.id)
    tx.delete('members', t.id)
    tx.delete('users', t.id)
    tx.delete('emailIndex', sha(t.userEmail))
    if (org) tx.update('organisations', org.id, { teamSize: Math.max(1, (org.teamSize || 1) - 1) })
  })
  for (const tok of await store.find('tokens', { where: { userId: t.id } })) await store.delete('tokens', tok.id)
  res.json({ ok: true })
})

export default router
