-- Fix security warnings introduced by the last migration

-- 1) Lock down stock_movements access to authenticated users
-- Drop previous permissive policies (if they exist)
drop policy if exists stock_movements_select on public.stock_movements;
drop policy if exists stock_movements_insert on public.stock_movements;

create policy stock_movements_select
on public.stock_movements
for select
using (auth.uid() is not null);

create policy stock_movements_insert
on public.stock_movements
for insert
with check (auth.uid() is not null);

-- 2) Make function search_path immutable (linter 0011)
create or replace function public.apply_stock_adjustment(
  p_product_id uuid,
  p_delta numeric,
  p_reason text default 'Ajuste rápido',
  p_reference_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'Delta inválido';
  end if;

  update public.products
    set current_stock = current_stock + p_delta
  where id = p_product_id;

  if not found then
    raise exception 'Produto não encontrado';
  end if;

  insert into public.stock_movements (product_id, type, quantity, reason, reference_id)
  values (
    p_product_id,
    case when p_delta > 0 then 'Entrada' else 'Saída' end,
    abs(p_delta),
    p_reason,
    p_reference_id
  );
end;
$$;