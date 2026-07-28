---
description: Schema real do banco Supabase — carregado automaticamente em toda sessão
---

# Schema do banco — Supabase (oliveira-joias)

URL do projeto: `https://ifpcohlidgadciluzvhw.supabase.co`  
Credenciais: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env`

> Use o skill `/db` para consultar dados reais quando precisar verificar schema, debugar ou inspecionar conteúdo.

---

## Tabelas acessíveis (anon key)

### `produtos`
```
id, codigo, nome, descricao, categoria, material, peso_g,
fornecedor_id, custo, preco_venda, preco_minimo, imagem_url,
ativo, is_kit, observacoes, created_by, created_at, updated_at
```

### `produto_variacoes`
```
id, produto_id, nome, valor, estoque_atual, estoque_minimo,
custo_adicional, ativo, created_at, updated_at
```
> Estoque real fica aqui (`estoque_atual`). Movimentações em `estoque_movimentacoes`.

### `vendas`
```
id, numero, cliente_id, vendedor_id, status, forma_pagamento,
subtotal, desconto, total, valor_pago, troco, observacoes,
data_venda, created_at, updated_at,
tipo,              ← 'normal' | 'livre'
descricao_livre,   ← usado quando tipo='livre'
custo_livre,       ← custo interno para tipo='livre'
origem_id, origem_outro
```

### `venda_itens`
```
id, venda_id, produto_id, variacao_id, nome_produto, descricao,
quantidade, preco_unitario, custo_unitario, desconto, subtotal, created_at
```

### `crediario`
```
id, venda_id, cliente_id, total, entrada, saldo,
num_parcelas, valor_parcela, dia_vencimento,
status, observacoes, created_by, created_at, updated_at
```

### `crediario_parcelas`
```
id, crediario_id, cliente_id, numero, valor, valor_pago,
data_vencimento, data_pagamento, forma_pagamento,
status, observacoes, recebido_por, created_at, updated_at
```

### `clientes`
```
id, nome, cpf, rg, email, telefone, whatsapp, data_nascimento,
endereco, numero, complemento, bairro, cidade, estado, cep,
observacoes, ativo, created_by, created_at, updated_at,
-- CRM (funil de leads) --
status_funil,       ← 'novo_lead'|'primeiro_atendimento'|'orcamento'|'negociacao'|'follow_up'|
                       'pedido_confirmado'|'producao'|'pedido_entregue'|'pos_venda'|'lead_perdido'
lead_score,         ← 1-5, calculado por calcularLeadScore() em utils/index.ts a cada save
origem_id,          ← FK origens_cliente
origem_outro, instagram,
produto_interesse,  ← 'alianca_prata'|'alianca_ouro'|'alianca_moeda_antiga'|'alianca_aco'|'semijoias'|'outro'
valor_pretendido, data_casamento, data_noivado, quando_pretende_comprar,
modelo_desejado, numeracao,
vendedor_id,        ← FK profiles (role='vendedor')
perguntou_pagamento, solicitou_gravacao, demonstrou_intencao,  ← booleans, entram no lead_score
motivo_perda,       ← preenchido quando status_funil='lead_perdido'
ultimo_contato_em,  ← timestamptz, atualizado a cada nota/mudança de estágio/follow-up concluído
                       (base dos alertas de "sem resposta"/"esquecido" em services/follow-ups.ts)
status_qualificacao,← 'novo_lead'|'em_atendimento'|'fazendo_orcamento'|'interessado'|
                       'aguardando_resposta'|'follow_up_agendado'|'venda_concluida'|
                       'lead_perdido'|'nao_respondeu' — independente do status_funil (seção 3 do
                       doc de requisitos); editável na aba Timeline do modal de detalhe do cliente
