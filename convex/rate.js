import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { guard } from './guard.js'

// Counts requests per key inside a time window, for rate limiting. A serverless function forgets everything between
// requests, so the count has to live in the database.
export const hit = mutation({
  args: { secret: v.string(), key: v.string(), windowMs: v.number() },
  handler: async (ctx, a) => {
    guard(a.secret)
    const now = Date.now()
    const cur = await ctx.db.query('rates').withIndex('by_key', (q) => q.eq('key', a.key)).unique()
    if (!cur) { await ctx.db.insert('rates', { key: a.key, count: 1, resetAt: now + a.windowMs }); return { count: 1, resetAt: now + a.windowMs } }
    if (cur.resetAt <= now) { await ctx.db.patch(cur._id, { count: 1, resetAt: now + a.windowMs }); return { count: 1, resetAt: now + a.windowMs } }
    await ctx.db.patch(cur._id, { count: cur.count + 1 })
    return { count: cur.count + 1, resetAt: cur.resetAt }
  },
})
