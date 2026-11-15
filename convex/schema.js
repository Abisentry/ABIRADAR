import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { TABLES } from './indexes.js'

// Documents keep their own id in `docId` and a change counter in `ver` (used to detect two people changing the same
// thing at once). Everything else is stored as given, so validation is off and only the indexes are declared here.
const tables = {}
for (const [name, indexes] of Object.entries(TABLES)) {
  const fields = { docId: v.string(), ver: v.number() }
  for (const [, cols] of indexes) for (const c of cols) fields[c] = v.optional(v.any())
  let t = defineTable(fields).index('by_docId', ['docId']) // "by_id" is reserved by Convex
  for (const [idx, cols] of indexes) t = t.index(idx, cols)
  tables[name] = t
}
tables.rates = defineTable({ key: v.string(), count: v.number(), resetAt: v.number() }).index('by_key', ['key'])

export default defineSchema(tables, { schemaValidation: false })