parceiro_nome, parceiro_telefone  ← cadastro de casal (item 16 do doc), opcionais
```
> Leads e clientes convertidos coexistem na mesma tabela (decisão de projeto: sem tabela `leads`
> separada). Ver `.claude/migrations/crm_leads.sql`, `crm_leads_fix_timeline_fk.sql`,
> `crm_followups.sql`, `crm_status_qualificacao.sql` e `crm_extras.sql`.
>
> Vendedores (`profiles.role='vendedor'`) só enxergam os próprios leads no Kanban `/crm` (filtro por
> `vendedor_id` em `services/clientes.ts`); outros roles veem tudo. É uma restrição de UI/query, não
> RLS por role no banco.
>
> A agenda de follow-up (`/crm/follow-up` e `/crm/calendario`, `listarFollowUps()` em
> `services/follow-ups.ts`) é **compartilhada**: todos os vendedores veem todos os follow-ups
> pendentes, independente de quem cadastrou ou de qual vendedor está vinculado ao cliente. Antes
> havia o mesmo filtro por `vendedor_id`, o que fazia um vendedor não ver follow-ups agendados por
> outro — corrigido a pedido do usuário (a agenda de retornos precisa ser única para a equipe toda).
> Os cards de alerta (`listarAlertas`) continuam por vendedor quando chamados com `vendedorId`.
>
> `created_by` referencia `profiles(id)` (não `auth.users` como na maioria das outras tabelas) —
> importante ao escrever embeds do PostgREST: qualquer segunda FK para `profiles` (ex.: `vendedor_id`)
> exige o hint explícito `profiles!clientes_vendedor_id_fkey(...)`, senão dá erro `PGRST201`
> (relação ambígua).

### `cliente_timeline`
```
id, cliente_id, tipo ('nota'|'status'|'sistema'), descricao,
status_anterior, status_novo, created_by, created_at
```
> Log append-only da Timeline do cliente/lead — notas manuais e eventos automáticos de mudança de
> `status_funil`/follow-up (preenchidos por `services/clientes.ts` e `services/follow-ups.ts`). Sem
> `updated_at`, não é editável. `created_by` referencia `profiles(id)`.

### `cliente_followups`
```
id, cliente_id, data_agendada, horario, motivo,
status ('pendente'|'concluido'|'cancelado'), created_by, created_at, updated_at
```
> Agenda de retornos do CRM (`services/follow-ups.ts`). Agendar/reagendar/concluir/cancelar também
> gravam um evento em `cliente_timeline`; concluir atualiza `clientes.ultimo_contato_em`.

### `metas_mensais`
```
id, mes (date, sempre dia 1), vendedor_id (null = meta geral da loja),
valor_meta, created_by, created_at, updated_at
```
> `services/metas.ts`. Índices únicos parciais garantem no máximo 1 meta geral por mês
> (`vendedor_id is null`) e 1 meta por vendedor por mês. Editável direto no CRM Dashboard
> (ícone de lápis no card "Meta Mensal").

### `mensagens_modelo`
```
id, categoria, titulo, mensagem, ativo, created_by, created_at, updated_at
```
> Biblioteca de mensagens do CRM (`services/mensagens.ts`, CRUD em `/crm/mensagens`). Placeholders
> no texto: `{nome}`, `{produto}`, `{empresa}`, `{endereco}`, `{instagram}` — substituídos por
> `preencherMensagem()` antes de abrir o WhatsApp (`modal-whatsapp.tsx`). Seed inicial com ~11
> modelos cobrindo atendimento, pedido, pós-venda e promoção.

### `cliente_arquivos`
```
id, cliente_id, tipo ('foto'|'documento'), nome, url (= caminho no storage), created_by, created_at
```
> Fotos de modelos escolhidos e documentos/comprovantes do cliente (`services/arquivos.ts`, upload
> na aba Timeline do modal do cliente). `url` guarda o **path** dentro do bucket, não a URL pública
> — usar `getArquivoUrl(path)` pra montar a URL de exibição. Bucket: `crm-arquivos` (público, ver
> `crm_extras.sql`).

### `origens_cliente`
```
id, nome, ativo, created_at
```
> Catálogo de origens (Instagram, Google, Anúncio, Indicação, Outro, Vitrine, Facebook, WhatsApp).
> Referenciado por `origem_id` em `vendas`, `servicos` e `clientes`. Quando `nome='Outro'`, o texto
> livre vai no campo irmão `origem_outro` de cada tabela.

### `servicos`
```
id, numero, cliente_id, tipo, descricao, observacoes_internas,
valor, custo_estimado, status,
data_entrada, data_previsao, data_conclusao, data_entrega,
forma_pagamento, pago, responsavel_id,
created_by, created_at, updated_at, origem_id, origem_outro
```

### `fornecedores`
```
id, nome, razao_social, cnpj, cpf, email, telefone, contato_nome,
endereco, numero, complemento, bairro, cidade, estado, cep,
categoria, observacoes, ativo, created_by, created_at, updated_at
```

### `profiles`
```
id, nome, email, role, ativo, avatar_url, telefone, created_at, updated_at, cpf,
comissao_percentual  ← numeric(5,2), editável em /vendedores; usado no cálculo de
                        comissão do CRM (dashboard e relatórios)
