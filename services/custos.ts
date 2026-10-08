import { supabase } from '@/lib/supabase'
import type { CustoAdicionalFormData } from '@/schemas/custo'
import type { CustoTipo, VendaCusto, VendaCustoComRelacoes } from '@/types'

// Custos adicionais (mão de obra, gravação, frete...) vinculados a vendas e/ou ordens de serviço.
// Cada custo gera um lançamento de saída no Caixa com referencia_id = venda_custos.id e
// referencia_tipo:
//   'venda_custo'   → vinculado a uma venda. Os relatórios descontam no lucro da venda e por
//                     isso NÃO o contam de novo como despesa operacional (ver relatorios/page.tsx).
//   'servico_custo' → só vinculado a uma OS. Entra como despesa comum e no lucro dos serviços.

export const REFERENCIA_CUSTO_VENDA = 'venda_custo'
export const REFERENCIA_CUSTO_SERVICO = 'servico_custo'
const REFERENCIAS_CUSTO = [REFERENCIA_CUSTO_VENDA, REFERENCIA_CUSTO_SERVICO]
const CATEGORIA_LANCAMENTO = 'Custos adicionais'

export interface CustoInput {
  venda_id: string | null
  servico_id: string | null
  tipo_id: string
  descricao: string
  valor: number
  data_custo: string
}

const SELECT_COM_RELACOES = `
  *,
  venda:vendas(id, numero, total, data_venda, cliente:clientes(nome)),
  servico:servicos(id, numero, tipo, cliente:clientes(nome))
`

// ── Catálogo de tipos ──────────────────────────────────────────
export async function listarCustoTipos(): Promise<{ data: CustoTipo[]; error: string | null }> {
  const { data, error } = await supabase
    .from('custo_tipos')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) return { data: [], error: 'Erro ao carregar tipos de custo.' }
  return { data: (data as CustoTipo[]) ?? [], error: null }
}

export async function criarCustoTipo(
  nome: string,
  userId: string,
): Promise<{ data: CustoTipo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('custo_tipos')
    .insert({ nome: nome.trim(), created_by: userId })
    .select()
    .single()
  if (error) return { data: null, error: 'Erro ao cadastrar tipo de custo.' }
  return { data: data as CustoTipo, error: null }
}

// Desativa em vez de apagar: os custos já lançados guardam o nome (tipo_nome) como snapshot
export async function desativarCustoTipo(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('custo_tipos')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? 'Erro ao remover tipo de custo.' : null }
}

// ── Helpers internos ───────────────────────────────────────────
async function nomeDoTipo(tipoId: string): Promise<string | null> {
  const { data } = await supabase.from('custo_tipos').select('nome').eq('id', tipoId).maybeSingle()
  return (data?.nome as string | undefined) ?? null
}

function referenciaTipo(input: CustoInput) {
  return input.venda_id ? REFERENCIA_CUSTO_VENDA : REFERENCIA_CUSTO_SERVICO
}

async function descricaoLancamento(input: CustoInput, tipoNome: string | null): Promise<string> {
  const rotulo = tipoNome ? `Custo adicional (${tipoNome})` : 'Custo adicional'
  if (input.venda_id) {
    const { data } = await supabase.from('vendas').select('numero').eq('id', input.venda_id).maybeSingle()
    return `${rotulo} - Venda #${data?.numero ?? '?'}`
  }
  if (input.servico_id) {
    const { data } = await supabase.from('servicos').select('numero').eq('id', input.servico_id).maybeSingle()
    return `${rotulo} - Serviço #${data?.numero ?? '?'}`
  }
  return rotulo
}

