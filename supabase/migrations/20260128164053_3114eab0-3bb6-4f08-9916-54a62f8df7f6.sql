-- Tighten RLS policies to require authentication for sensitive business tables

-- PRODUCTS
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_all" ON public.products;
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.products;

CREATE POLICY "products_authenticated_only"
ON public.products
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- MOVEMENTS
DROP POLICY IF EXISTS "movements_select" ON public.movements;
DROP POLICY IF EXISTS "movements_insert" ON public.movements;
DROP POLICY IF EXISTS "movements_all" ON public.movements;
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.movements;

CREATE POLICY "movements_authenticated_only"
ON public.movements
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- CLIENTS
DROP POLICY IF EXISTS "clients_all" ON public.clients;
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.clients;

CREATE POLICY "clients_authenticated_only"
ON public.clients
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- SUPPLIERS
DROP POLICY IF EXISTS "suppliers_all" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.suppliers;

CREATE POLICY "suppliers_authenticated_only"
ON public.suppliers
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- SALES
DROP POLICY IF EXISTS "sales_all" ON public.sales;
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.sales;

CREATE POLICY "sales_authenticated_only"
ON public.sales
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- SALE ITEMS
DROP POLICY IF EXISTS "sale_items_all" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.sale_items;

CREATE POLICY "sale_items_authenticated_only"
ON public.sale_items
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- FINANCIAL RECORDS
DROP POLICY IF EXISTS "financial_records_all" ON public.financial_records;
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.financial_records;

CREATE POLICY "financial_records_authenticated_only"
ON public.financial_records
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);


-- Lock down SECURITY DEFINER inventory RPCs

-- apply_stock_adjustment: require authenticated caller + prevent negative stock
CREATE OR REPLACE FUNCTION public.apply_stock_adjustment(
  p_product_id uuid,
  p_delta numeric,
  p_reason text DEFAULT 'Ajuste rápido'::text,
  p_reference_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Delta inválido';
  END IF;

  UPDATE public.products
    SET current_stock = current_stock + p_delta
  WHERE id = p_product_id
  RETURNING current_stock INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  INSERT INTO public.stock_movements (product_id, type, quantity, reason, reference_id)
  VALUES (
    p_product_id,
    CASE WHEN p_delta > 0 THEN 'Entrada' ELSE 'Saída' END,
    abs(p_delta),
    p_reason,
    p_reference_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_stock_adjustment(uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_stock_adjustment(uuid, numeric, text, uuid) TO authenticated;


-- apply_movement: create/replace to match frontend expectation + require auth
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
SET search_path TO 'public'
AS $$
DECLARE
  v_delta numeric;
  v_new_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF p_type NOT IN ('Entrada', 'Saída') THEN
    RAISE EXCEPTION 'Tipo de movimento inválido. Use Entrada ou Saída.';
  END IF;

  v_delta := CASE WHEN p_type = 'Entrada' THEN p_quantity ELSE -p_quantity END;

  UPDATE public.products
    SET current_stock = current_stock + v_delta
  WHERE id = p_product_id
  RETURNING current_stock INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  INSERT INTO public.stock_movements (product_id, type, quantity, reason, reference_id)
  VALUES (
    p_product_id,
    p_type,
    p_quantity,
    COALESCE(p_reason, 'Manual ' || p_type),
    p_reference_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_movement(uuid, text, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_movement(uuid, text, numeric, text, uuid) TO authenticated;
