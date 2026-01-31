-- Tighten RLS for sensitive tables (clients, financial_records) using role-based access

BEGIN;

-- CLIENTS: only admin or vendas
DROP POLICY IF EXISTS clients_authenticated_only ON public.clients;

CREATE POLICY clients_admin_vendas_all
ON public.clients
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vendas'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'vendas'::public.app_role)
);

-- FINANCIAL_RECORDS: only admin or financeiro
DROP POLICY IF EXISTS financial_records_authenticated_only ON public.financial_records;

CREATE POLICY financial_records_admin_financeiro_all
ON public.financial_records
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
);

-- Add server-side input validation limits to RPCs

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