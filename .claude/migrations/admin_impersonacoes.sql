-- ============================================================
-- MIGRATION: Log de auditoria de personificação (admin "logar como" vendedor)
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

create table if not exists public.admin_impersonacoes (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references public.profiles(id) on delete cascade,
  admin_nome    text not null,
  vendedor_id   uuid not null references public.profiles(id) on delete cascade,
  vendedor_nome text not null,
  created_at    timestamptz not null default now()
);

create index if not exists admin_impersonacoes_admin_idx on public.admin_impersonacoes (admin_id);
create index if not exists admin_impersonacoes_vendedor_idx on public.admin_impersonacoes (vendedor_id);

-- ── RLS: admin_impersonacoes ─────────────────────────────────────────────────
-- Sem policies para anon/authenticated de propósito: esta tabela só é
-- escrita/lida pela rota server-side (app/api/admin/personificar) usando a
-- service_role key, que ignora RLS. Ninguém consegue ler ou forjar entradas
-- direto pelo cliente Supabase (anon key).
alter table public.admin_impersonacoes enable row level security;
