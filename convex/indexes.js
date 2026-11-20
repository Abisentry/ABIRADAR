// Every table and the indexes it has. The Convex schema is built from this list, the Convex functions use it to pick
// an index for each query, and the local test store refuses any query that no index here could answer.
export const TABLES = {
  users: [["by_email", ["email"]]],
  emailIndex: [],
  tokens: [["by_userId", ["userId"]]],
  organisations: [["by_createdAt", ["createdAt"]]],
  members: [["by_orgId", ["orgId"]]],
  invitations: [
    ["by_orgId", ["orgId"]],
    ["by_tokenHash", ["tokenHash"]],
  ],
  alerts: [["by_createdAt", ["createdAt"]]],
  deliveries: [
    ["by_orgId_sentAt", ["orgId", "sentAt"]],
    ["by_alertId", ["alertId"]],
  ],
  incidentReports: [
    ["by_orgId", ["orgId"]],
    ["by_createdAt", ["createdAt"]],
    ["by_status", ["status"]],
  ],
  fraudEntries: [
    ["by_sort", ["sort"]],
    ["by_name", ["name"]],
  ],
  posts: [["by_kind", ["kind"]]],
  // Mandatory 2FA challenges
  twoFactorChallenges: [
    ["by_userId", ["userId"]],
    ["by_expiresAt", ["expiresAt"]],
  ],
};

// Which index answers a query? Equality on the index's first fields, then optionally an ordering on the next one.
// Other equality conditions are checked on the rows that come back. Returns null if no index fits.
export function plan(col, whereKeys, orderField) {
  if (!TABLES[col]) return null
  if (!whereKeys.length && !orderField) return { name: null, eq: [], rest: [] }
  let best = null
  for (const [name, fields] of TABLES[col]) {
    let n = 0
    while (n < fields.length && whereKeys.includes(fields[n])) n++
    if (orderField ? fields[n] !== orderField : n === 0) continue
    if (!best || n > best.eq.length) best = { name, eq: fields.slice(0, n), rest: whereKeys.filter((k) => !fields.slice(0, n).includes(k)) }
  }
  return best
}
