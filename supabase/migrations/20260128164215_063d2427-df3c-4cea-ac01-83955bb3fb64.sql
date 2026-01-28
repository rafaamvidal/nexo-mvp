-- Fix: previous migration attempt failed because public.user_roles does not exist.
-- This migration only addresses function search_path mutability for functions we can safely update.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Provide a safe 3-arg overload for apply_movement with fixed search_path (some clients may still call this signature)
CREATE OR REPLACE FUNCTION public.apply_movement(
  p_product_id uuid,
  p_type text,
  p_quantity numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.apply_movement(
    p_product_id := p_product_id,
    p_type := p_type,
    p_quantity := p_quantity,
    p_reason := NULL,
    p_reference_id := NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_movement(uuid, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_movement(uuid, text, numeric) TO authenticated;
