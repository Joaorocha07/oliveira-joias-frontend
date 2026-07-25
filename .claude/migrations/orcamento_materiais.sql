-- ============================================================
-- MIGRATION: Catálogo de Materiais do Orçamento (orcamento_materiais)
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

create table if not exists public.orcamento_materiais (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  ativo       boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists orcamento_materiais_ativo_idx on public.orcamento_materiais (ativo);

-- Materiais de exemplo já cadastrados (conforme informado pelo usuário)
insert into public.orcamento_materiais (nome) values
  ('Ouro 10k'),
  ('Ouro 16k'),
  ('Ouro 18k'),
  ('Prata 950');

-- ── RLS: orcamento_materiais ────────────────────────────────────────────────
alter table public.orcamento_materiais enable row level security;

create policy "orcamento_materiais_select"
  on public.orcamento_materiais for select
  to authenticated
  using (true);

create policy "orcamento_materiais_insert"
  on public.orcamento_materiais for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "orcamento_materiais_update"
  on public.orcamento_materiais for update
  to authenticated
  using (true);

create policy "orcamento_materiais_delete"
  on public.orcamento_materiais for delete
  to authenticated
  using (true);

-- ── GRANT: sem isso o RLS acima nunca é avaliado, o Postgres barra antes ────
-- (retorna 42501 "permission denied for table X" mesmo com policy "using (true)")
grant select, insert, update, delete on public.orcamento_materiais to authenticated;
