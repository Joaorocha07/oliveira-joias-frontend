-- ============================================================
-- MIGRATION: Módulo Certificados de Garantia
-- Tabelas: certificado_modelos, certificado_materiais,
--          certificado_configuracoes (singleton), certificados
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Catálogo: modelos sugeridos (select + cadastro rápido) ──────────────────
create table if not exists public.certificado_modelos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  ativo       boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Catálogo: materiais sugeridos (select + cadastro rápido) ────────────────
create table if not exists public.certificado_materiais (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  ativo       boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Configuração (linha única) ─────────────────────────────────────────────
create table if not exists public.certificado_configuracoes (
  id                  uuid primary key default gen_random_uuid(),
  nome_empresa        text not null default 'Oliveira Joias',
  subtitulo           text not null default 'Especializada em Alianças e Joias',
  endereco            text,
  whatsapp            text,
  telefone_secundario text,
  instagram           text,
  cor_principal       text not null default '#C9A227',
  texto_introducao    text,
  termos_garantia     text[] not null default '{}',
  beneficios          text[] not null default '{}',
  nao_cobre           text[] not null default '{}',
  recomendacoes       text[] not null default '{}',
  texto_declaracao    text,
  texto_agradecimento text,
  texto_validade      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Certificados emitidos (histórico) ──────────────────────────────────────
create table if not exists public.certificados (
  id                uuid primary key default gen_random_uuid(),
  numero            text not null unique,
  venda_id          uuid references public.vendas(id) on delete set null,
  cliente_id        uuid references public.clientes(id) on delete set null,
  cliente_nome      text,
  cliente_cpf       text,
  cliente_telefone  text,
  data_compra       date,
  modelo            text,
  material          text,
  largura           text,
  gramas            text,
  numeracao         text,
  pedido_os         text,
  valor             numeric(12,2),
  vendedor_id       uuid references public.profiles(id) on delete set null,
  vendedor_nome     text,
  observacoes       text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists certificados_created_at_idx     on public.certificados (created_at);
create index if not exists certificados_numero_idx         on public.certificados (numero);
create index if not exists certificados_cliente_id_idx     on public.certificados (cliente_id);
create index if not exists certificados_venda_id_idx       on public.certificados (venda_id);
create index if not exists certificado_modelos_ativo_idx   on public.certificado_modelos (ativo);
create index if not exists certificado_materiais_ativo_idx on public.certificado_materiais (ativo);

-- ── Seeds ─────────────────────────────────────────────────────────────────
insert into public.certificado_materiais (nome) values
  ('Ouro 18K'), ('Prata 950'), ('Moeda Antiga')
on conflict do nothing;

insert into public.certificado_modelos (nome) values
  ('Abaulada'), ('Tradicional'), ('Reta'), ('Diamantada')
on conflict do nothing;

insert into public.certificado_configuracoes (
  id, nome_empresa, subtitulo, endereco, whatsapp, telefone_secundario, instagram, cor_principal,
  texto_introducao, termos_garantia, beneficios, nao_cobre, recomendacoes,
  texto_declaracao, texto_agradecimento, texto_validade
) values (
  '00000000-0000-0000-0000-000000000001',
  'Oliveira Joias',
  'Especializada em Alianças e Joias',
  'Avenida Seme Simão, 1281',
  '5534998717389',
  '(34) 99771-7779',
  '@oliveirajoias',
  '#C9A227',
  'A {empresa} certifica que a joia descrita neste documento foi produzida com matéria-prima de alta qualidade, seguindo rigorosos padrões de fabricação, acabamento e controle de qualidade, garantindo ao cliente a autenticidade do material e cobertura contra defeitos de fabricação.',
  array[
    'Autenticidade do material utilizado na fabricação da joia.',
    'Defeitos de fabricação decorrentes do processo produtivo, com reparo ou substituição sem custo ao cliente.'
  ],
  array[
    'Até 3 (três) polimentos profissionais gratuitos para restauração do brilho e acabamento.',
    'Durante 1 (um) ano a partir da compra: ajustes de tamanho, modificações e reparos com mão de obra gratuita. Material adicional é cobrado apenas mediante aprovação prévia.'
  ],
  array[
    'Danos causados por mau uso, quedas, impactos ou amassados.',
    'Arranhões decorrentes do uso diário e desgaste natural.',
    'Quebras provocadas por esforço excessivo.',
    'Perda, roubo ou furto da joia.',
    'Danos causados por produtos químicos ou agentes corrosivos.',
    'Alterações realizadas por terceiros não autorizados pela {empresa}.'
  ],
  array[
    'Evitar contato com cloro, água sanitária, solventes e produtos de limpeza.',
    'Retirar as alianças durante atividades de impacto ou esforço físico intenso.',
    'Guardar a joia em local seco e protegido quando não estiver em uso.'
  ],
  'Declaro que recebi a joia descrita neste certificado em perfeitas condições de fabricação e acabamento, que recebi todas as informações referentes à utilização, conservação e garantia do produto, e que concordo integralmente com os termos aqui estabelecidos.',
  '{empresa} agradece pela confiança e tem a satisfação de fazer parte de um momento tão especial da sua história.',
  'Válido somente acompanhado da nota fiscal ou comprovante de compra.'
) on conflict (id) do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.certificado_modelos       enable row level security;
alter table public.certificado_materiais     enable row level security;
alter table public.certificado_configuracoes enable row level security;
alter table public.certificados              enable row level security;

create policy "certificado_modelos_select" on public.certificado_modelos for select to authenticated using (true);
create policy "certificado_modelos_insert" on public.certificado_modelos for insert to authenticated with check (auth.uid() = created_by);
create policy "certificado_modelos_update" on public.certificado_modelos for update to authenticated using (true);
create policy "certificado_modelos_delete" on public.certificado_modelos for delete to authenticated using (true);

create policy "certificado_materiais_select" on public.certificado_materiais for select to authenticated using (true);
create policy "certificado_materiais_insert" on public.certificado_materiais for insert to authenticated with check (auth.uid() = created_by);
create policy "certificado_materiais_update" on public.certificado_materiais for update to authenticated using (true);
create policy "certificado_materiais_delete" on public.certificado_materiais for delete to authenticated using (true);

create policy "certificado_configuracoes_select" on public.certificado_configuracoes for select to authenticated using (true);
create policy "certificado_configuracoes_insert" on public.certificado_configuracoes for insert to authenticated with check (true);
create policy "certificado_configuracoes_update" on public.certificado_configuracoes for update to authenticated using (true);

create policy "certificados_select" on public.certificados for select to authenticated using (true);
create policy "certificados_insert" on public.certificados for insert to authenticated with check (auth.uid() = created_by);
create policy "certificados_update" on public.certificados for update to authenticated using (true);
create policy "certificados_delete" on public.certificados for delete to authenticated using (true);

-- ── GRANTs (sem isso o RLS nem é avaliado — Postgres barra antes, erro 42501) ──
grant select, insert, update, delete on public.certificado_modelos       to authenticated;
grant select, insert, update, delete on public.certificado_materiais     to authenticated;
grant select, insert, update, delete on public.certificado_configuracoes to authenticated;
grant select, insert, update, delete on public.certificados              to authenticated;
