-- ============================================================
-- MIGRATION: CRM — casal, comissão, metas, mensagens, arquivos
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- Depende das migrations crm_leads.sql, crm_leads_fix_timeline_fk.sql,
-- crm_followups.sql e crm_status_qualificacao.sql já executadas.
-- ============================================================

-- ── Cadastro de casal (cliente principal + parceiro) ─────────────────────────
alter table public.clientes
  add column if not exists parceiro_nome text,
  add column if not exists parceiro_telefone text;

-- ── Comissão por vendedor (usada em relatórios e no financeiro do CRM) ──────
alter table public.profiles
  add column if not exists comissao_percentual numeric(5,2) not null default 0;

-- ── Metas de vendas (geral da loja quando vendedor_id é nulo) ────────────────
create table if not exists public.metas_mensais (
  id              uuid primary key default gen_random_uuid(),
  mes             date not null,
  vendedor_id     uuid references public.profiles(id) on delete cascade,
  valor_meta      numeric(12,2) not null check (valor_meta >= 0),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists metas_mensais_geral_uq
  on public.metas_mensais (mes) where vendedor_id is null;
create unique index if not exists metas_mensais_vendedor_uq
  on public.metas_mensais (mes, vendedor_id) where vendedor_id is not null;

alter table public.metas_mensais enable row level security;

create policy "metas_mensais_select" on public.metas_mensais for select to authenticated using (true);
create policy "metas_mensais_insert" on public.metas_mensais for insert to authenticated with check (auth.uid() = created_by);
create policy "metas_mensais_update" on public.metas_mensais for update to authenticated using (true);
create policy "metas_mensais_delete" on public.metas_mensais for delete to authenticated using (true);
grant select, insert, update, delete on public.metas_mensais to authenticated;

-- ── Biblioteca de mensagens (item 12 do documento) ───────────────────────────
create table if not exists public.mensagens_modelo (
  id          uuid primary key default gen_random_uuid(),
  categoria   text not null,
  titulo      text not null,
  mensagem    text not null,
  ativo       boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists mensagens_modelo_categoria_idx on public.mensagens_modelo (categoria);

alter table public.mensagens_modelo enable row level security;

create policy "mensagens_modelo_select" on public.mensagens_modelo for select to authenticated using (true);
create policy "mensagens_modelo_insert" on public.mensagens_modelo for insert to authenticated with check (auth.uid() = created_by);
create policy "mensagens_modelo_update" on public.mensagens_modelo for update to authenticated using (true);
create policy "mensagens_modelo_delete" on public.mensagens_modelo for delete to authenticated using (true);
grant select, insert, update, delete on public.mensagens_modelo to authenticated;

-- Placeholders aceitos no texto: {nome}, {produto}, {empresa}, {endereco}, {instagram}
insert into public.mensagens_modelo (categoria, titulo, mensagem)
select * from (values
  ('atendimento', 'Primeiro atendimento', 'Olá, {nome}! Aqui é da {empresa}. Vi seu interesse em {produto} e vou te ajudar a encontrar a peça ideal. Pode me contar um pouco mais do que você procura?'),
  ('atendimento', 'Follow-up 24 horas', 'Oi, {nome}! Passando aqui pra saber se ficou alguma dúvida sobre {produto}. Estou à disposição para te ajudar. 😊'),
  ('atendimento', 'Follow-up 3 dias', 'Oi, {nome}! Tudo bem? Ainda estou por aqui caso queira retomar sobre {produto} — é só me chamar quando quiser.'),
  ('atendimento', 'Cliente sem resposta', 'Olá, {nome}! Não tive retorno sobre {produto}, mas continuo à disposição se ainda tiver interesse. Qualquer coisa, me chama por aqui!'),
  ('pedido', 'Confirmação do pedido', 'Oba, {nome}! Seu pedido na {empresa} foi confirmado. Assim que estiver pronto, te aviso por aqui. Obrigado pela confiança!'),
  ('pedido', 'Pedido pronto', 'Boa notícia, {nome}! Seu pedido já está pronto para retirada na {empresa}. Podemos combinar o melhor horário pra você buscar?'),
  ('geral', 'Enviar localização', 'Oi, {nome}! Nosso endereço é: {endereco}. Te esperamos por aqui!'),
  ('geral', 'Enviar catálogo', 'Oi, {nome}! Nosso catálogo completo está no Instagram {instagram}. Dá uma olhada e me diz quais peças mais chamaram sua atenção!'),
  ('pos_venda', 'Pós-venda', 'Oi, {nome}! Já faz um tempinho da sua compra na {empresa} — ficou tudo certinho? Qualquer necessidade de ajuste ou manutenção, é só chamar.'),
  ('promocao', 'Promoção', 'Oi, {nome}! Temos uma condição especial em {produto} essa semana na {empresa}. Quer que eu te conte os detalhes?'),
  ('promocao', 'Data comemorativa', 'Parabéns, {nome}! 🎉 A equipe da {empresa} deseja tudo de bom nesta data especial. Aproveite para conferir nossas peças em homenagem à ocasião!')
) as t(categoria, titulo, mensagem)
where not exists (select 1 from public.mensagens_modelo);

-- ── Anexos do cliente (fotos de modelos escolhidos e documentos/comprovantes) ─
create table if not exists public.cliente_arquivos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null check (tipo in ('foto', 'documento')),
  nome        text not null,
  url         text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists cliente_arquivos_cliente_id_idx on public.cliente_arquivos (cliente_id);

alter table public.cliente_arquivos enable row level security;

create policy "cliente_arquivos_select" on public.cliente_arquivos for select to authenticated using (true);
create policy "cliente_arquivos_insert" on public.cliente_arquivos for insert to authenticated with check (auth.uid() = created_by);
create policy "cliente_arquivos_update" on public.cliente_arquivos for update to authenticated using (true);
create policy "cliente_arquivos_delete" on public.cliente_arquivos for delete to authenticated using (true);
grant select, insert, update, delete on public.cliente_arquivos to authenticated;

-- Bucket de storage para os arquivos acima (fotos e documentos do CRM)
insert into storage.buckets (id, name, public)
select 'crm-arquivos', 'crm-arquivos', true
where not exists (select 1 from storage.buckets where id = 'crm-arquivos');

create policy "crm_arquivos_storage_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'crm-arquivos');

create policy "crm_arquivos_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'crm-arquivos');

create policy "crm_arquivos_storage_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'crm-arquivos');
