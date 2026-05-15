# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# oliveira-joias-frontend

Sistema de gestão para joalheria (ERP), desenvolvido com Next.js App Router. Gerencia vendas, crediário, estoque, clientes, caixa, serviços e relatórios.

---

## Comandos

```bash
npm run dev      # Servidor de desenvolvimento (Next.js)
npm run build    # Build de produção
npm run start    # Servidor de produção
npm run lint     # ESLint (flat config v9)
```

Sem configuração de testes — nenhum arquivo de teste existe no projeto.

## Variáveis de ambiente

Copiar `.env.example` para `.env.local` e preencher:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Stack real

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 16 + App Router |
| UI | React 19 + Tailwind CSS v4 |
| Backend/DB | Supabase (Auth + PostgreSQL direto) |
| Server state | TanStack React Query v5 |
| Forms | React Hook Form v7 + Zod v4 |
| Ícones | Lucide React |
| Charts | Recharts |
| Notificações | react-hot-toast |
| Datas | date-fns v4 |

**Não há camada de API própria.** O frontend faz chamadas diretamente ao Supabase via `@/lib/supabase`.

---

## Arquitetura e estrutura real

### Roteamento

```
/app
  (app)/              ← grupo protegido com layout compartilhado
    dashboard/
    vendas/
    crediario/
    clientes/
    estoque/
    fornecedores/
    caixa/
    servicos/
    relatorios/
    vendedores/
    configuracoes/
  login/              ← fora do grupo, sem auth
```

O `(app)/layout.tsx` é o AppShell protegido por `AuthContext`. A rota `/login` fica fora do grupo e não tem proteção.

### Fluxo de dados

```
Componente → Service (/services/*.ts) → Supabase Client (/lib/supabase.ts)
                                     ↓
                         React Query (cache + refetch)
```

Services retornam `{ data: T | null, error: string | null }`. Nunca retornam throw — erros são capturados e convertidos para string em português.

### Autenticação

`AuthContext` (`/context/AuthContext.tsx`) hidrata sessão Supabase + profile do usuário. O hook `useAuth()` expõe `user`, `profile`, `loading`, `signOut`. Roles: `admin`, `vendedor`, `caixa`, `visualizador`.

### Estado global

- **Auth**: Context API (`AuthContext`)
- **Server state**: React Query (queries por feature, ex: `useQuery(['vendas', filtros], ...)`)
- **Forms**: React Hook Form isolado por modal/página

---

## Padrões críticos

### Services

```ts
// /services/vendas.ts
export async function criarVenda(data: VendaInsert): Promise<{ data: Venda | null; error: string | null }> {
  const { data: result, error } = await supabase.from('vendas').insert(data).select().single()
  if (error) return { data: null, error: error.message }
  return { data: result, error: null }
}
```

### Zod v4 com React Hook Form v7

```ts
// Zod v4 usa z.string().optional() sem .nullable() encadeado diretamente
// Para campo opcional: z.string().optional()
// Para campo nulável: z.string().nullable()
// Para ambos: z.string().optional().nullable()  ← ordem importa no v4
import { zodResolver } from '@hookform/resolvers/zod'
const form = useForm({ resolver: zodResolver(schema) })
```

### Schemas

Schemas Zod ficam em `/schemas/`. Types de domínio ficam em `/types/index.ts`. Não duplicar — schemas derivam types quando possível com `z.infer<typeof schema>`.

### Import aliases

```ts
@/components  @/hooks  @/services  @/context
@/utils       @/types  @/lib       @/schemas
```

---

## Vocabulário de domínio

**Modelos de pagamento:** `dinheiro`, `pix`, `cartao_debito`, `cartao_credito`, `crediario`, `transferencia`, `cheque`, `misto`

**Status de venda:** `orcamento`, `pendente`, `pago`, `crediario`, `cancelado`

**Status de parcela (crediário):** `pendente`, `pago`, `vencido`, `cancelado`

**Categorias de produto:** `anel`, `colar`, `brinco`, `pulseira`, `alianca`, `pingente`, `relogio`, `kit`, `outro`

Sempre usar esses valores exatos ao criar queries, filtros e selects — correspondem aos `enum` do banco.

---

## Regras de desenvolvimento

**Componentização:** Criar componentes reutilizáveis desacoplados. Separar regra de negócio da UI. Evitar componentes gigantes.

**TypeScript:** Nunca usar `any`. Centralizar tipos compartilhados em `/types/index.ts`. Usar sufixos `Insert`, `Update`, `Status` para variações de domínio.

**Estados visuais:** Sempre tratar `loading`, `empty state`, `error state` e `success state` em toda feature.

**Services:** Toda integração com Supabase fica em `/services`. Nunca fazer queries Supabase dentro de componentes.

**Tailwind CSS v4:** Usar PostCSS v4. Fonte padrão: DM Sans (`--font-dm-sans`). Cores da marca: verde `#5B8C5B` (sucesso) e vermelho `#C75B5B` (erro).

**Antes de criar algo novo:** Verificar se já existe componente ou hook reutilizável em `/components/ui`, `/hooks` ou `/services`.
