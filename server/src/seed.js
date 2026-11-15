import bcrypt from 'bcryptjs'
import { store, newId } from './store/index.js'
import { sha } from './util.js'
import { SEED_ENTRIES } from './seedContent.js'

// Creates the platform owner's login from .env, so they never go through the institution signup.
// First address in ADMIN_EMAILS + ADMIN_PASSWORD. Does nothing if that account already exists.
export async function seedAdmin() {
  const email = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)[0]
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) return
  if (await store.get('emailIndex', sha(email))) return
  if (password.length < 12) return console.warn('ADMIN_PASSWORD must be at least 12 characters, so no admin was created.')
  const id = newId()
  await store.set('users', id, { email, passwordHash: bcrypt.hashSync(password, 12), fullName: process.env.ADMIN_NAME || 'Platform Admin',
    emailVerifiedAt: new Date(), sessionVersion: 0, failedLogins: 0, lockedUntil: null, createdAt: new Date() })
  await store.set('emailIndex', sha(email), { userId: id })
  console.log(`Created platform admin ${email}. Now delete ADMIN_PASSWORD from your settings.`)
}

// First start only: fills the fraud library with a starting set. After that the owner edits it from the dashboard.
export async function seedContent() {
  if ((await store.count('fraudEntries')) > 0) return
  let sort = 0
  for (const e of SEED_ENTRIES)
    await store.set('fraudEntries', newId(), { name: e.name, summary: e.summary, signs: e.signs, steps: e.steps, published: true, sort: sort++, updatedAt: new Date() })
}
