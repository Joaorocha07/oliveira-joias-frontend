---
name: db
description: Consulta direta ao banco Supabase. Use para verificar dados reais, inspecionar colunas, debugar queries ou checar registros antes de implementar uma feature. Lê credenciais do .env automaticamente.
disable-model-invocation: false
---

# Skill: /db — Consulta ao banco Supabase

Quando este skill for invocado, execute uma consulta no banco Supabase e retorne os resultados.

## Como executar queries

Use `mcp__plugin_context-mode_context-mode__ctx_execute` com JavaScript. Leia as credenciais do `.env` do projeto:

```javascript
import { readFileSync } from 'fs';

// Lê .env.local ou .env
let envContent = '';
try { envContent = readFileSync('.env.local', 'utf8'); } catch {
  try { envContent = readFileSync('.env', 'utf8'); } catch {}
}
const env = Object.fromEntries(
  envContent.trim().split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const headers = {
  'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
};

// Exemplo de query
const res = await fetch(`${BASE}/produtos?limit=5&select=id,nome,categoria`, { headers });
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
```

## Sintaxe PostgREST (Supabase REST API)

```
GET /rest/v1/{tabela}?select=col1,col2&filtro=eq.valor&limit=10
GET /rest/v1/{tabela}?select=*,relacao(col1,col2)    ← join
GET /rest/v1/{tabela}?col=eq.valor                   ← WHERE col = valor
GET /rest/v1/{tabela}?col=gte.100&order=col.desc     ← WHERE + ORDER BY
```

Filtros comuns: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `is`

Exemplo com join:
```javascript
const res = await fetch(
  `${BASE}/vendas?select=id,total,status,clientes(nome)&status=eq.pago&limit=10`,
  { headers }
);
```

## Tabelas disponíveis

Consulte `.claude/rules/schema.md` para o schema completo de cada tabela.

Tabelas acessíveis com a anon key:
`produtos`, `produto_variacoes`, `vendas`, `venda_itens`,
`crediario`, `crediario_parcelas`, `clientes`, `servicos`,
`fornecedores`, `profiles`

## Quando usar este skill

- Verificar quais colunas existem antes de escrever um service
- Checar dados de exemplo para entender formato real
- Debugar por que uma query retorna resultado inesperado
- Contar registros ou validar integridade antes de uma migration
- Testar filtros PostgREST antes de colocar no código

## Quando NÃO usar

- Para mutations (INSERT/UPDATE/DELETE) — a anon key respeita RLS; prefira testar via interface da aplicação
- Para schema introspection (a anon key não acessa `information_schema`) — use o `.claude/rules/schema.md`
