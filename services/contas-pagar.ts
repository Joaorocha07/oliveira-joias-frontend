import { supabase } from '@/lib/supabase'
import type { ContaPagar, ContaPagarInsert, ContaPagarUpdate } from '@/types'
import { today } from '@/utils'

export async function listarContasPagar(): Promise<{ data: ContaPagar[]; error: string | null }> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .not('status', 'eq', 'cancelado')
    .order('data_vencimento', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ContaPagar[], error: null }
}

export async function criarContaPagar(
  dados: Omit<ContaPagarInsert, 'created_by' | 'status' | 'data_pagamento' | 'forma_pagamento' | 'lancamento_id'>,
  userId: string,
): Promise<{ data: ContaPagar | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .insert({
      ...dados,
      status: 'pendente',
      data_pagamento: null,
      forma_pagamento: null,
      lancamento_id: null,
      created_by: userId,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as ContaPagar, error: null }
}

export async function atualizarContaPagar(
  id: string,
  dados: ContaPagarUpdate,
): Promise<{ data: ContaPagar | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as ContaPagar, error: null }
}

export async function excluirContaPagar(id: string): Promise<{ error: string | null }> {
  // 1. Busca o lancamento_id antes de deletar (se a conta foi paga, há um lançamento vinculado)
  const { data: conta } = await supabase
    .from('contas_pagar')
    .select('lancamento_id')
    .eq('id', id)
    .single()

  // 2. Deleta a conta
  const { error } = await supabase.from('contas_pagar').delete().eq('id', id)
  if (error) return { error: error.message }

  // 3. Se havia lançamento vinculado, remove do caixa também
  if (conta?.lancamento_id) {
    await supabase.from('lancamentos').delete().eq('id', conta.lancamento_id)
    // Falha silenciosa — a conta já foi excluída com sucesso
  }

  return { error: null }
}

/** Avança a data de vencimento em 1 mês, respeitando o último dia do mês destino */
function proximoVencimento(dataVencimento: string): string {
  const [y, m, d] = dataVencimento.split('-').map(Number)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear  = m === 12 ? y + 1 : y
  // Último dia do mês seguinte (para clampar dia 31 → 28/30)
  const ultimoDia = new Date(nextYear, nextMonth, 0).getDate()
  const dia = Math.min(d, ultimoDia)
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export async function pagarConta(
  conta: ContaPagar,
  formaPagamento: string,
  userId: string,
): Promise<{ error: string | null }> {
  // 1. Cria lançamento de saída no caixa
  const { data: lancamento, error: lancError } = await supabase
    .from('lancamentos')
    .insert({
      tipo: 'saida',
      descricao: conta.nome,
      valor: conta.valor,
      data_lancamento: today(),
      categoria_nome: conta.fixa ? 'Conta Fixa' : 'Conta Variável',
      forma_pagamento: formaPagamento,
      referencia_id: conta.id,
      referencia_tipo: 'conta_pagar',
      observacoes: conta.descricao ?? null,
      created_by: userId,
      updated_by: null,
      categoria_id: null,
    })
    .select('id')
    .single()

  if (lancError) return { error: lancError.message }

  // 2. Marca a conta como paga
  const { error: updateError } = await supabase
    .from('contas_pagar')
    .update({
      status: 'pago',
      data_pagamento: today(),
      forma_pagamento: formaPagamento,
      lancamento_id: lancamento.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conta.id)

  if (updateError) return { error: updateError.message }

  // 3. Se for conta fixa, cria a próxima instância automaticamente
  if (conta.fixa) {
    await supabase
      .from('contas_pagar')
      .insert({
        nome: conta.nome,
        descricao: conta.descricao,
        valor: conta.valor,
        fixa: true,
        data_vencimento: proximoVencimento(conta.data_vencimento),
        status: 'pendente',
        data_pagamento: null,
        forma_pagamento: null,
        lancamento_id: null,
        observacoes: conta.observacoes,
        created_by: userId,
      })
    // Falha silenciosa — a conta foi paga com sucesso mesmo se a renovação falhar
  }

  return { error: null }
}

export async function cancelarContaPagar(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('contas_pagar')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  return { error: null }
}
