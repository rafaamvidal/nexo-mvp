-- ==============================================================================
-- MIGRAÇÃO MULTI-TENANT: AGILIX ERP (VERSÃO SIMPLIFICADA E RESILIENTE)
-- Isola completamente dados de clientes, produtos, vendas, financeiro e estoque
-- por Empresa (Organization). Permite que múltiplos clientes usem o mesmo banco.
-- ==============================================================================

-- 1. TABELA DE ORGANIZAÇÕES (EMPRESAS)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TABELA DE MEMBROS DA ORGANIZAÇÃO (VÍNCULO USUÁRIO <-> EMPRESA)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(organization_id);

-- 3. EMPRESA PADRÃO (PRESERVA SEUS DADOS EXISTENTES)
DO $$
DECLARE
  v_default_org_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations LIMIT 1) THEN
    INSERT INTO public.organizations (id, name, created_at)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Empresa Principal', now())
    RETURNING id INTO v_default_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT v_default_org_id, id, 'owner'
    FROM auth.users
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
END $$;

-- 4. ADICIONAR organization_id NAS TABELAS DE NEGÓCIO
DO $$
DECLARE
  v_default_org_id uuid;
BEGIN
  SELECT id INTO v_default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;

  -- 4.1 CLIENTS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'organization_id') THEN
    ALTER TABLE public.clients ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.clients SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);
  END IF;

  -- 4.2 PRODUCTS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'organization_id') THEN
    ALTER TABLE public.products ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.products SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
  END IF;

  -- 4.3 SUPPLIERS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'organization_id') THEN
    ALTER TABLE public.suppliers ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.suppliers SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON public.suppliers(organization_id);
  END IF;

  -- 4.4 SALES
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'organization_id') THEN
    ALTER TABLE public.sales ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.sales SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_sales_organization_id ON public.sales(organization_id);
  END IF;

  -- 4.5 SALE_ITEMS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'organization_id') THEN
    ALTER TABLE public.sale_items ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.sale_items si
      SET organization_id = COALESCE((SELECT s.organization_id FROM public.sales s WHERE s.id = si.sale_id), v_default_org_id)
      WHERE si.organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_sale_items_organization_id ON public.sale_items(organization_id);
  END IF;

  -- 4.6 PURCHASE_ORDERS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'organization_id') THEN
    ALTER TABLE public.purchase_orders ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.purchase_orders SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_organization_id ON public.purchase_orders(organization_id);
  END IF;

  -- 4.7 PURCHASE_ITEMS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'organization_id') THEN
    ALTER TABLE public.purchase_items ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.purchase_items pi
      SET organization_id = COALESCE((SELECT po.organization_id FROM public.purchase_orders po WHERE po.id = pi.purchase_order_id), v_default_org_id)
      WHERE pi.organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_purchase_items_organization_id ON public.purchase_items(organization_id);
  END IF;

  -- 4.8 MANUFACTURING_ORDERS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'manufacturing_orders' AND column_name = 'organization_id') THEN
    ALTER TABLE public.manufacturing_orders ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.manufacturing_orders SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_organization_id ON public.manufacturing_orders(organization_id);
  END IF;

  -- 4.9 STOCK_MOVEMENTS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'organization_id') THEN
    ALTER TABLE public.stock_movements ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.stock_movements sm
      SET organization_id = COALESCE((SELECT p.organization_id FROM public.products p WHERE p.id = sm.product_id), v_default_org_id)
      WHERE sm.organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_stock_movements_organization_id ON public.stock_movements(organization_id);
  END IF;

  -- 4.10 MOVEMENTS (legado)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'movements') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movements' AND column_name = 'organization_id') THEN
      ALTER TABLE public.movements ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
      IF v_default_org_id IS NOT NULL THEN
        UPDATE public.movements m
        SET organization_id = COALESCE((SELECT p.organization_id FROM public.products p WHERE p.id = m.product_id), v_default_org_id)
        WHERE m.organization_id IS NULL;
      END IF;
      CREATE INDEX IF NOT EXISTS idx_movements_organization_id ON public.movements(organization_id);
    END IF;
  END IF;

  -- 4.11 FINANCIAL_RECORDS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_records' AND column_name = 'organization_id') THEN
    ALTER TABLE public.financial_records ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    IF v_default_org_id IS NOT NULL THEN
      UPDATE public.financial_records SET organization_id = v_default_org_id WHERE organization_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_financial_records_organization_id ON public.financial_records(organization_id);
  END IF;

END $$;

-- 5. TRIGGER DE PREENCHIMENTO AUTOMÁTICO DE ORGANIZATION_ID
CREATE OR REPLACE FUNCTION public.set_default_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_org_clients ON public.clients;
CREATE TRIGGER trg_set_org_clients BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_products ON public.products;
CREATE TRIGGER trg_set_org_products BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_suppliers ON public.suppliers;
CREATE TRIGGER trg_set_org_suppliers BEFORE INSERT ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_sales ON public.sales;
CREATE TRIGGER trg_set_org_sales BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_sale_items ON public.sale_items;
CREATE TRIGGER trg_set_org_sale_items BEFORE INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_purchase_orders ON public.purchase_orders;
CREATE TRIGGER trg_set_org_purchase_orders BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_purchase_items ON public.purchase_items;
CREATE TRIGGER trg_set_org_purchase_items BEFORE INSERT ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_manufacturing_orders ON public.manufacturing_orders;
CREATE TRIGGER trg_set_org_manufacturing_orders BEFORE INSERT ON public.manufacturing_orders FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_set_org_stock_movements BEFORE INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_financial_records ON public.financial_records;
CREATE TRIGGER trg_set_org_financial_records BEFORE INSERT ON public.financial_records FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

