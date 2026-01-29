-- Fix insecure RLS policy on public.user_profiles (currently USING true)
-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Remove insecure policy if it exists
DROP POLICY IF EXISTS "Admins podem ver tudo" ON public.user_profiles;

-- Admin-only access for all commands (PII table)
CREATE POLICY "user_profiles_admin_all"
ON public.user_profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
