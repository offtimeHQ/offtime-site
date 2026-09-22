CREATE TABLE public.waitlist_rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL,
  CONSTRAINT waitlist_rate_limits_key_hash_length CHECK (char_length(key_hash) = 64),
  CONSTRAINT waitlist_rate_limits_request_count_positive CHECK (request_count > 0)
);

CREATE INDEX waitlist_rate_limits_window_started_idx
  ON public.waitlist_rate_limits (window_started_at);

CREATE OR REPLACE FUNCTION public.consume_waitlist_rate_limit(
  p_key_hash TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_count INTEGER;
  current_time TIMESTAMPTZ := clock_timestamp();
  rate_window INTERVAL;
BEGIN
  IF char_length(p_key_hash) <> 64
     OR p_max_requests < 1
     OR p_window_seconds < 1 THEN
    RETURN FALSE;
  END IF;

  rate_window := make_interval(secs => p_window_seconds);

  INSERT INTO public.waitlist_rate_limits (key_hash, window_started_at, request_count)
  VALUES (p_key_hash, current_time, 1)
  ON CONFLICT (key_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN public.waitlist_rate_limits.window_started_at <= current_time - rate_window
          THEN current_time
        ELSE public.waitlist_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN public.waitlist_rate_limits.window_started_at <= current_time - rate_window
          THEN 1
        ELSE public.waitlist_rate_limits.request_count + 1
      END
  RETURNING request_count INTO current_count;

  RETURN current_count <= p_max_requests;
END;
$$;

ALTER TABLE public.waitlist_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.waitlist_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_waitlist_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_waitlist_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON TABLE public.waitlist_rate_limits IS
  'Hashed, non-PII counters used by the waitlist endpoint to limit abuse.';

