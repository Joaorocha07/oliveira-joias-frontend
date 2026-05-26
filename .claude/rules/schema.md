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
