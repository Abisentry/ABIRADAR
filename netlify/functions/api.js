import serverless from 'serverless-http'
import { app } from '../../server/src/app.js'

// The whole API, as one Netlify function. Netlify may hand us the original path (/api/...) or the function's own
// path (/.netlify/functions/api/api/...), so the function's prefix is removed if it is there.
const PREFIX = '/.netlify/functions/api'
const run = serverless(app)

export const handler = (event, context) => {
  if (event.path?.startsWith(PREFIX)) event.path = event.path.slice(PREFIX.length) || '/'
  return run(event, context)
}
