-- ==============================================================================
-- MIGRAÇÃO: HISTÓRICO DE PREÇOS E SAZONALIDADE DE MATÉRIAS-PRIMAS E INSUMOS
-- Tabela: product_price_history
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  unit_price numeric NOT NULL,
  package_price numeric,
  package_size numeric,
  package_name text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  notes text,
  source text NOT NULL DEFAULT 'cadastro', -- 'cadastro', 'manual', 'compra', 'planilha'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para buscas rápidas e relatórios cronológicos
CREATE INDEX IF NOT EXISTS idx_prod_price_hist_org ON public.product_price_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_price_hist_product ON public.product_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_price_hist_date ON public.product_price_history(purchase_date);
CREATE INDEX IF NOT EXISTS idx_prod_price_hist_prod_date ON public.product_price_history(product_id, purchase_date DESC);

-- Habilitação de RLS (Row Level Security)
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Política de isolamento multi-tenant
DROP POLICY IF EXISTS prod_price_hist_org_isolation ON public.product_price_history;
CREATE POLICY prod_price_hist_org_isolation ON public.product_price_history
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Trigger para definir automaticamente a organization_id se não fornecida
DROP TRIGGER IF EXISTS trg_set_org_prod_price_hist ON public.product_price_history;
CREATE TRIGGER trg_set_org_prod_price_hist
  BEFORE INSERT ON public.product_price_history
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();
