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
  request_time TIMESTAMPTZ := clock_timestamp();
  rate_window INTERVAL;
BEGIN
  IF char_length(p_key_hash) <> 64
     OR p_max_requests < 1
     OR p_window_seconds < 1 THEN
    RETURN FALSE;
  END IF;

  rate_window := make_interval(secs => p_window_seconds);

  INSERT INTO public.waitlist_rate_limits (key_hash, window_started_at, request_count)
  VALUES (p_key_hash, request_time, 1)
  ON CONFLICT (key_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN public.waitlist_rate_limits.window_started_at <= request_time - rate_window
          THEN request_time
        ELSE public.waitlist_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN public.waitlist_rate_limits.window_started_at <= request_time - rate_window
          THEN 1
        ELSE public.waitlist_rate_limits.request_count + 1
      END
  RETURNING request_count INTO current_count;

  RETURN current_count <= p_max_requests;
END;
$$;

