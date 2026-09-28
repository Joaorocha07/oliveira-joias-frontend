import { supabase } from '@/lib/supabase'
import { aplicarBuscaSupabase, ordenarPorRelevancia } from '@/utils/search'

// Buscas usadas pelos campos de autocomplete (SearchableSelect) dos modais/formulários.
// Todas aceitam nome sem acento, palavras fora de ordem e telefone/CPF sem formatação.

// Busca mais linhas que o limite e ordena por relevância no cliente
function limiteBusca(limit: number): number {
  return Math.max(limit * 3, 50)
}

export interface ClienteBusca {
  id: string
  nome: string
  telefone: string | null
  whatsapp: string | null
  cpf: string | null
  email: string | null
}

export async function buscarClientes(
  termo: string,
  { limit = 20, somenteComTelefone = false }: { limit?: number; somenteComTelefone?: boolean } = {},
): Promise<{ data: ClienteBusca[]; error: string | null }> {
  let query = supabase
    .from('clientes')
    .select('id, nome, telefone, whatsapp, cpf, email')
    .eq('ativo', true)
  if (somenteComTelefone) query = query.not('telefone', 'is', null)
  query = aplicarBuscaSupabase(query, termo, ['nome', 'email'], ['telefone', 'whatsapp', 'cpf'])

  const { data, error } = await query.order('nome').limit(limiteBusca(limit))
  if (error) return { data: [], error: 'Erro ao buscar clientes.' }
  const rows = (data ?? []) as ClienteBusca[]
  return {
    data: ordenarPorRelevancia(rows, termo, (c) => [c.nome, c.telefone, c.whatsapp, c.cpf, c.email]).slice(0, limit),
    error: null,
  }
}

export interface ProdutoBusca {
  id: string
  nome: string
  codigo: string
  preco_venda: number
  material: string | null
  variacoes?: { ativo: boolean; estoque_atual: number }[]
}

export async function buscarProdutos(
  termo: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<{ data: ProdutoBusca[]; error: string | null }> {
  const query = aplicarBuscaSupabase(
    supabase
      .from('produtos')
      .select('id, nome, codigo, preco_venda, material, variacoes:produto_variacoes(ativo, estoque_atual)')
      .eq('ativo', true),
    termo,
    ['nome', 'codigo', 'material'],
  )

  const { data, error } = await query.order('nome').limit(limiteBusca(limit))
  if (error) return { data: [], error: 'Erro ao buscar produtos.' }
  const rows = (data ?? []) as ProdutoBusca[]
  return {
    data: ordenarPorRelevancia(rows, termo, (p) => [p.nome, p.codigo, p.material]).slice(0, limit),
    error: null,
  }
}

export interface ProfileBusca {
  id: string
  nome: string
  role: string
}

export async function buscarProfiles(
  termo: string,
  { limit = 20, roles }: { limit?: number; roles?: string[] } = {},
): Promise<{ data: ProfileBusca[]; error: string | null }> {
  let query = supabase.from('profiles').select('id, nome, role, email, telefone').eq('ativo', true)
  if (roles) query = query.in('role', roles)
  query = aplicarBuscaSupabase(query, termo, ['nome', 'email'], ['telefone'])

  const { data, error } = await query.order('nome').limit(limiteBusca(limit))
  if (error) return { data: [], error: 'Erro ao buscar colaboradores.' }
  const rows = (data ?? []) as (ProfileBusca & { email: string | null; telefone: string | null })[]
  return {
    data: ordenarPorRelevancia(rows, termo, (p) => [p.nome, p.email, p.telefone]).slice(0, limit),
    error: null,
  }
}

export interface FornecedorBusca {
  id: string
  nome: string
}

export async function buscarFornecedores(
  termo: string,
  { limit = 15 }: { limit?: number } = {},
): Promise<{ data: FornecedorBusca[]; error: string | null }> {
  const query = aplicarBuscaSupabase(
    supabase.from('fornecedores').select('id, nome, razao_social, categoria, cnpj, cpf, telefone').eq('ativo', true),
    termo,
    ['nome', 'razao_social', 'categoria'],
    ['cnpj', 'cpf', 'telefone'],
  )

  const { data, error } = await query.order('nome').limit(limiteBusca(limit))
  if (error) return { data: [], error: 'Erro ao buscar fornecedores.' }
  const rows = (data ?? []) as (FornecedorBusca & { razao_social: string | null; categoria: string | null; cnpj: string | null; cpf: string | null; telefone: string | null })[]
  return {
    data: ordenarPorRelevancia(rows, termo, (f) => [f.nome, f.razao_social, f.categoria, f.cnpj, f.cpf, f.telefone]).slice(0, limit),
    error: null,
  }
}
