-- ==============================================================================
-- CORREÇÃO EMERGENCIAL: FIX RLS RECURSION + CRIAÇÃO DE FUNÇÕES DE SUPORTE
-- Execute este bloco completo no SQL Editor do Supabase para sanar o erro
-- "infinite recursion detected in policy for relation organization_members"
-- ==============================================================================

-- 1. FUNÇÕES DE SUPORTE SECURITY DEFINER (ISENTAS DE RLS / ZERO RECURSÃO)
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS TABLE (organization_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(p_user_id uuid)
RETURNS TABLE (organization_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = COALESCE(p_user_id, auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_user_org_ids(uuid) TO authenticated;

-- 2. RECRIAÇÃO LIMPA DAS POLÍTICAS DE ORGANIZATIONS
DROP POLICY IF EXISTS organizations_member_select ON public.organizations;
DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
DROP POLICY IF EXISTS organizations_insert_authenticated ON public.organizations;
DROP POLICY IF EXISTS organizations_member_update ON public.organizations;
DROP POLICY IF EXISTS organizations_update_member ON public.organizations;

CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY organizations_insert_authenticated ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY organizations_update_member ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(id));

-- 3. RECRIAÇÃO DAS POLÍTICAS DE ORGANIZATION_MEMBERS (TOTALMENTE SEM RECURSÃO)
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
DROP POLICY IF EXISTS org_members_insert_authenticated ON public.organization_members;
DROP POLICY IF EXISTS org_members_insert ON public.organization_members;
DROP POLICY IF EXISTS org_members_admin_all ON public.organization_members;
DROP POLICY IF EXISTS org_members_delete ON public.organization_members;

-- Leitura: direto por user_id = auth.uid() (0% de subqueries, 0% recursão)
CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserção: vincula a si mesmo ou via is_org_member (SECURITY DEFINER)
CREATE POLICY org_members_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_org_member(organization_id));

-- Exclusão: desvincula a si mesmo
CREATE POLICY org_members_delete ON public.organization_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id));

-- 4. POLÍTICAS DE ISOLAMENTO NAS TABELAS DE NEGÓCIO (ULTRA RÁPIDAS COM is_org_member)
DROP POLICY IF EXISTS clients_org_isolation ON public.clients;
CREATE POLICY clients_org_isolation ON public.clients
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS products_org_isolation ON public.products;
CREATE POLICY products_org_isolation ON public.products
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS suppliers_org_isolation ON public.suppliers;
CREATE POLICY suppliers_org_isolation ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS sales_org_isolation ON public.sales;
CREATE POLICY sales_org_isolation ON public.sales
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS sale_items_org_isolation ON public.sale_items;
CREATE POLICY sale_items_org_isolation ON public.sale_items
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS purchase_orders_org_isolation ON public.purchase_orders;
CREATE POLICY purchase_orders_org_isolation ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS purchase_items_org_isolation ON public.purchase_items;
CREATE POLICY purchase_items_org_isolation ON public.purchase_items
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS manufacturing_orders_org_isolation ON public.manufacturing_orders;
CREATE POLICY manufacturing_orders_org_isolation ON public.manufacturing_orders
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS stock_movements_org_isolation ON public.stock_movements;
CREATE POLICY stock_movements_org_isolation ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS financial_records_org_isolation ON public.financial_records;
CREATE POLICY financial_records_org_isolation ON public.financial_records
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'movements') THEN
    DROP POLICY IF EXISTS movements_org_isolation ON public.movements;
    CREATE POLICY movements_org_isolation ON public.movements
      FOR ALL TO authenticated
      USING (public.is_org_member(organization_id))
      WITH CHECK (public.is_org_member(organization_id));
  END IF;
END $$;
