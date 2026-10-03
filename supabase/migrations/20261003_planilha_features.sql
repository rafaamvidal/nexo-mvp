-- ==============================================================================
-- MIGRAÇÃO: NOVAS FUNCIONALIDADES PLANILHA INDUSTRIAL
-- 1. Fornecedores: campo vendedor / contato
-- 2. Financeiro: parcelamento e repetição
-- 3. Ficha Técnica (BOM / Receitas de Produção)
-- ==============================================================================

BEGIN;

-- 1. FORNECEDORES: Contato do Vendedor / Representante Comercial
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE public.suppliers ADD COLUMN contact_name text;
  END IF;
END $$;

-- 2. FINANCEIRO: Parcelamento e Identificação de Parcelas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'financial_records' AND column_name = 'installment_number'
  ) THEN
    ALTER TABLE public.financial_records ADD COLUMN installment_number integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'financial_records' AND column_name = 'total_installments'
  ) THEN
    ALTER TABLE public.financial_records ADD COLUMN total_installments integer DEFAULT 1;
  END IF;
END $$;

-- 3. FICHA TÉCNICA (RECEITAS DE PRODUÇÃO / BOM)
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_per_unit numeric NOT NULL DEFAULT 1,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, raw_material_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_org ON public.product_recipes(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_prod ON public.product_recipes(product_id);

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_recipes_org_isolation ON public.product_recipes;
CREATE POLICY product_recipes_org_isolation ON public.product_recipes
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP TRIGGER IF EXISTS trg_set_org_product_recipes ON public.product_recipes;
CREATE TRIGGER trg_set_org_product_recipes
  BEFORE INSERT ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

COMMIT;
