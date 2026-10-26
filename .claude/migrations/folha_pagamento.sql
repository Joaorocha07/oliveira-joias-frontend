-- ============================================================
-- MIGRATION: Folha de pagamento (controle interno, sem encargos CLT)
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Salário é dado sensível: fica em tabelas próprias (não em `profiles`,
-- que qualquer usuário autenticado lê) e todas as policies abaixo liberam
-- acesso SOMENTE para profiles.role = 'admin'.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and ativo)
$$;

-- ── Dados de folha de cada funcionário (1:1 com profiles) ───────────────────
create table if not exists public.folha_funcionarios (
  profile_id     uuid primary key references public.profiles(id) on delete cascade,
  cargo          text,
  salario_base   numeric(12,2) not null default 0 check (salario_base >= 0),
  chave_pix      text,
  ativo          boolean not null default true,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Folha mensal (1 por funcionário por mês) ────────────────────────────────
-- Valores são snapshot do momento do cálculo; enquanto status='aberta' a tela
-- recalcula (comissão das vendas do mês, vales, itens manuais).
create table if not exists public.folha_pagamentos (
  id                   uuid primary key default gen_random_uuid(),
  mes                  date not null check (extract(day from mes) = 1),
  funcionario_id       uuid not null references public.profiles(id) on delete cascade,
  funcionario_nome     text not null,
  cargo                text,
  salario_base         numeric(12,2) not null default 0,
  comissao_percentual  numeric(5,2) not null default 0,
  base_comissao        numeric(12,2) not null default 0,
  valor_comissao       numeric(12,2) not null default 0,
  total_proventos      numeric(12,2) not null default 0,
  total_descontos      numeric(12,2) not null default 0,
  valor_liquido        numeric(12,2) not null default 0,
  status               text not null default 'aberta' check (status in ('aberta', 'paga')),
  data_pagamento       date,
  forma_pagamento      text,
  lancamento_id        uuid references public.lancamentos(id) on delete set null,
  observacoes          text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (mes, funcionario_id)
);

create index if not exists folha_pagamentos_mes_idx on public.folha_pagamentos (mes);
create index if not exists folha_pagamentos_funcionario_idx on public.folha_pagamentos (funcionario_id);

-- ── Itens manuais da folha (bônus, horas extras, faltas, descontos...) ───────
create table if not exists public.folha_itens (
  id          uuid primary key default gen_random_uuid(),
  folha_id    uuid not null references public.folha_pagamentos(id) on delete cascade,
  tipo        text not null check (tipo in ('provento', 'desconto')),
  descricao   text not null,
  valor       numeric(12,2) not null check (valor > 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists folha_itens_folha_idx on public.folha_itens (folha_id);

-- ── Vales / adiantamentos ───────────────────────────────────────────────────
-- Saem do caixa no dia do vale (lancamento_id) e são descontados na folha do
-- mês: folha_id fica preenchido quando o vale entra numa folha.
create table if not exists public.folha_vales (
  id               uuid primary key default gen_random_uuid(),
  funcionario_id   uuid not null references public.profiles(id) on delete cascade,
  data_vale        date not null,
  valor            numeric(12,2) not null check (valor > 0),
  descricao        text,
  forma_pagamento  text,
  lancamento_id    uuid references public.lancamentos(id) on delete set null,
  folha_id         uuid references public.folha_pagamentos(id) on delete set null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists folha_vales_funcionario_idx on public.folha_vales (funcionario_id);
create index if not exists folha_vales_folha_idx on public.folha_vales (folha_id);

-- ── RLS: só admin ───────────────────────────────────────────────────────────
alter table public.folha_funcionarios enable row level security;
alter table public.folha_pagamentos  enable row level security;
alter table public.folha_itens       enable row level security;
alter table public.folha_vales       enable row level security;

create policy "folha_funcionarios_admin" on public.folha_funcionarios
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "folha_pagamentos_admin" on public.folha_pagamentos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "folha_itens_admin" on public.folha_itens
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "folha_vales_admin" on public.folha_vales
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Este projeto não concede privilégios automaticamente em tabelas novas.
grant select, insert, update, delete on
  public.folha_funcionarios, public.folha_pagamentos, public.folha_itens, public.folha_vales
  to authenticated, service_role;
grant execute on function public.is_admin() to authenticated;
