-- ============================================================
-- MIGRATION: Renumeração sequencial de orçamentos após exclusão
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Remove o "identity" da coluna numero: a partir de agora o app calcula
-- explicitamente o próximo número (quantidade atual + 1) a cada criação,
-- para que ele reflita sempre a quantidade de orçamentos existentes,
-- em vez de um histórico que nunca decresce.
alter table public.orcamentos alter column numero drop identity if exists;

-- Fecha o "buraco" deixado por uma exclusão: todo orçamento com numero
-- maior que o excluído desce uma posição, mantendo a sequência 1..N
-- sem lacunas.
create or replace function public.renumerar_orcamentos_apos_delete(numero_excluido integer)
returns void
language sql
as $$
  update public.orcamentos
  set numero = numero - 1
  where numero > numero_excluido;
$$;

grant execute on function public.renumerar_orcamentos_apos_delete(integer) to authenticated;
