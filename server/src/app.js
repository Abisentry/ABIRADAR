import 'dotenv/config'
import 'express-async-errors' // lets async route handlers pass errors to the handler below
import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { store } from './store/index.js'
import authRoutes from './auth.js'
import dashboardRoutes from './dashboard.js'
import adminRoutes from './admin.js'
import teamRoutes from './team.js'
import { seedAdmin, seedContent } from './seed.js'

export const app = express()
// Number of proxies in front of the app, for finding the visitor's address.
app.set('trust proxy', Number(process.env.TRUST_PROXY) || false)
app.use(helmet())
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// Creates the owner login and the starting fraud library, once per start. On Netlify "start" means each cold start.
let started
export const ready = () => (started ??= (async () => { await seedAdmin(); await seedContent() })())
app.use(async (_req, _res, next) => { await ready(); next() })

app.get('/api/health', (_req, res) => res.json({ ok: true, store: store.kind }))
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/team', teamRoutes)
app.use('/api', dashboardRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.type === 'entity.parse.failed' ? 400 : 500).json({ error: 'Something went wrong. Please try again.' })
})
