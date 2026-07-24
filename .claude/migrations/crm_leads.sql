-- ============================================================
-- MIGRATION: CRM de Leads — Funil de Vendas (MVP)
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Novas colunas de CRM em clientes ─────────────────────────────────────────
alter table public.clientes
  add column if not exists status_funil text not null default 'novo_lead'
    check (status_funil in (
      'novo_lead', 'primeiro_atendimento', 'orcamento', 'negociacao', 'follow_up',
      'pedido_confirmado', 'producao', 'pedido_entregue', 'pos_venda', 'lead_perdido'
    )),
  add column if not exists lead_score integer not null default 0,
  add column if not exists origem_id uuid references public.origens_cliente(id),
  add column if not exists origem_outro text,
  add column if not exists produto_interesse text
    check (produto_interesse in (
      'alianca_prata', 'alianca_ouro', 'alianca_moeda_antiga', 'alianca_aco', 'semijoias', 'outro'
    )),
  add column if not exists valor_pretendido numeric(12,2),
  add column if not exists data_casamento date,
  add column if not exists data_noivado date,
  add column if not exists quando_pretende_comprar text,
  add column if not exists modelo_desejado text,
  add column if not exists numeracao text,
  add column if not exists vendedor_id uuid references public.profiles(id),
  add column if not exists instagram text,
  add column if not exists perguntou_pagamento boolean not null default false,
  add column if not exists solicitou_gravacao boolean not null default false,
  add column if not exists demonstrou_intencao boolean not null default false,
  add column if not exists motivo_perda text;

create index if not exists clientes_status_funil_idx on public.clientes (status_funil);
create index if not exists clientes_vendedor_id_idx  on public.clientes (vendedor_id);
create index if not exists clientes_origem_id_idx    on public.clientes (origem_id);

-- Backfill: clientes que já compraram não devem nascer como "novo lead" no board
update public.clientes c set status_funil = 'pos_venda'
where status_funil = 'novo_lead'
  and exists (select 1 from public.vendas v where v.cliente_id = c.id);

-- Origem "WhatsApp" citada no requisito, ainda não cadastrada em origens_cliente
insert into public.origens_cliente (nome)
select 'WhatsApp'
where not exists (select 1 from public.origens_cliente where nome = 'WhatsApp');

-- ── Timeline do cliente (notas manuais + eventos automáticos) ───────────────
create table if not exists public.cliente_timeline (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  tipo            text not null default 'nota' check (tipo in ('nota', 'status', 'sistema')),
  descricao       text not null,
  status_anterior text,
  status_novo     text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists cliente_timeline_cliente_id_idx on public.cliente_timeline (cliente_id);

-- ── RLS: cliente_timeline ─────────────────────────────────────────────────
alter table public.cliente_timeline enable row level security;

create policy "cliente_timeline_select"
  on public.cliente_timeline for select
  to authenticated
  using (true);

create policy "cliente_timeline_insert"
  on public.cliente_timeline for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "cliente_timeline_update"
  on public.cliente_timeline for update
  to authenticated
  using (true);

create policy "cliente_timeline_delete"
  on public.cliente_timeline for delete
  to authenticated
  using (true);

-- ── GRANT: sem isso o RLS acima nunca é avaliado, o Postgres barra antes ────
-- (retorna 42501 "permission denied for table X" mesmo com policy "using (true)")
grant select, insert, update, delete on public.cliente_timeline to authenticated;
