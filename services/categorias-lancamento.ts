import { supabase } from '@/lib/supabase'
import type { CategoriaLancamento } from '@/types'

const SEM_PERMISSAO = 'Sem permissão para alterar categorias.'

export async function criarCategoriaLancamento(
  nome: string,
): Promise<{ data: CategoriaLancamento | null; error: string | null }> {
  const { data, error } = await supabase
    .from('categorias')
    .insert({ nome: nome.trim() })
    .select('id, nome')
    .single()
  if (error) {
    return { data: null, error: error.code === '42501' ? SEM_PERMISSAO : 'Erro ao criar categoria.' }
  }
  return { data: data as CategoriaLancamento, error: null }
}

// `lancamentos.categoria_nome` é uma cópia do nome, e é por ela que o filtro do
// Caixa e os relatórios agrupam: renomear precisa atualizar os lançamentos também.
// Se a 2ª etapa falhar, salvar de novo refaz as duas.
export async function renomearCategoriaLancamento(
  id: string,
  nome: string,
): Promise<{ data: CategoriaLancamento | null; error: string | null }> {
  const nomeLimpo = nome.trim()
  const { data, error } = await supabase
    .from('categorias')
    .update({ nome: nomeLimpo })
    .eq('id', id)
    .select('id, nome')
    .maybeSingle()
  if (error) {
    return { data: null, error: error.code === '42501' ? SEM_PERMISSAO : 'Erro ao renomear categoria.' }
  }
  // A RLS não gera erro no update bloqueado: só não retorna nenhuma linha.
  if (!data) return { data: null, error: SEM_PERMISSAO }

  const { error: erroLancamentos } = await supabase
    .from('lancamentos')
    .update({ categoria_nome: nomeLimpo })
    .eq('categoria_id', id)
  if (erroLancamentos) {
    return {
      data: null,
      error: 'A categoria foi renomeada, mas os lançamentos antigos não foram atualizados. Salve de novo.',
    }
  }
  return { data: data as CategoriaLancamento, error: null }
}
