import { supabase } from '@/lib/supabase'
import { gerarDatasParcelas } from '@/utils'
import type { VendaFormData, VendaItemFormData } from '@/schemas/venda'
import type { VendaStatus, FormaPagamento } from '@/types'

export interface DeleteVendaPreview {
  numero: number
  itens: { nome_produto: string; quantidade: number; variacao_id: string | null }[]
  crediario: {
    id: string
    total: number
    parcelasPagas: number
    parcelasTotal: number
  } | null
}

export interface UpdateVendaData {
  cliente_id: string | null
  vendedor_id: string | null
  origem_id: string | null
  origem_outro: string | null
  status: VendaStatus
  forma_pagamento: FormaPagamento
  desconto: number
  data_venda: string
  observacoes: string
  itens?: {
    id: string
    produto_id: string
    variacao_id: string | null
    nome_produto: string
    quantidade: number
    preco_unitario: number
    custo_unitario: number
    desconto: number
  }[]
  descricao_livre?: string
  valor_livre?: number
  custo_livre?: number
}

function itemSubtotal(item: VendaItemFormData) {
  return Math.max(0, Math.round((item.quantidade * item.preco_unitario - item.desconto) * 100) / 100)
}

export async function createVenda(
  data: VendaFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const isLivre = data.tipo === 'livre'
  const subtotal = isLivre
    ? Math.round(data.valor_livre * 100) / 100
    : data.itens.reduce((acc, item) => acc + itemSubtotal(item), 0)
  const total = Math.max(0, Math.round((subtotal - data.desconto) * 100) / 100)
  const isCrediario = data.forma_pagamento === 'crediario'
  const valorPagoInicial = isCrediario ? Math.min(data.entrada, total) : total

  // 1. Venda
  const { data: venda, error: vendaError } = await supabase
    .from('vendas')
    .insert({
      tipo: data.tipo,
      cliente_id: data.cliente_id || null,
      vendedor_id: data.vendedor_id || userId,
      origem_id: data.origem_id || null,
      origem_outro: data.origem_outro || null,
      status: isCrediario ? 'crediario' : 'pago',
      forma_pagamento: data.forma_pagamento,
      subtotal,
      desconto: data.desconto,
      total,
      valor_pago: valorPagoInicial,
      troco: 0,
      descricao_livre: isLivre ? data.descricao_livre : null,
      custo_livre: isLivre ? data.custo_livre : null,
      observacoes: data.observacoes || null,
      data_venda: data.data_venda,
    })
    .select('id, numero')
    .single()

  if (vendaError) return { error: vendaError.message }

  // 2. Itens (apenas venda normal)
  if (!isLivre) {
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
  }

  // 3. Crediário
  if (isCrediario && data.cliente_id) {
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

    const datas = gerarDatasParcelas(data.num_parcelas, data.dia_vencimento, new Date(data.data_venda), data.primeira_parcela_proximo_mes)
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

  // 4. Estoque (apenas venda normal com variacao_id)
  if (!isLivre) {
    const itensComVariacao = data.itens.filter((item) => item.variacao_id)
    if (itensComVariacao.length > 0) {
      const variacaoIds = itensComVariacao.map((item) => item.variacao_id!)
      const { data: variacoes } = await supabase
        .from('produto_variacoes')
        .select('id, estoque_atual')
        .in('id', variacaoIds)

      // running map to correctly handle same variation appearing multiple times
      const estoqueRunning = Object.fromEntries((variacoes ?? []).map((v) => [v.id, v.estoque_atual as number]))

      const movs = itensComVariacao.map((item) => {
        const id = item.variacao_id!
        const estoqueAntes = estoqueRunning[id] ?? 0
        const estoqueDepois = Math.max(0, estoqueAntes - item.quantidade)
        estoqueRunning[id] = estoqueDepois
        return {
          variacao_id: id,
          produto_id: item.produto_id,
          tipo: 'saida',
          quantidade: item.quantidade,
          quantidade_antes: estoqueAntes,
          quantidade_depois: estoqueDepois,
          motivo: `Venda #${venda.numero}`,
          referencia_id: venda.id,
          referencia_tipo: 'venda',
          created_by: userId,
        }
      })

      await supabase.from('estoque_movimentacoes').insert(movs)

      // One UPDATE per variation with the final computed stock
      const variacoesUnicas = [...new Set(itensComVariacao.map((i) => i.variacao_id!))]
      for (const variacaoId of variacoesUnicas) {
        await supabase
          .from('produto_variacoes')
          .update({ estoque_atual: estoqueRunning[variacaoId] })
          .eq('id', variacaoId)
      }
    }
  }

  // 5. Lançamento
  if (!isCrediario || valorPagoInicial > 0) {
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: isCrediario ? `Entrada crediario Venda #${venda.numero}` : `Venda #${venda.numero}`,
      valor: valorPagoInicial,
      data_lancamento: data.data_venda,
      forma_pagamento: data.forma_pagamento,
      referencia_id: venda.id,
      referencia_tipo: 'venda',
      created_by: userId,
    })
  }

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
  const valorPago = isCrediario ? 0 : total

  if (isCrediario) {
    const { data: existingCrediario, error: existingCrediarioError } = await supabase
      .from('crediario')
      .select('id, total')
      .eq('venda_id', id)
      .maybeSingle()

    if (existingCrediarioError) return { error: existingCrediarioError.message }

    if (existingCrediario && existingCrediario.total !== total) {
      const { data: parcelasPagas, error: parcelasPagasError } = await supabase
        .from('crediario_parcelas')
        .select('id')
        .eq('crediario_id', existingCrediario.id)
        .eq('status', 'pago')

      if (parcelasPagasError) return { error: parcelasPagasError.message }
      if ((parcelasPagas ?? []).length > 0) {
        return { error: 'Nao e possivel alterar o valor de uma venda no crediario com parcelas pagas.' }
      }
    }
  }

  const { error } = await supabase
    .from('vendas')
    .update({
      cliente_id: data.cliente_id || null,
      vendedor_id: data.vendedor_id || null,
      origem_id: data.origem_id || null,
      origem_outro: data.origem_outro || null,
      status,
      forma_pagamento: data.forma_pagamento,
      desconto: data.desconto,
      subtotal,
      total,
      valor_pago: valorPago,
      descricao_livre: data.descricao_livre || null,
      custo_livre: data.custo_livre ?? null,
      data_venda: data.data_venda,
      observacoes: data.observacoes || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  if (data.itens && data.itens.length > 0) {
    const itemIds = data.itens.map((item) => item.id)
    const { data: itensAtuais, error: itensAtuaisError } = await supabase
      .from('venda_itens')
      .select('id, produto_id, variacao_id, quantidade')
      .in('id', itemIds)

    if (itensAtuaisError) return { error: itensAtuaisError.message }

    const itensAtuaisMap = new Map((itensAtuais ?? []).map((item) => [item.id as string, item]))

    for (const item of data.itens) {
      const subtotalItem = Math.max(0, Math.round((item.quantidade * item.preco_unitario - item.desconto) * 100) / 100)
      const itemAtual = itensAtuaisMap.get(item.id)

      if (itemAtual?.variacao_id === item.variacao_id) {
        if (itemAtual?.variacao_id) {
          const delta = item.quantidade - (itemAtual.quantidade as number)
          if (delta !== 0) {
            const { data: variacao, error: variacaoError } = await supabase
              .from('produto_variacoes')
              .select('estoque_atual')
              .eq('id', itemAtual.variacao_id)
              .single()

            if (variacaoError) return { error: variacaoError.message }

            const estoqueAntes = variacao.estoque_atual as number
            const estoqueDepois = estoqueAntes - delta

            if (estoqueDepois < 0) {
              return { error: `Estoque insuficiente para ${item.nome_produto}. Disponivel: ${estoqueAntes}.` }
            }

            const { error: estoqueError } = await supabase
              .from('produto_variacoes')
              .update({ estoque_atual: estoqueDepois })
              .eq('id', itemAtual.variacao_id)

            if (estoqueError) return { error: estoqueError.message }

            await supabase.from('estoque_movimentacoes').insert({
              variacao_id: itemAtual.variacao_id,
              produto_id: itemAtual.produto_id,
              tipo: delta > 0 ? 'saida' : 'devolucao',
              quantidade: Math.abs(delta),
              quantidade_antes: estoqueAntes,
              quantidade_depois: estoqueDepois,
              motivo: 'Ajuste de venda',
              referencia_id: id,
              referencia_tipo: 'venda',
              created_by: userId,
            })
          }
        }
      } else {
        if (itemAtual?.variacao_id) {
          const { data: variacaoAntiga, error: variacaoAntigaError } = await supabase
            .from('produto_variacoes')
            .select('estoque_atual')
            .eq('id', itemAtual.variacao_id)
            .single()

          if (variacaoAntigaError) return { error: variacaoAntigaError.message }

          const estoqueAntes = variacaoAntiga.estoque_atual as number
          const estoqueDepois = estoqueAntes + (itemAtual.quantidade as number)
          const { error: devolucaoError } = await supabase
            .from('produto_variacoes')
            .update({ estoque_atual: estoqueDepois })
            .eq('id', itemAtual.variacao_id)

          if (devolucaoError) return { error: devolucaoError.message }

          await supabase.from('estoque_movimentacoes').insert({
            variacao_id: itemAtual.variacao_id,
            produto_id: itemAtual.produto_id,
            tipo: 'devolucao',
            quantidade: itemAtual.quantidade,
            quantidade_antes: estoqueAntes,
            quantidade_depois: estoqueDepois,
            motivo: 'Troca de produto na venda',
            referencia_id: id,
            referencia_tipo: 'venda',
            created_by: userId,
          })
        }

        if (item.variacao_id) {
          const { data: variacaoNova, error: variacaoNovaError } = await supabase
            .from('produto_variacoes')
            .select('estoque_atual')
            .eq('id', item.variacao_id)
            .single()

          if (variacaoNovaError) return { error: variacaoNovaError.message }

          const estoqueAntes = variacaoNova.estoque_atual as number
          const estoqueDepois = estoqueAntes - item.quantidade
          if (estoqueDepois < 0) {
            return { error: `Estoque insuficiente para ${item.nome_produto}. Disponivel: ${estoqueAntes}.` }
          }

          const { error: saidaError } = await supabase
            .from('produto_variacoes')
            .update({ estoque_atual: estoqueDepois })
            .eq('id', item.variacao_id)

          if (saidaError) return { error: saidaError.message }

          await supabase.from('estoque_movimentacoes').insert({
            variacao_id: item.variacao_id,
            produto_id: item.produto_id,
            tipo: 'saida',
            quantidade: item.quantidade,
            quantidade_antes: estoqueAntes,
            quantidade_depois: estoqueDepois,
            motivo: 'Troca de produto na venda',
            referencia_id: id,
            referencia_tipo: 'venda',
            created_by: userId,
          })
        }
      }

      const { error: itemError } = await supabase
        .from('venda_itens')
        .update({
          produto_id: item.produto_id,
          variacao_id: item.variacao_id,
          nome_produto: item.nome_produto,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          custo_unitario: item.custo_unitario,
          desconto: item.desconto,
          subtotal: subtotalItem,
        })
        .eq('id', item.id)

      if (itemError) return { error: itemError.message }
    }
  }

  if (isCrediario) {
    await supabase
      .from('lancamentos')
      .delete()
      .eq('referencia_id', id)
      .eq('referencia_tipo', 'venda')
      .like('descricao', 'Venda #%')
  } else {
    await supabase
      .from('lancamentos')
      .update({ valor: total, data_lancamento: data.data_venda, forma_pagamento: data.forma_pagamento })
      .eq('referencia_id', id)
      .eq('referencia_tipo', 'venda')
  }

  if (isCrediario && data.cliente_id) {
    const { data: existing } = await supabase
      .from('crediario')
      .select('id, total, entrada, num_parcelas, dia_vencimento')
      .eq('venda_id', id)
      .maybeSingle()

    if (existing) {
      const { data: parcelasPagas, error: parcelasPagasError } = await supabase
        .from('crediario_parcelas')
        .select('id')
        .eq('crediario_id', existing.id)
        .eq('status', 'pago')

      if (parcelasPagasError) return { error: parcelasPagasError.message }
      if ((parcelasPagas ?? []).length > 0 && existing.total !== total) {
        return { error: 'Nao e possivel alterar o valor de uma venda no crediario com parcelas pagas.' }
      }

      if ((parcelasPagas ?? []).length === 0) {
        const entrada = Math.min((existing.entrada as number) ?? 0, total)
        const numParcelas = (existing.num_parcelas as number) || 1
        const diaVencimento = (existing.dia_vencimento as number) || 10
        const saldo = Math.max(0, total - entrada)
        const valorParcela = Math.round((saldo / numParcelas) * 100) / 100

        const { error: parcelasDeleteError } = await supabase
          .from('crediario_parcelas')
          .delete()
          .eq('crediario_id', existing.id)

        if (parcelasDeleteError) return { error: parcelasDeleteError.message }

        const datas = gerarDatasParcelas(numParcelas, diaVencimento, new Date(data.data_venda))
        const { error: parcelasInsertError } = await supabase
          .from('crediario_parcelas')
          .insert(
            datas.map((dataVenc, i) => ({
              crediario_id: existing.id,
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

        if (parcelasInsertError) return { error: parcelasInsertError.message }

        const { error: crediarioUpdateError } = await supabase
          .from('crediario')
          .update({
            cliente_id: data.cliente_id,
            total,
            entrada,
            saldo,
            valor_parcela: valorParcela,
          })
          .eq('id', existing.id)

        if (crediarioUpdateError) return { error: crediarioUpdateError.message }
      }
    } else {
      // Create crediário with defaults — user can adjust via Editar Crediário
      const num_parcelas = 1
      const entrada = 0
      const dia_vencimento = 10
      const saldo = total
      const valorParcela = total

      const { data: crediario, error: crediarioError } = await supabase
        .from('crediario')
        .insert({
          venda_id: id,
          cliente_id: data.cliente_id,
          total,
          entrada,
          saldo,
          num_parcelas,
          valor_parcela: valorParcela,
          dia_vencimento,
          status: 'em_dia',
          created_by: userId,
        })
        .select('id')
        .single()

      if (crediarioError) return { error: crediarioError.message }

      const datas = gerarDatasParcelas(num_parcelas, dia_vencimento, new Date(data.data_venda))
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

export async function previewDeleteVenda(
  vendaId: string,
): Promise<{ data: DeleteVendaPreview | null; error: string | null }> {
  const { data: venda, error: vendaError } = await supabase
    .from('vendas')
    .select('numero')
    .eq('id', vendaId)
    .single()

  if (vendaError) return { data: null, error: vendaError.message }

  const { data: itens } = await supabase
    .from('venda_itens')
    .select('nome_produto, quantidade, variacao_id')
    .eq('venda_id', vendaId)

  const { data: crediarios } = await supabase
    .from('crediario')
    .select('id, total')
    .eq('venda_id', vendaId)

  let crediario: DeleteVendaPreview['crediario'] = null

  if (crediarios && crediarios.length > 0) {
    const c = crediarios[0]
    const { data: parcelas } = await supabase
      .from('crediario_parcelas')
      .select('status')
      .eq('crediario_id', c.id)

    crediario = {
      id: c.id,
      total: c.total as number,
      parcelasPagas: (parcelas ?? []).filter((p) => p.status === 'pago').length,
      parcelasTotal: (parcelas ?? []).length,
    }
  }

  return {
    data: {
      numero: venda.numero as number,
      itens: (itens ?? []) as DeleteVendaPreview['itens'],
      crediario,
    },
    error: null,
  }
}

export async function deleteVenda(vendaId: string): Promise<{ error: string | null }> {
  // Fetch venda numero early for movement descriptions
  const { data: vendaData } = await supabase.from('vendas').select('numero').eq('id', vendaId).single()
  const vendaNumero = vendaData?.numero ?? '?'

  // Delete crediário (all parcelas, including paid ones)
  const { data: crediarios, error: crediarioFetchError } = await supabase
    .from('crediario')
    .select('id')
    .eq('venda_id', vendaId)

  if (crediarioFetchError) return { error: crediarioFetchError.message }

  const crediarioIds = (crediarios ?? []).map((c) => c.id)

  if (crediarioIds.length > 0) {
    const { data: parcelas, error: parcelasFetchError } = await supabase
      .from('crediario_parcelas')
      .select('id')
      .in('crediario_id', crediarioIds)

    if (parcelasFetchError) return { error: parcelasFetchError.message }

    const parcelaIds = (parcelas ?? []).map((p) => p.id)

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

  // Restore stock for items that had a variacao_id
  const { data: itens } = await supabase
    .from('venda_itens')
    .select('produto_id, variacao_id, quantidade')
    .eq('venda_id', vendaId)

  const itensComVariacao = (itens ?? []).filter((item) => item.variacao_id)
  if (itensComVariacao.length > 0) {
    const variacaoIds = itensComVariacao.map((i) => i.variacao_id!)
    const { data: variacoes } = await supabase
      .from('produto_variacoes')
      .select('id, estoque_atual')
      .in('id', variacaoIds)

    const estoqueRunning = Object.fromEntries((variacoes ?? []).map((v) => [v.id, v.estoque_atual as number]))

    const movs = itensComVariacao.map((item) => {
      const id = item.variacao_id!
      const estoqueAntes = estoqueRunning[id] ?? 0
      const estoqueDepois = estoqueAntes + item.quantidade
      estoqueRunning[id] = estoqueDepois
      return {
        variacao_id: id,
        produto_id: item.produto_id,
        tipo: 'devolucao' as const,
        quantidade: item.quantidade,
        quantidade_antes: estoqueAntes,
        quantidade_depois: estoqueDepois,
        motivo: `Estorno Venda #${vendaNumero}`,
        referencia_id: vendaId,
        referencia_tipo: 'venda_estorno',
      }
    })

    await supabase.from('estoque_movimentacoes').insert(movs)

    const variacoesUnicas = [...new Set(itensComVariacao.map((i) => i.variacao_id!))]
    for (const variacaoId of variacoesUnicas) {
      await supabase
        .from('produto_variacoes')
        .update({ estoque_atual: estoqueRunning[variacaoId] })
        .eq('id', variacaoId)
    }
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
