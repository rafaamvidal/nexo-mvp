-- Add strong references from financial_records to operational documents (idempotent sync)

ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS sale_id uuid NULL,
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid NULL;

-- Foreign keys: keep financial record even if the sale/purchase is deleted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_records_sale_id_fkey'
  ) THEN
    ALTER TABLE public.financial_records
      ADD CONSTRAINT financial_records_sale_id_fkey
      FOREIGN KEY (sale_id)
      REFERENCES public.sales(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_records_purchase_order_id_fkey'
  ) THEN
    ALTER TABLE public.financial_records
      ADD CONSTRAINT financial_records_purchase_order_id_fkey
      FOREIGN KEY (purchase_order_id)
      REFERENCES public.purchase_orders(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_records_sale_id
  ON public.financial_records (sale_id);

CREATE INDEX IF NOT EXISTS idx_financial_records_purchase_order_id
  ON public.financial_records (purchase_order_id);

-- Prevent duplicates: one Receber per sale, one Pagar per purchase order
CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_records_receber_per_sale
  ON public.financial_records (sale_id)
  WHERE sale_id IS NOT NULL AND type = 'Receber';

CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_records_pagar_per_purchase
  ON public.financial_records (purchase_order_id)
  WHERE purchase_order_id IS NOT NULL AND type = 'Pagar';
