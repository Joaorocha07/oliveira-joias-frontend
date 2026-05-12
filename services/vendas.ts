import { supabase } from '@/lib/supabase'
import { gerarDatasParcelas } from '@/utils'
import type { VendaFormData, VendaItemFormData } from '@/schemas/venda'
import type { VendaStatus, FormaPagamento } from '@/types'

export interface UpdateVendaData {
  cliente_id: string | null
  status: VendaStatus
  forma_pagamento: FormaPagamento
  desconto: number
  data_venda: string
  observacoes: string
  num_parcelas: number
  entrada: number
  dia_vencimento: number
}

function itemSubtotal(item: VendaItemFormData) {
  return Math.max(0, Math.round((item.quantidade * item.preco_unitario - item.desconto) * 100) / 100)
}

export async function createVenda(
  data: VendaFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const subtotal = data.itens.reduce((acc, item) => acc + itemSubtotal(item), 0)
  const total = Math.max(0, Math.round((subtotal - data.desconto) * 100) / 100)

  // 1. Venda
  const { data: venda, error: vendaError } = await supabase
    .from('vendas')
    .insert({
      cliente_id: data.cliente_id || null,
      vendedor_id: userId,
      status: data.forma_pagamento === 'crediario' ? 'crediario' : 'pago',
      forma_pagamento: data.forma_pagamento,
      subtotal,
      desconto: data.desconto,
      total,
      valor_pago: total,
      troco: 0,
      observacoes: data.observacoes || null,
      data_venda: data.data_venda,
    })
    .select('id, numero')
    .single()

  if (vendaError) return { error: vendaError.message }

  // 2. Itens
  const { error: itensError } = await supabase.from('venda_itens').insert(
    data.itens.map((item) => ({
      venda_id: venda.id,
      produto_id: item.produto_id,
      variacao_id: item.variacao_id || null,
      nome_produto: item.nome_produto,
      descricao: null,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      custo_unitario: item.custo_unitario,
      desconto: item.desconto,
      subtotal: itemSubtotal(item),
    })),
  )
  if (itensError) return { error: itensError.message }

  // 3. Crediário
  if (data.forma_pagamento === 'crediario' && data.cliente_id) {
    const saldo = Math.max(0, total - data.entrada)
    const valorParcela = Math.round((saldo / data.num_parcelas) * 100) / 100

    const { data: crediario, error: crediarioError } = await supabase
      .from('crediario')
      .insert({
        venda_id: venda.id,
        cliente_id: data.cliente_id,
        total,
        entrada: data.entrada,
        saldo,
        num_parcelas: data.num_parcelas,
        valor_parcela: valorParcela,
        dia_vencimento: data.dia_vencimento,
        status: 'em_dia',
        created_by: userId,
      })
      .select('id')
      .single()

    if (crediarioError) return { error: crediarioError.message }

    const datas = gerarDatasParcelas(data.num_parcelas, data.dia_vencimento)
    const { error: parcelasError } = await supabase
      .from('crediario_parcelas')
      .insert(
        datas.map((dataVenc, i) => ({
          crediario_id: crediario.id,
          cliente_id: data.cliente_id,
          numero: i + 1,
          valor: valorParcela,
          valor_pago: 0,
          data_vencimento: dataVenc,
          data_pagamento: null,
          forma_pagamento: null,
          status: 'pendente',
        })),
      )
    if (parcelasError) return { error: parcelasError.message }
  }

  // 4. Estoque (itens com variacao_id)
  const movs = data.itens
    .filter((item) => item.variacao_id)
    .map((item) => ({
      variacao_id: item.variacao_id!,
      produto_id: item.produto_id,
      tipo: 'saida',
      quantidade: item.quantidade,
      quantidade_antes: 0,
      quantidade_depois: 0,
      motivo: `Venda #${venda.numero}`,
      referencia_id: venda.id,
      referencia_tipo: 'venda',
      created_by: userId,
    }))
  if (movs.length > 0) {
    await supabase.from('estoque_movimentacoes').insert(movs)
  }

  // 5. Lançamento
  await supabase.from('lancamentos').insert({
    tipo: 'entrada',
    descricao: `Venda #${venda.numero}`,
    valor: total,
    data_lancamento: data.data_venda,
    forma_pagamento: data.forma_pagamento,
    referencia_id: venda.id,
    referencia_tipo: 'venda',
    created_by: userId,
  })

  return { error: null }
}

