-- 1) Enum dedicado para o cargo da ALLOWLIST (não usar app_role, que é de permissões)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'allowlist_role') THEN
    CREATE TYPE public.allowlist_role AS ENUM ('admin', 'estoque', 'vendas', 'financeiro', 'rh');
  END IF;
END $$;

-- 2) Tabela de cargos da allowlist (separada de user_profiles)
CREATE TABLE IF NOT EXISTS public.user_profile_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role public.allowlist_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_profile_id)
);

ALTER TABLE public.user_profile_roles ENABLE ROW LEVEL SECURITY;

-- 3) RLS: somente admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profile_roles'
      AND policyname = 'user_profile_roles_admin_all'
  ) THEN
    CREATE POLICY "user_profile_roles_admin_all"
    ON public.user_profile_roles
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- 4) (Opcional recomendado) garantir email único por caixa baixa
-- OBS: se já houver duplicados, esta etapa falhará; me avise que eu te passo o SQL para localizar e resolver.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_lower_unique
  ON public.user_profiles ((lower(email)));

-- 5) Migração de dados: copiar user_profiles.role -> user_profile_roles.role (somente valores conhecidos)
INSERT INTO public.user_profile_roles (user_profile_id, role)
SELECT
  up.id,
  CASE lower(trim(up.role))
    WHEN 'admin' THEN 'admin'::public.allowlist_role
    WHEN 'estoque' THEN 'estoque'::public.allowlist_role
    WHEN 'vendas' THEN 'vendas'::public.allowlist_role
    WHEN 'financeiro' THEN 'financeiro'::public.allowlist_role
    WHEN 'rh' THEN 'rh'::public.allowlist_role
    ELSE NULL
  END AS role
FROM public.user_profiles up
WHERE up.role IS NOT NULL
  AND lower(trim(up.role)) IN ('admin','estoque','vendas','financeiro','rh')
ON CONFLICT (user_profile_id)
DO UPDATE SET role = EXCLUDED.role;