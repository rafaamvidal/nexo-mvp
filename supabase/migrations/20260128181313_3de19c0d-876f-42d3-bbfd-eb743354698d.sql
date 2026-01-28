-- Tighten overly-permissive RLS policies (USING/WITH CHECK true)

-- manufacturing_orders
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.manufacturing_orders;
DROP POLICY IF EXISTS "manufacturing_orders_authenticated_only" ON public.manufacturing_orders;
CREATE POLICY manufacturing_orders_authenticated_only
ON public.manufacturing_orders
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- purchase_orders
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_authenticated_only" ON public.purchase_orders;
CREATE POLICY purchase_orders_authenticated_only
ON public.purchase_orders
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- purchase_items
DROP POLICY IF EXISTS "Authenticated Users Only" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items_authenticated_only" ON public.purchase_items;
CREATE POLICY purchase_items_authenticated_only
ON public.purchase_items
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