-- 6. RPC PARA CRIAR EMPRESA NO ONBOARDING
CREATE OR REPLACE FUNCTION public.create_company_account(
  p_name text,
  p_document text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org public.organizations%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório';
  END IF;

  INSERT INTO public.organizations (name, document, phone)
  VALUES (trim(p_name), nullif(trim(p_document), ''), nullif(trim(p_phone), ''))
  RETURNING * INTO v_org;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, v_user_id, 'owner');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object(
    'id', v_org.id,
    'name', v_org.name,
    'document', v_org.document,
    'role', 'owner'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_account(text, text, text) TO authenticated;

-- 7. ATUALIZAÇÃO DA RPC APPLY_MOVEMENT
CREATE OR REPLACE FUNCTION public.apply_movement(
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_reason text DEFAULT NULL::text,
  p_reference_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current numeric;
  v_next numeric;
  v_org_id uuid;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  SELECT current_stock, organization_id INTO v_current, v_org_id
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF p_type = 'Entrada' THEN
    v_next := v_current + p_quantity;
  ELSIF p_type = 'Saída' THEN
    IF v_current < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente';
    END IF;
    v_next := v_current - p_quantity;
  ELSIF p_type = 'Ajuste' THEN
    v_next := p_quantity;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_type;
  END IF;

  UPDATE public.products
  SET current_stock = v_next
  WHERE id = p_product_id;

  INSERT INTO public.stock_movements (
    product_id,
    type,
    quantity,
    reason,
    reference_id,
    organization_id
  ) VALUES (
    p_product_id,
    p_type,
    p_quantity,
    p_reason,
    p_reference_id,
    v_org_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_movement(uuid, text, numeric, text, uuid) TO authenticated;

-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- Remove políticas antigas de single-tenant
DROP POLICY IF EXISTS products_admin_estoque_all ON public.products;
DROP POLICY IF EXISTS products_authenticated_only ON public.products;
DROP POLICY IF EXISTS sales_admin_vendas_all ON public.sales;
DROP POLICY IF EXISTS sales_authenticated_only ON public.sales;
DROP POLICY IF EXISTS sale_items_admin_vendas_all ON public.sale_items;
DROP POLICY IF EXISTS suppliers_admin_all ON public.suppliers;
DROP POLICY IF EXISTS clients_admin_vendas_all ON public.clients;
DROP POLICY IF EXISTS financial_records_admin_financeiro_all ON public.financial_records;
DROP POLICY IF EXISTS purchase_orders_admin_compras_all ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_items_admin_compras_all ON public.purchase_items;
DROP POLICY IF EXISTS manufacturing_orders_admin_estoque_all ON public.manufacturing_orders;
DROP POLICY IF EXISTS stock_movements_admin_estoque_select ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_admin_estoque_insert ON public.stock_movements;
DROP POLICY IF EXISTS movements_admin_estoque_all ON public.movements;

-- Habilita RLS em todas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

-- 8.1 POLÍTICAS ORGANIZATIONS
DROP POLICY IF EXISTS organizations_member_select ON public.organizations;
CREATE POLICY organizations_member_select ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS organizations_insert_authenticated ON public.organizations;
CREATE POLICY organizations_insert_authenticated ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS organizations_member_update ON public.organizations;
CREATE POLICY organizations_member_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));

-- 8.2 POLÍTICAS ORGANIZATION_MEMBERS
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS org_members_insert_authenticated ON public.organization_members;
CREATE POLICY org_members_insert_authenticated ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS org_members_admin_all ON public.organization_members;
CREATE POLICY org_members_admin_all ON public.organization_members
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));

-- 8.3 POLÍTICAS DE ISOLAMENTO POR EMPRESA NAS TABELAS DE NEGÓCIO
-- (Em políticas FOR ALL, o Postgres aplica o USING tanto na leitura quanto na escrita/insert/update automaticamente)
DROP POLICY IF EXISTS clients_org_isolation ON public.clients;
CREATE POLICY clients_org_isolation ON public.clients
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS products_org_isolation ON public.products;
CREATE POLICY products_org_isolation ON public.products
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS suppliers_org_isolation ON public.suppliers;
CREATE POLICY suppliers_org_isolation ON public.suppliers
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS sales_org_isolation ON public.sales;
CREATE POLICY sales_org_isolation ON public.sales
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS sale_items_org_isolation ON public.sale_items;
CREATE POLICY sale_items_org_isolation ON public.sale_items
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS purchase_orders_org_isolation ON public.purchase_orders;
CREATE POLICY purchase_orders_org_isolation ON public.purchase_orders
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS purchase_items_org_isolation ON public.purchase_items;
CREATE POLICY purchase_items_org_isolation ON public.purchase_items
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS manufacturing_orders_org_isolation ON public.manufacturing_orders;
CREATE POLICY manufacturing_orders_org_isolation ON public.manufacturing_orders
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS stock_movements_org_isolation ON public.stock_movements;
CREATE POLICY stock_movements_org_isolation ON public.stock_movements
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS financial_records_org_isolation ON public.financial_records;
CREATE POLICY financial_records_org_isolation ON public.financial_records
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'movements') THEN
    ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS movements_org_isolation ON public.movements;
    CREATE POLICY movements_org_isolation ON public.movements
      FOR ALL TO authenticated
      USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));
  END IF;
END $$;