// ── CRUD ───────────────────────────────────────────────────────
export async function listarCustos(filtros: {
  dataInicio: string
  dataFim: string
}): Promise<{ data: VendaCustoComRelacoes[]; error: string | null }> {
  const { data, error } = await supabase
    .from('venda_custos')
    .select(SELECT_COM_RELACOES)
    .gte('data_custo', filtros.dataInicio)
    .lte('data_custo', filtros.dataFim)
    .order('data_custo', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return { data: [], error: 'Erro ao carregar custos adicionais.' }
  return { data: (data as VendaCustoComRelacoes[]) ?? [], error: null }
}

export async function listarCustosVenda(vendaId: string): Promise<{ data: VendaCusto[]; error: string | null }> {
  const { data, error } = await supabase
    .from('venda_custos')
    .select('*')
    .eq('venda_id', vendaId)
    .order('created_at')
  if (error) return { data: [], error: 'Erro ao carregar custos da venda.' }
  return { data: (data as VendaCusto[]) ?? [], error: null }
}

export async function criarCusto(input: CustoInput, userId: string): Promise<{ error: string | null }> {
  const tipoNome = await nomeDoTipo(input.tipo_id)
  const { data: custo, error } = await supabase
    .from('venda_custos')
    .insert({
      venda_id: input.venda_id,
      servico_id: input.servico_id,
      tipo_id: input.tipo_id,
      tipo_nome: tipoNome,
      descricao: input.descricao.trim() || null,
      valor: input.valor,
      data_custo: input.data_custo,
      created_by: userId,
    })
    .select('id')
    .single()
  if (error) return { error: 'Erro ao salvar custo adicional.' }

  const { error: lancError } = await supabase.from('lancamentos').insert({
    tipo: 'saida',
    descricao: await descricaoLancamento(input, tipoNome),
    valor: input.valor,
    data_lancamento: input.data_custo,
    categoria_nome: CATEGORIA_LANCAMENTO,
    observacoes: input.descricao.trim() || null,
    referencia_id: custo.id,
    referencia_tipo: referenciaTipo(input),
    created_by: userId,
  })
  if (lancError) return { error: 'Custo salvo, mas houve erro ao lançar a saída no caixa.' }
  return { error: null }
}

export async function atualizarCusto(
  id: string,
  input: CustoInput,
  userId: string,
): Promise<{ error: string | null }> {
  const tipoNome = await nomeDoTipo(input.tipo_id)
  const { error } = await supabase
    .from('venda_custos')
    .update({
      venda_id: input.venda_id,
      servico_id: input.servico_id,
      tipo_id: input.tipo_id,
      tipo_nome: tipoNome,
      descricao: input.descricao.trim() || null,
      valor: input.valor,
      data_custo: input.data_custo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: 'Erro ao atualizar custo adicional.' }

  const { error: lancError } = await supabase
    .from('lancamentos')
    .update({
      descricao: await descricaoLancamento(input, tipoNome),
      valor: input.valor,
      data_lancamento: input.data_custo,
      observacoes: input.descricao.trim() || null,
      referencia_tipo: referenciaTipo(input),
      updated_by: userId,
    })
    .in('referencia_tipo', REFERENCIAS_CUSTO)
    .eq('referencia_id', id)
  if (lancError) return { error: 'Custo atualizado, mas houve erro ao atualizar o lançamento no caixa.' }
  return { error: null }
}

export async function excluirCusto(id: string): Promise<{ error: string | null }> {
  const { error: lancError } = await supabase
    .from('lancamentos')
    .delete()
    .in('referencia_tipo', REFERENCIAS_CUSTO)
    .eq('referencia_id', id)
  if (lancError) return { error: 'Erro ao remover o lançamento do custo no caixa.' }

  const { error } = await supabase.from('venda_custos').delete().eq('id', id)
  return { error: error ? 'Erro ao excluir custo adicional.' : null }
}

// Remove todos os custos de uma venda (e seus lançamentos) — usado ao excluir a venda
export async function excluirCustosVenda(vendaId: string): Promise<{ error: string | null }> {
  const { data: custos, error } = await supabase.from('venda_custos').select('id').eq('venda_id', vendaId)
  if (error) return { error: 'Erro ao carregar custos da venda.' }
  for (const custo of custos ?? []) {
    const { error: delError } = await excluirCusto(custo.id as string)
    if (delError) return { error: delError }
  }
  return { error: null }
}

// Sincroniza a lista de custos editada no modal da venda com o banco:
// remove os que saíram da lista, atualiza os existentes e cria os novos.
// Custos vinculados a uma OS (servico_id) são preservados no update.
export async function sincronizarCustosVenda(
  vendaId: string,
  dataVenda: string,
  custos: CustoAdicionalFormData[],
  userId: string,
): Promise<{ error: string | null }> {
  const { data: atuais, error } = await listarCustosVenda(vendaId)
  if (error) return { error }

  const idsMantidos = new Set(custos.filter((c) => c.id).map((c) => c.id as string))
  for (const atual of atuais) {
    if (!idsMantidos.has(atual.id)) {
      const { error: delError } = await excluirCusto(atual.id)
      if (delError) return { error: delError }
    }
  }

  const atuaisMap = new Map(atuais.map((c) => [c.id, c]))
  for (const custo of custos) {
    const atual = custo.id ? atuaisMap.get(custo.id) : undefined
    const input: CustoInput = {
      venda_id: vendaId,
      servico_id: atual?.servico_id ?? null,
      tipo_id: custo.tipo_id,
      descricao: custo.descricao,
      valor: custo.valor,
      data_custo: atual?.data_custo ?? dataVenda,
    }
    const { error: saveError } = atual
      ? await atualizarCusto(atual.id, input, userId)
      : await criarCusto(input, userId)
    if (saveError) return { error: saveError }
  }

  return { error: null }
}
