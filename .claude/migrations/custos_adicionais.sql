-- ============================================================
-- MIGRATION: Custos adicionais de venda/serviço (análise de lucro)
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
--
-- custo_tipos   → catálogo de tipos de custo (Mão de obra, Gravação, Frete...)
-- venda_custos  → custos adicionais lançados manualmente, vinculados a uma venda
--                 e/ou a uma ordem de serviço. Cada custo gera um lançamento de
--                 saída em `lancamentos` com referencia_id = venda_custos.id e
--                 referencia_tipo = 'venda_custo' (tem venda) ou 'servico_custo'
--                 (só OS) — feito pelo app, services/custos.ts.

create table if not exists public.custo_tipos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  ativo       boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists custo_tipos_ativo_idx on public.custo_tipos (ativo);

insert into public.custo_tipos (nome) values
  ('Mão de obra'),
  ('Gravação'),
  ('Banho / Acabamento'),
  ('Solda / Conserto'),
  ('Frete'),
  ('Embalagem'),
  ('Outro');

create table if not exists public.venda_custos (
  id          uuid primary key default gen_random_uuid(),
  venda_id    uuid references public.vendas(id) on delete cascade,
  servico_id  uuid references public.servicos(id) on delete set null,
  tipo_id     uuid references public.custo_tipos(id) on delete set null,
  tipo_nome   text,                       -- snapshot do nome do tipo
  descricao   text,
  valor       numeric(12,2) not null check (valor > 0),
  data_custo  date not null default current_date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists venda_custos_venda_idx   on public.venda_custos (venda_id);
create index if not exists venda_custos_servico_idx on public.venda_custos (servico_id);
create index if not exists venda_custos_data_idx    on public.venda_custos (data_custo);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.custo_tipos  enable row level security;
alter table public.venda_custos enable row level security;

create policy "custo_tipos_select" on public.custo_tipos for select to authenticated using (true);
create policy "custo_tipos_insert" on public.custo_tipos for insert to authenticated with check (auth.uid() = created_by);
create policy "custo_tipos_update" on public.custo_tipos for update to authenticated using (true);
create policy "custo_tipos_delete" on public.custo_tipos for delete to authenticated using (true);

create policy "venda_custos_select" on public.venda_custos for select to authenticated using (true);
create policy "venda_custos_insert" on public.venda_custos for insert to authenticated with check (auth.uid() = created_by);
create policy "venda_custos_update" on public.venda_custos for update to authenticated using (true);
create policy "venda_custos_delete" on public.venda_custos for delete to authenticated using (true);

-- ── GRANT: sem isso o RLS acima nunca é avaliado (erro 42501) ───────────────
grant select, insert, update, delete on public.custo_tipos  to authenticated;
grant select, insert, update, delete on public.venda_custos to authenticated;

-- Recarrega o schema cache do PostgREST para os embeds (vendas → venda_custos) funcionarem
notify pgrst, 'reload schema';
