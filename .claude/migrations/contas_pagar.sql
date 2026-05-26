-- ============================================================
-- MIGRATION: Tabela contas_pagar
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

create table if not exists public.contas_pagar (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  descricao        text,
  valor            numeric(12,2) not null check (valor > 0),
  fixa             boolean not null default false,
  data_vencimento  date not null,
  status           text not null default 'pendente'
                     check (status in ('pendente', 'pago', 'vencido', 'cancelado')),
  data_pagamento   date,
  forma_pagamento  text,
  lancamento_id    uuid references public.lancamentos(id) on delete set null,
  observacoes      text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Índices para as queries mais comuns
create index if not exists contas_pagar_status_idx         on public.contas_pagar (status);
create index if not exists contas_pagar_data_vencimento_idx on public.contas_pagar (data_vencimento);
create index if not exists contas_pagar_fixa_idx           on public.contas_pagar (fixa);
create index if not exists contas_pagar_created_by_idx     on public.contas_pagar (created_by);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.contas_pagar enable row level security;

-- Usuários autenticados podem ler todas as contas
create policy "contas_pagar_select"
  on public.contas_pagar for select
  to authenticated
  using (true);

-- Usuários autenticados podem criar contas
create policy "contas_pagar_insert"
  on public.contas_pagar for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Usuários autenticados podem editar contas
create policy "contas_pagar_update"
  on public.contas_pagar for update
  to authenticated
  using (true);

-- Usuários autenticados podem excluir contas
create policy "contas_pagar_delete"
  on public.contas_pagar for delete
  to authenticated
  using (true);
