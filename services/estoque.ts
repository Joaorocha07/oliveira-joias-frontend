import { supabase } from '@/lib/supabase'
import type { EstoqueFormData } from '@/schemas/estoque'

export async function createMovimentacao(
  data: EstoqueFormData,
  userId: string,
): Promise<{ error: string | null }> {
  // Fetch current stock
  const { data: variacao, error: fetchError } = await supabase
    .from('produto_variacoes')
    .select('estoque_atual')
    .eq('id', data.variacao_id)
    .single()

  if (fetchError) return { error: fetchError.message }

  const estoqueAntes = variacao.estoque_atual ?? 0

  if (data.tipo === 'saida' && estoqueAntes < data.quantidade) {
    return { error: `Estoque insuficiente. Disponível: ${estoqueAntes} un.` }
  }

  let estoqueDepois: number
  if (data.tipo === 'entrada' || data.tipo === 'devolucao') {
    estoqueDepois = estoqueAntes + data.quantidade
  } else if (data.tipo === 'saida') {
    estoqueDepois = estoqueAntes - data.quantidade
  } else {
    // ajuste — quantidade vira o novo estoque
    estoqueDepois = data.quantidade
  }

  const { error: movError } = await supabase.from('estoque_movimentacoes').insert({
    variacao_id: data.variacao_id,
    produto_id: data.produto_id,
    tipo: data.tipo,
    quantidade: data.quantidade,
    quantidade_antes: estoqueAntes,
    quantidade_depois: estoqueDepois,
    motivo: data.motivo,
    created_by: userId,
  })
  if (movError) return { error: movError.message }

  const { error: updateError } = await supabase
    .from('produto_variacoes')
    .update({ estoque_atual: estoqueDepois })
    .eq('id', data.variacao_id)

  return { error: updateError?.message ?? null }
}
