import { supabase } from '@/lib/supabase'
import { gerarDatasParcelas } from '@/utils'
import type { ServicoFormData } from '@/schemas/servico'
import type { ServicoStatus } from '@/types'

function buildServicoPayload(data: ServicoFormData) {
  return {
    cliente_id: data.cliente_id || null,
    origem_id: data.origem_id || null,
    origem_outro: data.origem_outro || null,
    tipo: data.tipo,
    descricao: data.descricao,
    observacoes_internas: data.observacoes_internas || null,
    valor: data.valor,
    custo_estimado: data.custo_estimado ?? null,
    status: data.status,
    data_entrada: data.data_entrada,
    data_previsao: data.data_previsao || null,
    forma_pagamento: data.forma_pagamento ?? null,
    pago: data.pago,
    responsavel_id: data.responsavel_id || null,
  }
}

async function createLancamentosServico(
  servicoId: string,
  servicoNumero: number,
  data: ServicoFormData,
  userId: string,
) {
  const inserts: object[] = []

  // Custo estimado → lançamento de saída (despesa de serviço)
  if (data.custo_estimado && data.custo_estimado > 0) {
    inserts.push({
      tipo: 'saida',
      descricao: `Custo estimado - Serviço #${servicoNumero}`,
      valor: data.custo_estimado,
      data_lancamento: data.data_entrada,
      referencia_id: servicoId,
      referencia_tipo: 'servico',
      created_by: userId,
    })
  }

  // Serviço pago com forma != crediário → lançamento de entrada
  if (data.pago && data.forma_pagamento && data.forma_pagamento !== 'crediario') {
    inserts.push({
      tipo: 'entrada',
      descricao: `Serviço #${servicoNumero}`,
      valor: data.valor,
      data_lancamento: data.data_entrada,
      forma_pagamento: data.forma_pagamento,
      referencia_id: servicoId,
      referencia_tipo: 'servico',
      created_by: userId,
    })
  }

  if (inserts.length > 0) {
    await supabase.from('lancamentos').insert(inserts)
  }
}

async function createCrediarioServico(
  servicoId: string,
  data: ServicoFormData,
  userId: string,
): Promise<{ error: string | null }> {
  if (!data.cliente_id) return { error: 'Cliente obrigatório para crediário.' }

  const total = data.valor
  const entrada = data.entrada_crediario ?? 0
  const numParcelas = data.num_parcelas ?? 1
  const diaVencimento = data.dia_vencimento ?? 10
  const saldo = Math.max(0, total - entrada)
  const valorParcela = Math.round((saldo / numParcelas) * 100) / 100

  const { data: crediario, error: crediarioError } = await supabase
    .from('crediario')
    .insert({
      venda_id: null,
      cliente_id: data.cliente_id,
      total,
      entrada,
      saldo,
      num_parcelas: numParcelas,
      valor_parcela: valorParcela,
      dia_vencimento: diaVencimento,
      status: saldo <= 0 ? 'quitado' : 'em_dia',
      created_by: userId,
    })
    .select('id')
    .single()

  if (crediarioError) return { error: crediarioError.message }

  const datas = gerarDatasParcelas(numParcelas, diaVencimento, new Date(data.data_entrada))
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

  // Lançamento de entrada pela entrada do crediário
  if (entrada > 0) {
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: `Entrada crediário - Serviço`,
      valor: entrada,
      data_lancamento: data.data_entrada,
      referencia_id: crediario.id,
      referencia_tipo: 'crediario',
      created_by: userId,
    })
  }

  return { error: null }
}

export async function createServico(
  data: ServicoFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const { data: servico, error: servicoError } = await supabase
    .from('servicos')
    .insert({ ...buildServicoPayload(data), created_by: userId })
    .select('id, numero')
    .single()

  if (servicoError) return { error: servicoError.message }

  await createLancamentosServico(servico.id, servico.numero, data, userId)

  if (data.pago && data.forma_pagamento === 'crediario') {
    const { error } = await createCrediarioServico(servico.id, data, userId)
    if (error) return { error }
  }

  return { error: null }
}

export async function updateServico(
  id: string,
  data: ServicoFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const { data: servico, error: servicoError } = await supabase
    .from('servicos')
    .update(buildServicoPayload(data))
    .eq('id', id)
    .select('id, numero')
    .single()

  if (servicoError) return { error: servicoError.message }

  // Recria lançamentos: apaga os antigos e insere os novos
  await supabase
    .from('lancamentos')
    .delete()
    .eq('referencia_id', id)
    .eq('referencia_tipo', 'servico')

  await createLancamentosServico(id, servico.numero, data, userId)

  // Crediário: cria somente se ainda não existe um para este serviço
  if (data.pago && data.forma_pagamento === 'crediario' && data.cliente_id) {
    const { data: existente } = await supabase
      .from('crediario')
      .select('id')
      .eq('cliente_id', data.cliente_id)
      .is('venda_id', null)
      .limit(1)
      .maybeSingle()

    if (!existente) {
      const { error } = await createCrediarioServico(id, data, userId)
      if (error) return { error }
    }
  }

  return { error: null }
}

export async function updateServicoStatus(
  id: string,
  status: ServicoStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('servicos')
    .update({
      status,
      pago: status === 'concluido',
    })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteServico(id: string): Promise<{ error: string | null }> {
  await supabase.from('lancamentos').delete().eq('referencia_id', id).eq('referencia_tipo', 'servico')
  const { error } = await supabase.from('servicos').delete().eq('id', id)
  return { error: error?.message ?? null }
}