export async function updateVenda(
  id: string,
  subtotal: number,
  data: UpdateVendaData,
  userId: string,
): Promise<{ error: string | null }> {
  const total = Math.max(0, Math.round((subtotal - data.desconto) * 100) / 100)
  const isCrediario = data.forma_pagamento === 'crediario'
  const status = isCrediario ? 'crediario' : data.status

  const { error } = await supabase
    .from('vendas')
    .update({
      cliente_id: data.cliente_id || null,
      status,
      forma_pagamento: data.forma_pagamento,
      desconto: data.desconto,
      total,
      valor_pago: isCrediario ? data.entrada : total,
      data_venda: data.data_venda,
      observacoes: data.observacoes || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await supabase
    .from('lancamentos')
    .update({ valor: total, data_lancamento: data.data_venda, forma_pagamento: data.forma_pagamento })
    .eq('referencia_id', id)
    .eq('referencia_tipo', 'venda')

  if (isCrediario && data.cliente_id) {
    const { data: existing } = await supabase
      .from('crediario')
      .select('id')
      .eq('venda_id', id)
      .maybeSingle()

    if (!existing) {
      const saldo = Math.max(0, total - data.entrada)
      const valorParcela = Math.round((saldo / data.num_parcelas) * 100) / 100

      const { data: crediario, error: crediarioError } = await supabase
        .from('crediario')
        .insert({
          venda_id: id,
          cliente_id: data.cliente_id,
          total,
          entrada: data.entrada,
          saldo,
          num_parcelas: data.num_parcelas,
          valor_parcela: valorParcela,
          dia_vencimento: data.dia_vencimento,
          status: 'em_dia',
          created_by: userId,
        })
        .select('id')
        .single()

      if (crediarioError) return { error: crediarioError.message }

      const datas = gerarDatasParcelas(data.num_parcelas, data.dia_vencimento)
      const { error: parcelasError } = await supabase
        .from('crediario_parcelas')
        .insert(
          datas.map((dataVenc, i) => ({
            crediario_id: crediario.id,
            cliente_id: data.cliente_id,
            numero: i + 1,
            valor: valorParcela,
            valor_pago: 0,
            data_vencimento: dataVenc,
            data_pagamento: null,
            forma_pagamento: null,
            status: 'pendente',
          })),
        )

      if (parcelasError) return { error: parcelasError.message }
    }
  }

  return { error: null }
}

export async function deleteVenda(vendaId: string): Promise<{ error: string | null }> {
  const { data: crediarios, error: crediarioFetchError } = await supabase
    .from('crediario')
    .select('id')
    .eq('venda_id', vendaId)

  if (crediarioFetchError) return { error: crediarioFetchError.message }

  const crediarioIds = (crediarios ?? []).map((crediario) => crediario.id)

  if (crediarioIds.length > 0) {
    const { data: parcelas, error: parcelasFetchError } = await supabase
      .from('crediario_parcelas')
      .select('id')
      .in('crediario_id', crediarioIds)

    if (parcelasFetchError) return { error: parcelasFetchError.message }

    const parcelaIds = (parcelas ?? []).map((parcela) => parcela.id)

    if (parcelaIds.length > 0) {
      const { error: lancamentosParcelasError } = await supabase
        .from('lancamentos')
        .delete()
        .eq('referencia_tipo', 'crediario_parcela')
        .in('referencia_id', parcelaIds)

      if (lancamentosParcelasError) return { error: lancamentosParcelasError.message }
    }

    const { error: parcelasError } = await supabase
      .from('crediario_parcelas')
      .delete()
      .in('crediario_id', crediarioIds)

    if (parcelasError) return { error: parcelasError.message }

    const { error: crediarioError } = await supabase
      .from('crediario')
      .delete()
      .in('id', crediarioIds)

    if (crediarioError) return { error: crediarioError.message }
  }

  const cleanupQueries = [
    supabase.from('lancamentos').delete().eq('referencia_tipo', 'venda').eq('referencia_id', vendaId),
    supabase.from('estoque_movimentacoes').delete().eq('referencia_tipo', 'venda').eq('referencia_id', vendaId),
    supabase.from('venda_itens').delete().eq('venda_id', vendaId),
  ]

  for (const query of cleanupQueries) {
    const { error } = await query
    if (error) return { error: error.message }
  }

  const { error: vendaError } = await supabase
    .from('vendas')
    .delete()
    .eq('id', vendaId)

  return { error: vendaError?.message ?? null }
}
