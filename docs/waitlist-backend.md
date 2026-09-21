# Waitlist backend contract

Waitlist emails should live in the existing control plane's PostgreSQL database—not in frontend
JavaScript, Git, Vercel static files, logs, or a personal inbox. This keeps one authoritative,
access-controlled list next to the rest of Offtime's server-side data.

## PostgreSQL table

Apply an equivalent migration in the control-plane repository:

```sql
CREATE TYPE waitlist_interest AS ENUM ('earning', 'compute');

CREATE TABLE waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  interest waitlist_interest NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'website',
  CONSTRAINT waitlist_email_normalized CHECK (email = lower(trim(email))),
  CONSTRAINT waitlist_email_length CHECK (char_length(email) BETWEEN 3 AND 254)
);

CREATE UNIQUE INDEX waitlist_entries_email_unique ON waitlist_entries (email);
CREATE INDEX waitlist_entries_interest_created_idx ON waitlist_entries (interest, created_at);
```

## HTTP endpoint

Implement `POST /v1/waitlist` in the control plane. It receives:

```json
{ "email": "person@example.com", "interest": "earning", "website": "" }
```

Server behavior:

1. Require `Content-Type: application/json` and cap the body size (for example, 2 KB).
2. Reject a non-empty `website` honeypot without writing a row.
3. Trim and lowercase the email, validate it, and accept only `earning` or `compute`.
4. Rate-limit by IP and normalized email. Do not store raw IP addresses in the waitlist table.
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

Use parameterized queries and the control plane's existing database pool. Keep database credentials
only in that backend's environment. Restrict table access to the API service role and administrators.

## Operations

- View totals grouped by demand: `SELECT interest, count(*) FROM waitlist_entries GROUP BY interest;`
- Export only from an authenticated admin job or database console. Never add a public list endpoint.
- Add unsubscribe/suppression handling before sending marketing email, and use a transactional email
  provider rather than sending directly from the request handler.
- Back up the table with the control plane and delete an entry when a person makes a verified privacy
  request. Retain it only as long as needed for launch communication.
- Log request IDs and aggregate outcomes, not email addresses or request bodies.