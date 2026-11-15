import { sendAlertEmails } from '../../server/src/alertEmails.js'

// A Netlify "background function" (the name ends in -background): the caller gets an answer straight away and this
// keeps running for up to 15 minutes, which is what sending a long list of emails slowly needs.
export const handler = async (event) => {
  const secret = process.env.INTERNAL_SECRET
  if (!secret || event.headers?.['x-internal-secret'] !== secret) return { statusCode: 401 }
  const { alertId } = JSON.parse(event.body || '{}')
  if (alertId) console.log(`Sent ${await sendAlertEmails(alertId)} alert emails for ${alertId}`)
  return { statusCode: 200 }
}
