-- ============================================================
-- MIGRATION: Fix cliente_timeline.created_by → profiles (não auth.users)
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- Depende de crm_leads.sql já ter sido executada.
-- ============================================================

-- O padrão real deste banco (visto em clientes.created_by) é referenciar
-- public.profiles, não auth.users — necessário para o PostgREST conseguir
-- embutir "autor:profiles(nome)" na consulta da Timeline.
alter table public.cliente_timeline
  drop constraint if exists cliente_timeline_created_by_fkey;

alter table public.cliente_timeline
  add constraint cliente_timeline_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;
