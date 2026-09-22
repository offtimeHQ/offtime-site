-- Link Offtime application profiles to identities owned by Supabase Auth.
-- Existing password hashes remain temporarily readable for rollback, but the
-- production service never consults them when Supabase Auth is configured.
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_auth_user_id_idx
  ON public.user_accounts(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.user_accounts.auth_user_id IS
  'Supabase auth.users.id; null only for accounts awaiting first verified Supabase sign-in';
