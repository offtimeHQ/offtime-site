# Offtime website

Static website deployed on Vercel. Browser account creation/sign-in is at `/auth/`; account data and
password hashes remain in the Offtime control plane's PostgreSQL database, never in this repository
or the browser bundle.

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

Set these Vercel environment variables:

- `OFFTIME_API_URL=https://<control-plane-host>` (required to enable browser authentication; the
  site still deploys without it and displays an unavailable message on `/auth/`)
- `OFFTIME_DOWNLOAD_URL=https://<download-host>/Offtime.dmg` (when the signed DMG is available)

The control plane must independently set `OFFTIME_WEBSITE_ORIGIN` to this deployment's exact HTTPS
origin. Preview deployments need their own backend/environment or explicit origin configuration;
do not use a wildcard CORS origin. Run `npm run build`; deploy only the generated `dist/` directory.