```
> Vendedores = `profiles` com `role = 'vendedor'`. Não existe tabela `vendedores` separada.

### `estoque_movimentacoes` (write-only via anon — RLS bloqueia leitura direta)
Campos inferidos do service:
```
id, variacao_id, produto_id, tipo (entrada|saida|ajuste|devolucao),
quantidade, quantidade_antes, quantidade_depois, motivo, created_by, created_at
```

### `lancamentos`
```
id, tipo ('entrada'|'saida'), descricao, valor, data_lancamento,
categoria_id, categoria_nome, forma_pagamento, referencia_id, referencia_tipo,
observacoes, editado, created_by, updated_by, created_at, updated_at
```
> Alimenta a tela Caixa & Financeiro (`app/(app)/caixa/page.tsx`). `referencia_tipo` é texto livre
> (sem FK/enum no banco) usado para rastrear a origem do lançamento: `'venda'`, `'servico'`,
> `'crediario'`, `'crediario_parcela'`, `'venda_estorno'`, `'follow_up'` (valor registrado ao
> concluir um follow-up do CRM, ver `services/follow-ups.ts`). `referencia_id` aponta para o id da
> respectiva linha de origem. Lançamentos manuais (criados direto na tela Caixa) têm
> `referencia_id`/`referencia_tipo` nulos.
>
> Atenção: em `services/servicos.ts`, `updateServicoStatus()` (usado no select rápido de status da
> tela `/servicos`) só atualiza `servicos.status`/`pago` — **não** cria/edita lançamento em caixa.
> Só o modal completo de edição (`updateServico()`) recria os lançamentos. Isso é uma inconsistência
> pré-existente, fora do escopo do que foi corrigido na sessão que documentou este bloco.

### `categorias`
```
id, nome, tipo ('entrada'|'saida'), cor, ativo, created_at
```
> Categorias de lançamento usadas no filtro/formulário da tela Caixa.

### `orcamentos`
```
id, numero, cliente_nome, cliente_telefone, modelo_nome, material, largura,
itens_inclusos (text[]), valor_vista, percentual_acrescimo, num_parcelas,
valor_parcelado, valor_parcela, prazo_fabricacao, observacoes,
created_by, created_at, updated_at
```
> `percentual_acrescimo`/`num_parcelas`/`valor_parcelado`/`valor_parcela` são calculados a partir de `material` no momento do save (ouro: +20% em 12x; outros: +10% em 3x) — ver `calcularCondicaoOrcamento` em `utils/index.ts`.
>
> `numero` **não é** identity/sequence — é calculado pelo app (`services/orcamentos.ts`) como `max(numero)+1` a cada criação, e renumerado (todos os posteriores decrescem 1) via RPC `renumerar_orcamentos_apos_delete` a cada exclusão. Objetivo: refletir sempre a quantidade atual de orçamentos (1..N sem lacunas), a pedido do usuário — ver `.claude/migrations/orcamento_renumeracao.sql`. Risco aceito: corrida em criações simultâneas pode gerar `numero` duplicado (baixa probabilidade, uso interno de poucos usuários).

### `orcamento_modelos`
```
id, nome, ativo, created_by, created_at, updated_at
```
> Catálogo de sugestões para o campo "Modelo" do orçamento (texto livre, sem FK em `orcamentos`).

### `orcamento_materiais`
```
id, nome, ativo, created_by, created_at, updated_at
```
> Catálogo de sugestões para o campo "Material" do orçamento (texto livre, sem FK em `orcamentos`). Mesma estrutura de `orcamento_modelos`. Seed: Ouro 10k, Ouro 16k, Ouro 18k, Prata 950 (`.claude/migrations/orcamento_materiais.sql`).

### `orcamento_configuracoes`
```
id, nome_empresa, contato, endereco, whatsapp, instagram, texto_rodape, cor_principal, created_at, updated_at
```
> Tabela singleton — sempre uma única linha com `id = '00000000-0000-0000-0000-000000000001'` (constante `ORCAMENTO_CONFIG_ID` em `services/orcamentos.ts`). Dados de marca usados no documento impresso do orçamento.

---

## Relacionamentos principais

```
produtos ──< produto_variacoes (produto_id)
vendas ──< venda_itens (venda_id)
vendas ──── crediario (venda_id)
crediario ──< crediario_parcelas (crediario_id)
clientes ──< vendas, crediario, servicos (cliente_id)
fornecedores ──< produtos (fornecedor_id)
profiles ──< vendas (vendedor_id), servicos (responsavel_id)
produto_variacoes ──< estoque_movimentacoes (variacao_id)
```
