import { supabase } from '@/lib/supabase'
import { gerarDatasParcelas } from '@/utils'
import type { PagarParcelaFormData, EditarCrediarioFormData } from '@/schemas/crediario'

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

  // Recompute saldo from source of truth — parcela already updated above
  const { data: crediario, error: fetchError } = await supabase
    .from('crediario')
    .select('total, entrada, status')
    .eq('id', crediarioId)
    .single()

  if (fetchError) return { error: fetchError.message }

  const { data: parcelasPagas, error: parcelasError } = await supabase
    .from('crediario_parcelas')
    .select('valor_pago')
    .eq('crediario_id', crediarioId)
    .eq('status', 'pago')

  if (parcelasError) return { error: parcelasError.message }

  const totalPago = (parcelasPagas ?? []).reduce((sum, p) => sum + (p.valor_pago ?? 0), 0)
  const novoSaldo = Math.max(0, crediario.total - crediario.entrada - totalPago)
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

export async function updateCrediario(
  crediarioId: string,
  data: EditarCrediarioFormData,
): Promise<{ error: string | null }> {
  const { data: parcelasPagas, error: checkError } = await supabase
    .from('crediario_parcelas')
    .select('id')
    .eq('crediario_id', crediarioId)
    .eq('status', 'pago')

  if (checkError) return { error: checkError.message }
  if (parcelasPagas && parcelasPagas.length > 0) {
    return { error: `${parcelasPagas.length} parcela(s) já pagas. Não é possível editar as condições.` }
  }

  const { data: crediario, error: fetchError } = await supabase
    .from('crediario')
    .select('total, cliente_id, created_at, venda:vendas(data_venda)')
    .eq('id', crediarioId)
    .single()

  if (fetchError) return { error: fetchError.message }

  const saldo = Math.max(0, crediario.total - data.entrada)
  const valorParcela = Math.round((saldo / data.num_parcelas) * 100) / 100

  const { error: deleteError } = await supabase
    .from('crediario_parcelas')
    .delete()
    .eq('crediario_id', crediarioId)

  if (deleteError) return { error: deleteError.message }

  const crediarioTyped = crediario as unknown as {
    total: number; cliente_id: string; created_at: string
    venda: { data_venda: string } | { data_venda: string }[] | null
  }
  const vendaRaw = crediarioTyped.venda
  const dataVenda = (Array.isArray(vendaRaw) ? vendaRaw[0]?.data_venda : vendaRaw?.data_venda) ?? null
  const dataReferencia = dataVenda ? new Date(dataVenda) : new Date(crediario.created_at)
  const datas = gerarDatasParcelas(data.num_parcelas, data.dia_vencimento, dataReferencia)
  const { error: insertError } = await supabase
    .from('crediario_parcelas')
    .insert(
      datas.map((dataVenc, i) => ({
        crediario_id: crediarioId,
        cliente_id: crediario.cliente_id,
        numero: i + 1,
        valor: valorParcela,
        valor_pago: 0,
        data_vencimento: dataVenc,
        data_pagamento: null,
        forma_pagamento: null,
        status: 'pendente',
      })),
    )

  if (insertError) return { error: insertError.message }

  const { error: updateError } = await supabase
    .from('crediario')
    .update({
      entrada: data.entrada,
      saldo,
      num_parcelas: data.num_parcelas,
      valor_parcela: valorParcela,
      dia_vencimento: data.dia_vencimento,
    })
    .eq('id', crediarioId)

  return { error: updateError?.message ?? null }
}
