# Putting AbiSentry Gossip online: Netlify and Convex

The website and the API both run on Netlify (the API is a Netlify function). The data lives in Convex.
Commands are for Windows PowerShell, run in the project folder. I tested the Convex functions on a real local Convex
backend and the Netlify functions with Netlify-style requests, but I have not deployed to Netlify or Convex Cloud myself,
so follow any message they give if it differs from these notes.

## 1. Put the project on GitHub
Create a private repository and push the project. `.gitignore` already leaves out `.env`, `node_modules` and `data`.
Check `git status` shows no `.env` before you push.

## 2. Set up Convex (the database)
1. `npm install`
2. `npx convex dev`. The first time it opens a browser to sign in, then creates a project. Wait for "Convex functions ready",
   then press Ctrl+C. It adds `convex/_generated` (keep it) and a `.env.local` (do not commit it).
3. Make a secret that lets only your API use the database, and keep it for step 4:

        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

4. Give it to Convex, for the development and the live deployment:

        npx convex env set STORE_SECRET PASTE_THE_SECRET
        npx convex env set STORE_SECRET PASTE_THE_SECRET --prod

5. Send the functions to the live deployment (it asks you to confirm):

        npx convex deploy

6. In the Convex dashboard, open your project, switch to Production, and open Settings. Copy the Deployment URL
   (it ends in `.convex.cloud`). That is your live `CONVEX_URL`.

Anyone who learns that URL can call the functions, but every call must carry `STORE_SECRET`, so keep the secret private.

## 3. Create the Netlify site
1. In Netlify choose Add new site, Import from Git, and pick the repository. `netlify.toml` already holds the build settings.
2. Before the first deploy, open Site configuration, Environment variables, and add these. Mark the secret ones as secret.

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | your site address, for example `https://abisentrytechnologies.com` (or the `.netlify.app` one for now) |
| `JWT_SECRET` | a new long random value (not your local one) |
| `CONVEX_URL` | the live Deployment URL from step 2 |
| `STORE_SECRET` | the secret from step 2 |
| `INTERNAL_SECRET` | another new long random value |
| `ALERT_EMAILS` | `background` |
| `ADMIN_EMAILS` | your owner email |
| `ADMIN_NAME` | your name |
| `ADMIN_PASSWORD` | your owner password (12+ characters), for the first deploy only |
| `NOTIFY_EMAIL` | where new-signup notices go |
| `EMAIL_PROVIDER` | `altermail` |
| `EMAIL_API_KEY` | your Altermail key |
| `MAIL_FROM` | `AbiSentry Gossip <alerts@abisentrytechnologies.com>` |

   Netlify limits all the values together to about 4 KB for functions. This list fits.
3. Deploy the site.

## 4. Check it
- Open `YOUR-SITE/api/health`. You should see `{"ok":true,"store":"convex"}`.
- Log in at your site with `ADMIN_EMAILS` and `ADMIN_PASSWORD`. Then delete `ADMIN_PASSWORD` from the variables and deploy again.
- If something fails, open the site in Netlify, then Logs, then Functions, and read the `api` function's log.
- If you want to use your own domain, add it under Domain management. Your domain's DNS already points at Netlify, so this is quick. Then change `CLIENT_ORIGIN` to it and deploy again.

## How alert emails are sent
Sending an alert saves it and shows it in every dashboard at once. The emails are then handed to a second function,
`send-alert-emails-background`, which Netlify lets run for up to 15 minutes. It sends about 50 a minute for Altermail, whose limit
is 60 a minute and 100 a day on the free plan. Look at that function's log in Netlify to follow progress.

## Things to know
- A normal Netlify function must answer within about 30 seconds. Everything the website asks of the API is quick, and the slow job is in the background function.
- Rate limits (login attempts and so on) are counted in Convex, because a function remembers nothing between requests.
- The first request after a quiet period is slower while a function starts up.
- Reading pages refresh every few seconds while open. That is fine for a few hundred users. At larger scale, lengthen the refresh time in the website.
- Totals such as an institution's open alerts are small tallies recounted after each change, because the database cannot add things up for us.
- Backups: check what your Convex plan offers, and export your data before big changes.
- Data from earlier versions (the local file, Postgres, Firestore) does not carry over. Live data starts empty, apart from your owner login and the starting fraud library.
