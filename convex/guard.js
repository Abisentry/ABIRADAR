// These functions are reachable by anyone who knows the deployment address, so every call must carry the shared
// secret (STORE_SECRET, set in the Convex dashboard and in the app's settings).
export function guard(secret) {
  const want = process.env.STORE_SECRET
  if (!want || typeof secret !== 'string' || secret.length !== want.length) throw new Error('Not allowed')
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= secret.charCodeAt(i) ^ want.charCodeAt(i)
  if (diff) throw new Error('Not allowed')
}
