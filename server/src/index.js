// Runs the API as a normal server (local development). On Netlify the same app is served by netlify/functions/api.js.
import { app, ready } from './app.js'
import { store } from './store/index.js'
import { describeEmail } from './email.js'

await ready()
const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`AbiSentry API listening on http://localhost:${port} (data: ${store.kind})`)
  console.log(`Email: ${describeEmail()}`)
})
