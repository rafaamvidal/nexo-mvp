-- 1) Tabela de histórico de ajustes/movimentações (conforme solicitado)
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  type text not null, -- 'Entrada' | 'Saída'
  quantity numeric not null,
  reason text null,
  reference_id uuid null,
  created_at timestamptz not null default now()
);

-- 2) Segurança
alter table public.stock_movements enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stock_movements' and policyname='stock_movements_select'
  ) then
    create policy stock_movements_select
    on public.stock_movements
    for select
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stock_movements' and policyname='stock_movements_insert'
  ) then
    create policy stock_movements_insert
    on public.stock_movements
    for insert
    with check (true);
  end if;
end $$;

-- 3) Função para ajuste rápido (+/-) em transação
create or replace function public.apply_stock_adjustment(
  p_product_id uuid,
  p_delta numeric,
  p_reason text default 'Ajuste rápido',
  p_reference_id uuid default null
)
returns void
language plpgsql
as $$
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'Delta inválido';
  end if;

  -- Atualiza estoque
  update public.products
    set current_stock = current_stock + p_delta
  where id = p_product_id;

  if not found then
    raise exception 'Produto não encontrado';
  end if;

  -- Registra histórico
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