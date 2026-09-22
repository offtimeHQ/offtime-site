# Waitlist backend contract

Waitlist emails should live in the existing control plane's PostgreSQL database—not in frontend
JavaScript, Git, Vercel static files, logs, or a personal inbox. This keeps one authoritative,
access-controlled list next to the rest of Offtime's server-side data.

## Supabase tables

Apply [`supabase/migrations/20260921000000_create_waitlist_statistics.sql`](../supabase/migrations/20260921000000_create_waitlist_statistics.sql)
to the Supabase project used by the control plane. It creates:

- `waitlist_entries`, the unique, authoritative list containing email addresses and interests.
- `waitlist_daily_statistics`, aggregate counts grouped by UTC signup date and interest. Triggers
  keep this table synchronized when an entry is inserted, removed, or changes interest.

Both tables have row-level security enabled and deliberately expose no policies to `anon` or
`authenticated`. Only the control plane's `service_role` and Supabase administrators can access
them. Never put the service-role key in this website or any other browser bundle.

## HTTP endpoint

The Vercel function at `api/v1/waitlist.js` implements `POST /v1/waitlist`. It receives:

```json
{ "email": "person@example.com", "interest": "earning", "website": "" }
```

Server behavior:

1. Require `Content-Type: application/json` and cap the body size (for example, 2 KB).
2. Reject a non-empty `website` honeypot without writing a row.
3. Trim and lowercase the email, validate it, and accept only `earning` or `compute`.
4. Rate-limit by HMAC-hashed IP and normalized email. Raw IP addresses are never stored.
5. Upsert on email so repeat signup updates the interest and `updated_at`:

   ```sql
   INSERT INTO waitlist_entries (email, interest)
   VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE
   SET interest = EXCLUDED.interest, updated_at = NOW();
   ```

6. Return `200 {"ok":true}` for both new and existing emails to avoid revealing membership.
7. Allow CORS only from the exact `OFFTIME_WEBSITE_ORIGIN`; handle `OPTIONS`, and allow `POST` plus
   the `Content-Type` header. Never use `*` in production.

The function talks to Supabase with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep both in
Vercel's server-side environment; never prefix the service-role key with `NEXT_PUBLIC_` or include
it in a browser bundle. For a separate frontend origin, set `OFFTIME_WEBSITE_ORIGIN` to its exact
HTTPS origin.

## Operations

- View totals grouped by demand: `SELECT interest, count(*) FROM waitlist_entries GROUP BY interest;`
- View the daily time series without querying emails:
  `SELECT * FROM waitlist_daily_statistics ORDER BY statistic_date, interest;`
- Export only from an authenticated admin job or database console. Never add a public list endpoint.
- Add unsubscribe/suppression handling before sending marketing email, and use a transactional email
  provider rather than sending directly from the request handler.
- Back up the table with the control plane and delete an entry when a person makes a verified privacy
  request. Retain it only as long as needed for launch communication.
- Log request IDs and aggregate outcomes, not email addresses or request bodies.
