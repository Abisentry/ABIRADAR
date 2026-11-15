import { store } from './store/index.js'

// What each role may do. The frontend receives this list from /me, so it is defined only here.
const FULL = ['alerts:view', 'alerts:handle', 'team:manage']
export const PERMS = { owner: FULL, admin: FULL, analyst: ['alerts:view', 'alerts:handle'], viewer: ['alerts:view'] }
export const permissionsFor = (role) => PERMS[role] || []
export const can = (role, perm) => permissionsFor(role).includes(perm)

// Who may grant or take away which role. Only the owner manages admins; nobody changes the owner.
const ASSIGNABLE = { owner: ['admin', 'analyst', 'viewer'], admin: ['analyst', 'viewer'] }
export const canAssign = (actorRole, role) => (ASSIGNABLE[actorRole] || []).includes(role)

// A person belongs to one institution. Their membership document shares their user id.
export async function orgForUser(userId) {
  const m = await store.get('members', userId)
  if (!m) return null
  const org = await store.get('organisations', m.orgId)
  return org && { ...org, role: m.role }
}

export async function withOrg(req, res, next) {
  const org = await orgForUser(req.user.id)
  if (!org) return res.status(404).json({ error: 'No institution on this account.' })
  req.org = org // includes req.org.role
  next()
}

// need('a', 'b') passes if the role has ANY of the listed permissions.
export const need = (...perms) => (req, res, next) =>
  perms.some((p) => can(req.org.role, p)) ? next() : res.status(403).json({ error: 'Your role does not allow this.', code: 'FORBIDDEN' })
