# Offtime website

Static website deployed on Vercel. Browser account creation/sign-in is at `/auth/`. Supabase Auth
owns email/password credentials; Offtime account profiles and waitlist data remain in PostgreSQL.
No credential or private database key belongs in this repository or the browser bundle.

## Local checks

```bash
npm test
npm run lint
npm run typecheck
OFFTIME_API_URL=http://127.0.0.1:8787 npm run build
npm start
```

For local end-to-end app testing, run the control plane with
`OFFTIME_WEBSITE_ORIGIN=http://127.0.0.1:4173`, build this site with the local API URL, and package
the app with `OFFTIME_WEBSITE_URL=http://127.0.0.1:4173` in development mode.

## Production

Enable Web Analytics for the project in the Vercel dashboard. Every page loads Vercel's
first-party analytics script; page views begin appearing after the next production deployment.

Set these Vercel environment variables:

- `OFFTIME_API_URL=https://<control-plane-host>` (required to enable browser authentication; the
  site still deploys without it and displays an unavailable message on `/auth/`)
- `OFFTIME_DOWNLOAD_URL=https://<download-host>/Offtime.dmg` (when the signed DMG is available)
- `OFFTIME_WAITLIST_END_AT=2026-09-27T00:00:00Z` (optional launch deadline override; when omitted,
  the countdown defaults to September 27, 2026 at 00:00 UTC)

The control plane must independently set `OFFTIME_WEBSITE_ORIGIN` to this deployment's exact HTTPS
origin. Preview deployments need their own backend/environment or explicit origin configuration;
do not use a wildcard CORS origin. Run `npm run build`; deploy only the generated `dist/` directory.

## Waitlist backend

The landing page sends `POST /v1/waitlist` to `OFFTIME_API_URL`. The endpoint and recommended
PostgreSQL schema, validation, rate limits, and export workflow are documented in
[`docs/waitlist-backend.md`](docs/waitlist-backend.md). The deployable Supabase migration is in
[`supabase/migrations`](supabase/migrations). The static website cannot store submissions
by itself; the Vercel deployment must provide server-only `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` environment variables before signups are accepted. When the API is on
the same Vercel deployment, `OFFTIME_API_URL` can be omitted.
