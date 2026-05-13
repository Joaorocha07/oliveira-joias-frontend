import { supabase } from '@/lib/supabase'
import type { ProdutoCategoria } from '@/types'
import type { ProdutoFormData, VariacaoFormData } from '@/schemas/produto'

const CATEGORIA_PREFIX: Record<ProdutoCategoria, string> = {
  anel: 'AN',
  colar: 'CO',
  brinco: 'BR',
  pulseira: 'PU',
  alianca: 'AL',
  pingente: 'PI',
  relogio: 'RE',
  kit: 'KI',
  outro: 'OU',
}

export async function generateCodigo(categoria: ProdutoCategoria): Promise<string> {
  const prefix = CATEGORIA_PREFIX[categoria]
  // Fetch ALL products with this prefix (including inactive/soft-deleted)
  // so we never attempt to INSERT a code that still exists in the table.
  const { data } = await supabase
    .from('produtos')
    .select('codigo')
    .ilike('codigo', `${prefix}%`)

  const usados = new Set(
    (data ?? [])
      .map((p) => {
        const n = parseInt(p.codigo.slice(prefix.length), 10)
        return isNaN(n) ? 0 : n
      })
      .filter((n) => n > 0),
  )

  // Find the first gap — fills holes left by hard-deleted products.
  // Codes from soft-deleted products are kept reserved (they still live in the DB).
  let n = 1
  while (usados.has(n)) n++
  return `${prefix}${String(n).padStart(4, '0')}`
}

export async function checkDependencias(produtoId: string): Promise<{
  vendas: number
  movimentacoes: number
}> {
  const [vendas, movimentacoes] = await Promise.all([
    supabase.from('venda_itens').select('id', { count: 'exact', head: true }).eq('produto_id', produtoId),
    supabase.from('estoque_movimentacoes').select('id', { count: 'exact', head: true }).eq('produto_id', produtoId),
  ])
  return {
    vendas: vendas.count ?? 0,
    movimentacoes: movimentacoes.count ?? 0,
  }
}

export async function createProduto(
  data: ProdutoFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const { variacoes, ...produtoData } = data

  const { data: produto, error: produtoError } = await supabase
    .from('produtos')
    .insert({
      ...produtoData,
      descricao: produtoData.descricao || null,
      material: produtoData.material || null,
      observacoes: produtoData.observacoes || null,
      fornecedor_id: produtoData.fornecedor_id || null,
      peso_g: produtoData.peso_g ?? null,
      preco_minimo: produtoData.preco_minimo ?? null,
      imagem_url: null,
      created_by: userId,
    })
    .select('id')
    .single()

  if (produtoError) return { error: produtoError.message }

  const variacoesPayload = variacoes.map((v: VariacaoFormData) => ({
    produto_id: produto.id,
    nome: v.nome,
    valor: v.valor,
    estoque_atual: v.estoque_atual,
    estoque_minimo: v.estoque_minimo,
    custo_adicional: v.custo_adicional,
    ativo: v.ativo,
  }))

  const { error: varError } = await supabase.from('produto_variacoes').insert(variacoesPayload)
  return { error: varError?.message ?? null }
}

export async function updateProduto(
  id: string,
  data: ProdutoFormData,
): Promise<{ error: string | null }> {
  const { variacoes, ...produtoData } = data

  const { error: produtoError } = await supabase
    .from('produtos')
    .update({
      ...produtoData,
      descricao: produtoData.descricao || null,
      material: produtoData.material || null,
      observacoes: produtoData.observacoes || null,
      fornecedor_id: produtoData.fornecedor_id || null,
      peso_g: produtoData.peso_g ?? null,
      preco_minimo: produtoData.preco_minimo ?? null,
    })
    .eq('id', id)

  if (produtoError) return { error: produtoError.message }

  const existing = variacoes.filter((v: VariacaoFormData) => v.id)
  const novas = variacoes.filter((v: VariacaoFormData) => !v.id)

  for (const v of existing) {
    const { error } = await supabase
      .from('produto_variacoes')
      .update({
        nome: v.nome,
        valor: v.valor,
        estoque_atual: v.estoque_atual,
        estoque_minimo: v.estoque_minimo,
        custo_adicional: v.custo_adicional,
        ativo: v.ativo,
      })
      .eq('id', v.id!)
    if (error) return { error: error.message }
  }

  if (novas.length > 0) {
    const { error } = await supabase.from('produto_variacoes').insert(
      novas.map((v: VariacaoFormData) => ({
        produto_id: id,
        nome: v.nome,
        valor: v.valor,
        estoque_atual: v.estoque_atual,
        estoque_minimo: v.estoque_minimo,
        custo_adicional: v.custo_adicional,
        ativo: v.ativo,
      })),
    )
    if (error) return { error: error.message }
  }

  return { error: null }
}

export async function desativarProduto(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteProduto(id: string): Promise<{ error: string | null }> {
  const deps = await checkDependencias(id)
  const temDeps = deps.vendas > 0 || deps.movimentacoes > 0

  if (temDeps) {
    return { error: 'HAS_DEPENDENCIES' }
  }

  await supabase.from('produto_variacoes').delete().eq('produto_id', id)
  const { error } = await supabase.from('produtos').delete().eq('id', id)
  return { error: error?.message ?? null }
}
