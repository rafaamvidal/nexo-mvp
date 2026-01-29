-- 1) Expand enum public.app_role (keep existing values like 'staff')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'estoque'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'estoque';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'vendas'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'vendas';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'financeiro'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'financeiro';
  END IF;
END $$;

-- 2) Roles table (roles MUST NOT live in profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User can read own roles
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin can manage all roles
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Profiles table (no role column)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User can read own profile
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- User can update own profile (keep constrained to own row)
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can read all profiles
DROP POLICY IF EXISTS profiles_admin_select_all ON public.profiles;
CREATE POLICY profiles_admin_select_all
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert/update profiles (needed for invitations/RPC flows)
DROP POLICY IF EXISTS profiles_admin_upsert ON public.profiles;
CREATE POLICY profiles_admin_upsert
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS profiles_admin_update_all ON public.profiles;
CREATE POLICY profiles_admin_update_all
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Invitations table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'Pendente',
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_email_status
ON public.staff_invitations (email, status);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Only admin can manage invitations
DROP POLICY IF EXISTS staff_invitations_admin_all ON public.staff_invitations;
CREATE POLICY staff_invitations_admin_all
ON public.staff_invitations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) RPC to accept invitation on first login/signup
CREATE OR REPLACE FUNCTION public.accept_staff_invitation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_norm_email text;
  v_inv public.staff_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Robust email extraction (Supabase JWT)
  v_email := NULLIF(auth.jwt() ->> 'email', '');
  IF v_email IS NULL THEN
    v_email := NULLIF((current_setting('request.jwt.claims', true)::json ->> 'email'), '');
  END IF;

  IF v_email IS NULL THEN
    -- If we cannot read email from token, do nothing (do not block login)
    RETURN;
  END IF;

  v_norm_email := lower(trim(v_email));

  SELECT *
    INTO v_inv
  FROM public.staff_invitations
  WHERE email = v_norm_email
    AND status = 'Pendente'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, email, status)
  VALUES (auth.uid(), v_norm_email, 'Ativo')
  ON CONFLICT (id)
  DO UPDATE SET email = EXCLUDED.email;

  -- Apply role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), v_inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark invite accepted
  UPDATE public.staff_invitations
  SET status = 'Aceito', accepted_at = now()
  WHERE id = v_inv.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_staff_invitation() TO authenticated;
