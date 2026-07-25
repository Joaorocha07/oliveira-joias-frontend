-- ============================================================
-- MIGRATION: Status de Qualificação do Lead (separado do funil)
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Campo independente do status_funil (Kanban) — representa a "temperatura"/
-- resposta do lead no atendimento, conforme seção 3 do documento de requisitos.
alter table public.clientes
  add column if not exists status_qualificacao text not null default 'novo_lead'
    check (status_qualificacao in (
      'novo_lead', 'em_atendimento', 'fazendo_orcamento', 'interessado',
      'aguardando_resposta', 'follow_up_agendado', 'venda_concluida',
      'lead_perdido', 'nao_respondeu'
    ));

create index if not exists clientes_status_qualificacao_idx on public.clientes (status_qualificacao);
