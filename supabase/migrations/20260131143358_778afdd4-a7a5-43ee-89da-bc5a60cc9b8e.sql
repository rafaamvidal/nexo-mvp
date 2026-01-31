-- Tighten RLS policies by department roles and add server-side role checks to SECURITY DEFINER RPCs.

BEGIN;

-- PRODUCTS: admin + estoque
DROP POLICY IF EXISTS products_authenticated_only ON public.products;
CREATE POLICY products_admin_estoque_all
ON public.products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role));

-- STOCK_MOVEMENTS: read-only audit, admin + estoque
DROP POLICY IF EXISTS stock_movements_select ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_insert ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_update ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_delete ON public.stock_movements;

CREATE POLICY stock_movements_admin_estoque_select
ON public.stock_movements
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role));

-- Allow inserts only from permitted roles (RPCs also enforce this)
CREATE POLICY stock_movements_admin_estoque_insert
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role));

-- Explicitly deny updates/deletes
CREATE POLICY stock_movements_no_update
ON public.stock_movements
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY stock_movements_no_delete
ON public.stock_movements
FOR DELETE
TO authenticated
USING (false);

-- MOVEMENTS (legacy table): admin + estoque
DROP POLICY IF EXISTS movements_authenticated_only ON public.movements;
CREATE POLICY movements_admin_estoque_all
ON public.movements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role));

-- SALES + SALE_ITEMS: admin + vendas
DROP POLICY IF EXISTS sales_authenticated_only ON public.sales;
CREATE POLICY sales_admin_vendas_all
ON public.sales
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'vendas'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'vendas'::public.app_role));

DROP POLICY IF EXISTS sale_items_authenticated_only ON public.sale_items;
CREATE POLICY sale_items_admin_vendas_all
ON public.sale_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'vendas'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'vendas'::public.app_role));

-- SUPPLIERS + PURCHASE_ORDERS + PURCHASE_ITEMS: admin + estoque
DROP POLICY IF EXISTS suppliers_authenticated_only ON public.suppliers;
CREATE POLICY suppliers_admin_estoque_all
ON public.suppliers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role));

DROP POLICY IF EXISTS purchase_orders_authenticated_only ON public.purchase_orders;
CREATE POLICY purchase_orders_admin_estoque_all
ON public.purchase_orders
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role));

DROP POLICY IF EXISTS purchase_items_authenticated_only ON public.purchase_items;
CREATE POLICY purchase_items_admin_estoque_all
ON public.purchase_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role));

-- MANUFACTURING_ORDERS: admin only
DROP POLICY IF EXISTS manufacturing_orders_authenticated_only ON public.manufacturing_orders;
CREATE POLICY manufacturing_orders_admin_all
ON public.manufacturing_orders
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Harden SECURITY DEFINER RPCs with role checks (defender-in-depth)

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
AS $function$
DECLARE
  v_new_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Delta inválido';
  END IF;

  IF p_reason IS NOT NULL AND length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Motivo muito longo (máximo 500 caracteres)';
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
$function$;

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
AS $function$
DECLARE
  v_delta numeric;
  v_new_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'estoque'::public.app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF p_type NOT IN ('Entrada', 'Saída') THEN
    RAISE EXCEPTION 'Tipo de movimento inválido. Use Entrada ou Saída.';
  END IF;

  IF p_reason IS NOT NULL AND length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Motivo muito longo (máximo 500 caracteres)';
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
$function$;

COMMIT;