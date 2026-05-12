import { supabase } from '@/lib/supabase'
import type { ServicoFormData } from '@/schemas/servico'

export async function createServico(
  data: ServicoFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('servicos').insert({
    cliente_id: data.cliente_id || null,
    tipo: data.tipo,
    descricao: data.descricao,
    observacoes_internas: data.observacoes_internas || null,
    valor: data.valor,
    custo_estimado: data.custo_estimado ?? null,
    status: data.status,
    data_entrada: data.data_entrada,
    data_previsao: data.data_previsao || null,
    forma_pagamento: data.pago ? (data.forma_pagamento ?? null) : null,
    pago: data.pago,
    responsavel_id: data.responsavel_id || null,
    created_by: userId,
  })
  return { error: error?.message ?? null }
}
