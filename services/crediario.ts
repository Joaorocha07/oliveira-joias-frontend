import { supabase } from '@/lib/supabase'
import type { PagarParcelaFormData } from '@/schemas/crediario'

export async function pagarParcela(
  parcelaId: string,
  crediarioId: string,
  data: PagarParcelaFormData,
  userId: string,
): Promise<{ error: string | null }> {
  // Update parcela
  const { error: parcelaError } = await supabase
    .from('crediario_parcelas')
    .update({
      status: 'pago',
      valor_pago: data.valor_pago,
      data_pagamento: data.data_pagamento,
      forma_pagamento: data.forma_pagamento,
      observacoes: data.observacoes || null,
      recebido_por: userId,
    })
    .eq('id', parcelaId)

  if (parcelaError) return { error: parcelaError.message }

  // Update crediário saldo
  const { data: crediario, error: fetchError } = await supabase
    .from('crediario')
    .select('saldo, status')
    .eq('id', crediarioId)
    .single()

  if (fetchError) return { error: fetchError.message }

  const novoSaldo = Math.max(0, crediario.saldo - data.valor_pago)
  const novoStatus = novoSaldo <= 0 ? 'quitado' : crediario.status

  const { error: updateError } = await supabase
    .from('crediario')
    .update({ saldo: novoSaldo, status: novoStatus })
    .eq('id', crediarioId)

  if (updateError) return { error: updateError.message }

  // Lançamento
  await supabase.from('lancamentos').insert({
    tipo: 'entrada',
    descricao: 'Pagamento parcela crediário',
    valor: data.valor_pago,
    data_lancamento: data.data_pagamento,
    forma_pagamento: data.forma_pagamento,
    referencia_id: parcelaId,
    referencia_tipo: 'crediario_parcela',
    created_by: userId,
  })

  return { error: null }
}
