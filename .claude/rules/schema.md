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
observacoes, ativo, created_by, created_at, updated_at
```

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
id, nome, email, role, ativo, avatar_url, telefone, created_at, updated_at, cpf
```
> Vendedores = `profiles` com `role = 'vendedor'`. Não existe tabela `vendedores` separada.

### `estoque_movimentacoes` (write-only via anon — RLS bloqueia leitura direta)
Campos inferidos do service:
```
id, variacao_id, produto_id, tipo (entrada|saida|ajuste|devolucao),
quantidade, quantidade_antes, quantidade_depois, motivo, created_by, created_at
```

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
