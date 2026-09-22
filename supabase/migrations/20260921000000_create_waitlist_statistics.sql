CREATE TYPE public.waitlist_interest AS ENUM ('earning', 'compute');

CREATE TABLE public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  interest public.waitlist_interest NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'website',
  CONSTRAINT waitlist_email_normalized CHECK (email = lower(trim(email))),
  CONSTRAINT waitlist_email_length CHECK (char_length(email) BETWEEN 3 AND 254)
);

CREATE UNIQUE INDEX waitlist_entries_email_unique
  ON public.waitlist_entries (email);

CREATE INDEX waitlist_entries_interest_created_idx
  ON public.waitlist_entries (interest, created_at);

-- This contains aggregate counts only. It is kept separate from email addresses so
-- operational dashboards do not need access to personally identifiable information.
CREATE TABLE public.waitlist_daily_statistics (
  statistic_date DATE NOT NULL,
  interest public.waitlist_interest NOT NULL,
  entry_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (statistic_date, interest),
  CONSTRAINT waitlist_daily_statistics_entry_count_nonnegative CHECK (entry_count >= 0)
);

CREATE OR REPLACE FUNCTION public.set_waitlist_entry_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_waitlist_entry_updated_at
BEFORE UPDATE ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_waitlist_entry_updated_at();

CREATE OR REPLACE FUNCTION public.update_waitlist_daily_statistics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_statistic_date DATE;
  new_statistic_date DATE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_statistic_date := (OLD.created_at AT TIME ZONE 'UTC')::DATE;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_statistic_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.waitlist_daily_statistics (statistic_date, interest, entry_count)
    VALUES (new_statistic_date, NEW.interest, 1)
    ON CONFLICT (statistic_date, interest) DO UPDATE
      SET entry_count = public.waitlist_daily_statistics.entry_count + 1,
          updated_at = NOW();
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND (OLD.interest, old_statistic_date)
                                  IS DISTINCT FROM (NEW.interest, new_statistic_date)) THEN
    UPDATE public.waitlist_daily_statistics
    SET entry_count = entry_count - 1,
        updated_at = NOW()
    WHERE statistic_date = old_statistic_date
      AND interest = OLD.interest;

    DELETE FROM public.waitlist_daily_statistics
    WHERE statistic_date = old_statistic_date
      AND interest = OLD.interest
      AND entry_count = 0;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (OLD.interest, old_statistic_date)
           IS DISTINCT FROM (NEW.interest, new_statistic_date) THEN
    INSERT INTO public.waitlist_daily_statistics (statistic_date, interest, entry_count)
    VALUES (new_statistic_date, NEW.interest, 1)
    ON CONFLICT (statistic_date, interest) DO UPDATE
      SET entry_count = public.waitlist_daily_statistics.entry_count + 1,
          updated_at = NOW();
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_waitlist_daily_statistics
AFTER INSERT OR UPDATE OF interest, created_at OR DELETE ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_waitlist_daily_statistics();

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_daily_statistics ENABLE ROW LEVEL SECURITY;

-- Signups must go through the trusted control-plane endpoint. No policies are
-- intentionally created for anon or authenticated users.
REVOKE ALL ON TABLE public.waitlist_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.waitlist_daily_statistics FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_waitlist_entry_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_waitlist_daily_statistics() FROM PUBLIC, anon, authenticated;

GRANT USAGE ON TYPE public.waitlist_interest TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.waitlist_entries TO service_role;
GRANT SELECT ON TABLE public.waitlist_daily_statistics TO service_role;

COMMENT ON TABLE public.waitlist_entries IS
  'Unique waitlist members. Accessible only to trusted backend and administrative roles.';
COMMENT ON TABLE public.waitlist_daily_statistics IS
  'Current waitlist member counts grouped by original UTC signup date and interest.';
