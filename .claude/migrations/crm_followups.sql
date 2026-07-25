-- ============================================================
-- MIGRATION: Sistema de Follow-up do CRM
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- Depende de crm_leads.sql e crm_leads_fix_timeline_fk.sql já executadas.
-- ============================================================

-- Marca a última interação registrada com o lead/cliente (nota, mudança de
-- estágio ou criação) — usado pelos alertas de "sem resposta" / "esquecido".
alter table public.clientes
  add column if not exists ultimo_contato_em timestamptz not null default now();

create index if not exists clientes_ultimo_contato_em_idx on public.clientes (ultimo_contato_em);

-- ── Agenda de follow-up ──────────────────────────────────────────────────
create table if not exists public.cliente_followups (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  data_agendada date not null,
  horario       time,
  motivo        text not null,
  status        text not null default 'pendente' check (status in ('pendente', 'concluido', 'cancelado')),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists cliente_followups_cliente_id_idx on public.cliente_followups (cliente_id);
create index if not exists cliente_followups_status_idx     on public.cliente_followups (status);
create index if not exists cliente_followups_data_idx       on public.cliente_followups (data_agendada);

-- ── RLS: cliente_followups ───────────────────────────────────────────────
alter table public.cliente_followups enable row level security;

create policy "cliente_followups_select"
  on public.cliente_followups for select
  to authenticated
  using (true);

create policy "cliente_followups_insert"
  on public.cliente_followups for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "cliente_followups_update"
  on public.cliente_followups for update
  to authenticated
  using (true);

create policy "cliente_followups_delete"
  on public.cliente_followups for delete
  to authenticated
  using (true);

-- ── GRANT: sem isso o RLS acima nunca é avaliado, o Postgres barra antes ────
grant select, insert, update, delete on public.cliente_followups to authenticated;
