import { supabase } from '@/lib/supabase'
import { gerarDatasParcelas } from '@/utils'
import type { PagarParcelaFormData, EditarCrediarioFormData } from '@/schemas/crediario'

async function recalcularSaldoCrediario(crediarioId: string): Promise<{ error: string | null }> {
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
  const novoStatus = crediario.status === 'cancelado'
    ? 'cancelado'
    : novoSaldo <= 0
      ? 'quitado'
      : 'em_dia'

  const { error: updateError } = await supabase
    .from('crediario')
    .update({ saldo: novoSaldo, status: novoStatus })
    .eq('id', crediarioId)

  return { error: updateError?.message ?? null }
}

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
  const saldoResult = await recalcularSaldoCrediario(crediarioId)
  if (saldoResult.error) return saldoResult

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

export async function editarPagamentoParcela(
  parcelaId: string,
  crediarioId: string,
  data: PagarParcelaFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const { error: parcelaError } = await supabase
    .from('crediario_parcelas')
    .update({
      valor_pago: data.valor_pago,
      data_pagamento: data.data_pagamento,
      forma_pagamento: data.forma_pagamento,
      observacoes: data.observacoes || null,
      recebido_por: userId,
    })
    .eq('id', parcelaId)
    .eq('status', 'pago')

  if (parcelaError) return { error: parcelaError.message }

  const saldoResult = await recalcularSaldoCrediario(crediarioId)
  if (saldoResult.error) return saldoResult

  const { data: lancamentos, error: lancamentoFetchError } = await supabase
    .from('lancamentos')
    .select('id')
    .eq('referencia_id', parcelaId)
    .eq('referencia_tipo', 'crediario_parcela')

  if (lancamentoFetchError) return { error: lancamentoFetchError.message }

  if (lancamentos && lancamentos.length > 0) {
    const { error: lancamentoError } = await supabase
      .from('lancamentos')
      .update({
        valor: data.valor_pago,
        data_lancamento: data.data_pagamento,
        forma_pagamento: data.forma_pagamento,
        observacoes: data.observacoes || null,
        editado: true,
        updated_by: userId,
      })
      .eq('referencia_id', parcelaId)
      .eq('referencia_tipo', 'crediario_parcela')

    return { error: lancamentoError?.message ?? null }
  }

  const { error: insertLancamentoError } = await supabase.from('lancamentos').insert({
    tipo: 'entrada',
    descricao: 'Pagamento parcela crediario',
    valor: data.valor_pago,
    data_lancamento: data.data_pagamento,
    forma_pagamento: data.forma_pagamento,
    referencia_id: parcelaId,
    referencia_tipo: 'crediario_parcela',
    observacoes: data.observacoes || null,
    created_by: userId,
    updated_by: userId,
    editado: true,
  })

  return { error: insertLancamentoError?.message ?? null }
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
    .select('cliente_id, created_at, venda_id, venda:vendas(id, numero, data_venda, desconto)')
    .eq('id', crediarioId)
    .single()

  if (fetchError) return { error: fetchError.message }

  const saldo = Math.max(0, data.total - data.entrada)
  const valorParcela = Math.round((saldo / data.num_parcelas) * 100) / 100

  const { error: deleteError } = await supabase
    .from('crediario_parcelas')
    .delete()
    .eq('crediario_id', crediarioId)

  if (deleteError) return { error: deleteError.message }

  const crediarioTyped = crediario as unknown as {
    cliente_id: string; created_at: string; venda_id: string
    venda: { id: string; numero: number; data_venda: string; desconto: number } | { id: string; numero: number; data_venda: string; desconto: number }[] | null
  }
  const vendaRaw = crediarioTyped.venda
  const venda = (Array.isArray(vendaRaw) ? vendaRaw[0] : vendaRaw) ?? null
  const dataVenda = venda?.data_venda ?? null
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
      total: data.total,
      entrada: data.entrada,
      saldo,
      num_parcelas: data.num_parcelas,
      valor_parcela: valorParcela,
      dia_vencimento: data.dia_vencimento,
    })
    .eq('id', crediarioId)

  if (updateError) return { error: updateError.message }

  if (crediarioTyped.venda_id) {
    const desconto = venda?.desconto ?? 0
    const { error: vendaError } = await supabase
      .from('vendas')
      .update({
        subtotal: Math.round((data.total + desconto) * 100) / 100,
        total: data.total,
        valor_pago: Math.min(data.entrada, data.total),
      })
      .eq('id', crediarioTyped.venda_id)

    if (vendaError) return { error: vendaError.message }

    const { data: lancamentosEntrada, error: lancamentoFetchError } = await supabase
      .from('lancamentos')
      .select('id')
      .eq('referencia_id', crediarioTyped.venda_id)
      .eq('referencia_tipo', 'venda')
      .like('descricao', 'Entrada crediario Venda #%')

    if (lancamentoFetchError) return { error: lancamentoFetchError.message }

    if (data.entrada > 0 && lancamentosEntrada && lancamentosEntrada.length > 0) {
      const { error: lancamentoError } = await supabase
        .from('lancamentos')
        .update({
          valor: data.entrada,
          data_lancamento: dataVenda ?? new Date().toISOString().slice(0, 10),
          forma_pagamento: 'crediario',
        })
        .eq('referencia_id', crediarioTyped.venda_id)
        .eq('referencia_tipo', 'venda')
        .like('descricao', 'Entrada crediario Venda #%')

      if (lancamentoError) return { error: lancamentoError.message }
    }

    if (data.entrada > 0 && (!lancamentosEntrada || lancamentosEntrada.length === 0)) {
      const { error: insertLancamentoError } = await supabase.from('lancamentos').insert({
        tipo: 'entrada',
        descricao: `Entrada crediario Venda #${venda?.numero ?? ''}`.trim(),
        valor: data.entrada,
        data_lancamento: dataVenda ?? new Date().toISOString().slice(0, 10),
        forma_pagamento: 'crediario',
        referencia_id: crediarioTyped.venda_id,
        referencia_tipo: 'venda',
      })

      if (insertLancamentoError) return { error: insertLancamentoError.message }
    }

    if (data.entrada <= 0 && lancamentosEntrada && lancamentosEntrada.length > 0) {
      const { error: deleteLancamentoError } = await supabase
        .from('lancamentos')
        .delete()
        .eq('referencia_id', crediarioTyped.venda_id)
        .eq('referencia_tipo', 'venda')
        .like('descricao', 'Entrada crediario Venda #%')

      if (deleteLancamentoError) return { error: deleteLancamentoError.message }
    }
  }

  return { error: null }
}
