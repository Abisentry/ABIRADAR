# AbiSentry Gossip

A fraud alert network for institutions. The owner sends alerts with clear steps to protect against a threat; each
institution records what it did. One project: the website (React), the API (a Netlify function), and the database (Convex).

    abisentry/
      src/            the website
      server/src/     the API (Express)
      server/test/    tests
      convex/         the database functions and indexes (Convex)
      netlify/        the API and the background email job as Netlify functions
      netlify.toml    Netlify settings

## Run it on your computer
1. `npm install`
2. Copy `.env.example` to `.env`. Set `JWT_SECRET`, and `ADMIN_EMAILS` / `ADMIN_PASSWORD` for your owner login. Leave `EMAIL_PROVIDER=console` and the database settings empty.
3. In one terminal run `npm run server` (the API, on port 4000), and in another `npm run dev` (the website, on port 5173).

With `EMAIL_PROVIDER=console`, verification and password-reset links are printed in the server terminal on a line starting `LINK:`.
Data is kept in `data/store.json`.

## Tests
`npm test` checks email and the whole product with no outside services. `npm run test:convex` runs the whole product against
a Convex deployment (set `CONVEX_URL` and `STORE_SECRET` first). It writes test data, so use a throwaway deployment, never your live one.

## Putting it online
See DEPLOY.md.
