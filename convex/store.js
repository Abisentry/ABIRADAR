import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { TABLES, plan } from './indexes.js'
import { guard } from './guard.js'

const table = (col) => { if (!TABLES[col]) throw new Error(`Unknown collection ${col}`); return col }
const clean = (d) => (d ? Object.fromEntries(Object.entries(d).filter(([k]) => k !== '_id' && k !== '_creationTime')) : null)
const row = (ctx, col, id) => ctx.db.query(table(col)).withIndex('by_docId', (q) => q.eq('docId', id)).unique()

async function run(ctx, { col, where, orderBy, limit }) {
  table(col)
  const keys = Object.keys(where || {})
  const p = plan(col, keys, orderBy?.[0])
  if (!p) throw new Error(`No index for ${col}(${keys.join(', ')}${orderBy ? ' order by ' + orderBy[0] : ''})`)
  let q = ctx.db.query(col)
  if (p.name) q = q.withIndex(p.name, (b) => p.eq.reduce((x, f) => x.eq(f, where[f]), b))
  if (orderBy) q = q.order(orderBy[1] === 'desc' ? 'desc' : 'asc')
  const rows = !p.rest.length && limit ? await q.take(limit) : await q.collect()
  const kept = rows.filter((d) => p.rest.every((k) => d[k] === where[k]))
  return (limit ? kept.slice(0, limit) : kept).map(clean)
}

export const get = query({
  args: { secret: v.string(), col: v.string(), id: v.string() },
  handler: async (ctx, a) => { guard(a.secret); return clean(await row(ctx, a.col, a.id)) },
})

export const find = query({
  args: { secret: v.string(), col: v.string(), where: v.any(), orderBy: v.optional(v.array(v.string())), limit: v.optional(v.number()) },
  handler: async (ctx, a) => { guard(a.secret); return run(ctx, a) },
})

export const count = query({
  args: { secret: v.string(), col: v.string(), where: v.any() },
  handler: async (ctx, a) => { guard(a.secret); return (await run(ctx, { col: a.col, where: a.where })).length },
})

// Applies a list of writes all together, or none of them. `reads` are documents the caller looked at first: if any of
// them has changed since, nothing is written and the caller starts again.
export const apply = mutation({
  args: {
    secret: v.string(),
    ops: v.array(v.object({ type: v.string(), col: v.string(), id: v.string(), data: v.optional(v.any()) })),
    reads: v.optional(v.array(v.object({ col: v.string(), id: v.string(), ver: v.number() }))),
  },
  handler: async (ctx, a) => {
    guard(a.secret)
    for (const r of a.reads ?? []) if (((await row(ctx, r.col, r.id))?.ver ?? 0) !== r.ver) return { ok: false }
    for (const o of a.ops) {
      const cur = await row(ctx, o.col, o.id)
      if (o.type === 'set') {
        const doc = { ...o.data, docId: o.id, ver: (cur?.ver ?? 0) + 1 }
        if (cur) await ctx.db.replace(cur._id, doc); else await ctx.db.insert(o.col, doc)
      } else if (o.type === 'update') {
        if (!cur) throw new Error(`NOT_FOUND: ${o.col}/${o.id}`)
        await ctx.db.patch(cur._id, { ...o.data, ver: cur.ver + 1 })
      } else if (o.type === 'delete') {
        if (cur) await ctx.db.delete(cur._id)
      } else throw new Error(`Unknown operation ${o.type}`)
    }
    return { ok: true }
  },
})
