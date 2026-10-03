-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA: ISOLAMENTO TOTAL MULTI-TENANT (ZERO VAZAMENTO DE DADOS)
-- Execute este script completo no SQL Editor do Supabase.
-- 
-- O que este script faz:
-- 1. Remove todas as políticas legadas single-tenant (role 'admin' global)
-- 2. Limpa membros acidentalmente vinculados à 'Empresa Principal'
-- 3. Garante que os registros antigos pertençam à 'Empresa Principal'
-- 4. Aplica políticas RLS puras de isolamento por organization_id (is_org_member)
-- 5. Atualiza o trigger padrão para vincular à empresa ativa do usuário
-- ==============================================================================

BEGIN;

-- 1. ATRIBUIR DADOS ANTIGOS (COM organization_id NULL) À EMPRESA PRINCIPAL
UPDATE public.clients SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.products SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.suppliers SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.sales SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.purchase_orders SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.manufacturing_orders SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.financial_records SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;

-- Tabelas dependentes herdando organization_id
UPDATE public.sale_items si
SET organization_id = COALESCE((SELECT s.organization_id FROM public.sales s WHERE s.id = si.sale_id), 'a0000000-0000-0000-0000-000000000001'::uuid)
WHERE si.organization_id IS NULL;

UPDATE public.purchase_items pi
SET organization_id = COALESCE((SELECT po.organization_id FROM public.purchase_orders po WHERE po.id = pi.purchase_order_id), 'a0000000-0000-0000-0000-000000000001'::uuid)
WHERE pi.organization_id IS NULL;

UPDATE public.stock_movements sm
SET organization_id = COALESCE((SELECT p.organization_id FROM public.products p WHERE p.id = sm.product_id), 'a0000000-0000-0000-0000-000000000001'::uuid)
WHERE sm.organization_id IS NULL;

-- 2. DESVINCULAR USUÁRIOS QUE CRIARAM SUA PRÓPRIA EMPRESA DA 'EMPRESA PRINCIPAL'
-- Isso garante que clientes novos NÃO fiquem vinculados à Empresa Principal de teste.
DELETE FROM public.organization_members om
WHERE om.organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid
  AND om.user_id IN (
    SELECT other_om.user_id
    FROM public.organization_members other_om
    WHERE other_om.organization_id <> 'a0000000-0000-0000-0000-000000000001'::uuid
  )
  AND om.user_id NOT IN (
    -- Mantém sempre o admin do sistema vinculado à Empresa Principal
    SELECT id FROM auth.users WHERE email = 'admin@erp.com.br'
  );

-- 3. REMOVER TODAS AS POLÍTICAS LEGADAS DE TODAS AS TABELAS
-- (No Postgres, políticas são combinadas com OR. Se uma política legada permitir admin ver tudo, vaza dados!)

-- PRODUCTS
DROP POLICY IF EXISTS products_authenticated_only ON public.products;
DROP POLICY IF EXISTS products_admin_estoque_all ON public.products;
DROP POLICY IF EXISTS products_org_isolation ON public.products;

-- CLIENTS
DROP POLICY IF EXISTS clients_authenticated_only ON public.clients;
DROP POLICY IF EXISTS clients_admin_vendas_all ON public.clients;
DROP POLICY IF EXISTS clients_org_isolation ON public.clients;

-- SUPPLIERS
DROP POLICY IF EXISTS suppliers_authenticated_only ON public.suppliers;
DROP POLICY IF EXISTS suppliers_admin_estoque_all ON public.suppliers;
DROP POLICY IF EXISTS suppliers_org_isolation ON public.suppliers;

-- SALES
DROP POLICY IF EXISTS sales_authenticated_only ON public.sales;
DROP POLICY IF EXISTS sales_admin_vendas_all ON public.sales;
DROP POLICY IF EXISTS sales_org_isolation ON public.sales;

-- SALE_ITEMS
DROP POLICY IF EXISTS sale_items_authenticated_only ON public.sale_items;
DROP POLICY IF EXISTS sale_items_admin_vendas_all ON public.sale_items;
DROP POLICY IF EXISTS sale_items_org_isolation ON public.sale_items;

-- PURCHASE_ORDERS
DROP POLICY IF EXISTS purchase_orders_authenticated_only ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_admin_estoque_all ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_org_isolation ON public.purchase_orders;

-- PURCHASE_ITEMS
DROP POLICY IF EXISTS purchase_items_authenticated_only ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_admin_estoque_all ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_org_isolation ON public.purchase_items;

-- MANUFACTURING_ORDERS
DROP POLICY IF EXISTS manufacturing_orders_authenticated_only ON public.manufacturing_orders;
DROP POLICY IF EXISTS manufacturing_orders_admin_all ON public.manufacturing_orders;
DROP POLICY IF EXISTS manufacturing_orders_org_isolation ON public.manufacturing_orders;

-- STOCK_MOVEMENTS
DROP POLICY IF EXISTS stock_movements_select ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_insert ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_update ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_delete ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_admin_estoque_select ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_admin_estoque_insert ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_no_update ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_no_delete ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_org_isolation ON public.stock_movements;

-- MOVEMENTS (legado se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'movements') THEN
    DROP POLICY IF EXISTS movements_authenticated_only ON public.movements;
    DROP POLICY IF EXISTS movements_admin_estoque_all ON public.movements;
    DROP POLICY IF EXISTS movements_org_isolation ON public.movements;
    
    CREATE POLICY movements_org_isolation ON public.movements
      FOR ALL TO authenticated
      USING (public.is_org_member(organization_id))
      WITH CHECK (public.is_org_member(organization_id));
  END IF;
END $$;

-- FINANCIAL_RECORDS
DROP POLICY IF EXISTS financial_records_all ON public.financial_records;
DROP POLICY IF EXISTS financial_records_authenticated_only ON public.financial_records;
DROP POLICY IF EXISTS financial_records_admin_financeiro_all ON public.financial_records;
DROP POLICY IF EXISTS financial_records_org_isolation ON public.financial_records;

-- 4. RECRIAR POLÍTICAS PURAS DE ISOLAMENTO MULTI-TENANT
-- Cada empresa vê única e exclusivamente os registros onde o usuário logado é membro dela.

CREATE POLICY products_org_isolation ON public.products
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY clients_org_isolation ON public.clients
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY suppliers_org_isolation ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY sales_org_isolation ON public.sales
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY sale_items_org_isolation ON public.sale_items
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY purchase_orders_org_isolation ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY purchase_items_org_isolation ON public.purchase_items
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY manufacturing_orders_org_isolation ON public.manufacturing_orders
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY stock_movements_org_isolation ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY financial_records_org_isolation ON public.financial_records
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- 5. ATUALIZAR TRIGGER set_default_organization_id PARA PRIORIZAR EMPRESA DO USUÁRIO
CREATE OR REPLACE FUNCTION public.set_default_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN
    -- Pega a organização onde o usuário logado é membro
    SELECT organization_id INTO v_user_org_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
    ORDER BY (role = 'owner') DESC, created_at DESC
    LIMIT 1;

    IF v_user_org_id IS NOT NULL THEN
      NEW.organization_id := v_user_org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
