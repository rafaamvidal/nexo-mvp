-- Explicitly deny UPDATE/DELETE on stock_movements (audit log)

-- UPDATE should never be allowed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stock_movements'
      AND policyname = 'stock_movements_update'
  ) THEN
    CREATE POLICY stock_movements_update
    ON public.stock_movements
    FOR UPDATE
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stock_movements'
      AND policyname = 'stock_movements_delete'
  ) THEN
    CREATE POLICY stock_movements_delete
    ON public.stock_movements
    FOR DELETE
    USING (false);
  END IF;
END $$;
