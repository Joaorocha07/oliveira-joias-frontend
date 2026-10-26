import { endOfMonth, format, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { today } from '@/utils'
import type {
  FolhaDetalhe,
  FolhaFuncionario,
  FolhaFuncionarioUpdate,
  FolhaItem,
  FolhaItemInsert,
  FolhaPagamento,
  FolhaResumoMensal,
  FolhaVale,
  FolhaValeInsert,
  FuncionarioFolha,
} from '@/types'

// Folha de pagamento de controle interno: salário base + comissão automática
// sobre as vendas do mês + itens manuais (bônus, descontos) − vales. Sem
// cálculo de INSS/IRRF/FGTS. Todas as tabelas `folha_*` têm RLS só para admin.
//
// Fluxo de caixa: o vale sai do caixa no dia em que é dado ('folha_vale'); ao
// pagar a folha sai só o líquido ('folha_pagamento'), que já desconta os vales.

const CATEGORIA_FOLHA = 'Folha de pagamento'
const CATEGORIA_VALE = 'Vale / Adiantamento'

// Vendas que não geram comissão.
const STATUS_SEM_COMISSAO = '(cancelado,orcamento)'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function fimDoMes(mes: string): string {
  return format(endOfMonth(parseISO(mes)), 'yyyy-MM-dd')
}

export function mesLabel(mes: string): string {
  return format(parseISO(mes), 'MM/yyyy')
}

// ── Funcionários ───────────────────────────────────────────────

export async function listarFuncionariosFolha(): Promise<{ data: FuncionarioFolha[]; error: string | null }> {
  const [profilesRes, folhaRes] = await Promise.all([
    supabase.from('profiles').select('id, nome, cpf, role, ativo, comissao_percentual').order('nome'),
    supabase.from('folha_funcionarios').select('*'),
  ])
  if (profilesRes.error) return { data: [], error: profilesRes.error.message }
  if (folhaRes.error) return { data: [], error: folhaRes.error.message }

  const porProfile = new Map((folhaRes.data as FolhaFuncionario[]).map((f) => [f.profile_id, f]))
  return {
    data: (profilesRes.data as FuncionarioFolha['profile'][]).map((profile) => ({
      profile,
      folha: porProfile.get(profile.id) ?? null,
    })),
    error: null,
  }
}

/**
 * Salva os dados de folha e, se informado, o % de comissão — que fica em
 * `profiles.comissao_percentual` (o mesmo campo editado em /vendedores e usado no CRM).
 */
export async function salvarFuncionarioFolha(
  profileId: string,
  dados: FolhaFuncionarioUpdate,
  comissaoPercentual?: number,
): Promise<{ error: string | null }> {
  if (comissaoPercentual !== undefined) {
    const { error } = await supabase
      .from('profiles')
      .update({ comissao_percentual: comissaoPercentual, updated_at: new Date().toISOString() })
      .eq('id', profileId)
    if (error) return { error: error.message }
  }
  const { error } = await supabase
    .from('folha_funcionarios')
    .upsert({ profile_id: profileId, ...dados, updated_at: new Date().toISOString() })
  if (error) return { error: error.message }
  return { error: null }
}

// ── Folha do mês ───────────────────────────────────────────────

export async function listarFolhasMes(mes: string): Promise<{ data: FolhaPagamento[]; error: string | null }> {
  const { data, error } = await supabase
    .from('folha_pagamentos')
    .select('*')
    .eq('mes', mes)
    .order('funcionario_nome')
  if (error) return { data: [], error: error.message }
  return { data: data as FolhaPagamento[], error: null }
}

export async function listarHistoricoFuncionario(
  funcionarioId: string,
): Promise<{ data: FolhaPagamento[]; error: string | null }> {
  const { data, error } = await supabase
    .from('folha_pagamentos')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('mes', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: data as FolhaPagamento[], error: null }
}

/**
 * Cria a folha do mês para todo funcionário ativo na folha que ainda não tem
 * uma, e recalcula as que estão abertas. Folhas pagas não são tocadas.
 */
export async function gerarFolhaMes(
  mes: string,
  userId: string,
): Promise<{ criadas: number; error: string | null }> {
  const [funcRes, existentesRes] = await Promise.all([listarFuncionariosFolha(), listarFolhasMes(mes)])
  if (funcRes.error) return { criadas: 0, error: funcRes.error }
  if (existentesRes.error) return { criadas: 0, error: existentesRes.error }

  const jaTem = new Set(existentesRes.data.map((f) => f.funcionario_id))
  const novos = funcRes.data.filter((f) => f.profile.ativo && f.folha?.ativo && !jaTem.has(f.profile.id))

  if (novos.length > 0) {
    const { error } = await supabase.from('folha_pagamentos').insert(
      novos.map((f) => ({
        mes,
        funcionario_id: f.profile.id,
        funcionario_nome: f.profile.nome,
        cargo: f.folha?.cargo ?? null,
        salario_base: f.folha?.salario_base ?? 0,
        comissao_percentual: f.profile.comissao_percentual ?? 0,
        status: 'aberta',
        created_by: userId,
      })),
    )
    if (error) return { criadas: 0, error: error.message }
  }

  const { data: abertas, error: abertasError } = await supabase
    .from('folha_pagamentos')
    .select('id')
    .eq('mes', mes)
    .eq('status', 'aberta')
  if (abertasError) return { criadas: novos.length, error: abertasError.message }

  for (const { id } of abertas as { id: string }[]) {
    const { error } = await recalcularFolha(id)
    if (error) return { criadas: novos.length, error }
  }
  return { criadas: novos.length, error: null }
}

async function calcularBaseComissao(funcionarioId: string, mes: string): Promise<{ total: number; error: string | null }> {
  const { data, error } = await supabase
    .from('vendas')
    .select('total')
    .eq('vendedor_id', funcionarioId)
    .not('status', 'in', STATUS_SEM_COMISSAO)
    .gte('data_venda', mes)
    .lte('data_venda', fimDoMes(mes))
  if (error) return { total: 0, error: error.message }
  return { total: (data as { total: number }[]).reduce((s, v) => s + Number(v.total), 0), error: null }
}

export async function buscarFolhaDetalhe(folhaId: string): Promise<{ data: FolhaDetalhe | null; error: string | null }> {
  const [folhaRes, itensRes, valesRes] = await Promise.all([
    supabase.from('folha_pagamentos').select('*').eq('id', folhaId).single(),
    supabase.from('folha_itens').select('*').eq('folha_id', folhaId).order('created_at'),
    supabase.from('folha_vales').select('*').eq('folha_id', folhaId).order('data_vale'),
  ])
  if (folhaRes.error) return { data: null, error: folhaRes.error.message }
  if (itensRes.error) return { data: null, error: itensRes.error.message }
  if (valesRes.error) return { data: null, error: valesRes.error.message }
  return {
    data: {
      folha: folhaRes.data as FolhaPagamento,
      itens: itensRes.data as FolhaItem[],
      vales: valesRes.data as FolhaVale[],
    },
    error: null,
  }
}

/**
 * Atualiza uma folha aberta com os dados atuais: salário/cargo/% de comissão
 * do cadastro, comissão sobre as vendas do mês, vales ainda não descontados
 * (até o fim do mês) e itens manuais.
 */
export async function recalcularFolha(folhaId: string): Promise<{ data: FolhaDetalhe | null; error: string | null }> {
  const { data: folha, error: folhaError } = await supabase
    .from('folha_pagamentos')
    .select('*')
    .eq('id', folhaId)
    .single()
  if (folhaError) return { data: null, error: folhaError.message }
  const atual = folha as FolhaPagamento
  if (atual.status === 'paga') return buscarFolhaDetalhe(folhaId)

  const fim = fimDoMes(atual.mes)
  const [profileRes, cadastroRes, vinculaRes] = await Promise.all([
    supabase.from('profiles').select('nome, comissao_percentual').eq('id', atual.funcionario_id).single(),
    supabase.from('folha_funcionarios').select('cargo, salario_base').eq('profile_id', atual.funcionario_id).maybeSingle(),
    supabase
      .from('folha_vales')
      .update({ folha_id: folhaId, updated_at: new Date().toISOString() })
      .eq('funcionario_id', atual.funcionario_id)
      .is('folha_id', null)
      .lte('data_vale', fim),
  ])
  if (profileRes.error) return { data: null, error: profileRes.error.message }
  if (cadastroRes.error) return { data: null, error: cadastroRes.error.message }
  if (vinculaRes.error) return { data: null, error: vinculaRes.error.message }

  const comissaoPercentual = Number(profileRes.data.comissao_percentual ?? 0)
  const salarioBase = Number(cadastroRes.data?.salario_base ?? atual.salario_base)

  const { total: baseComissao, error: comissaoError } = await calcularBaseComissao(atual.funcionario_id, atual.mes)
  if (comissaoError) return { data: null, error: comissaoError }

  const detalhe = await buscarFolhaDetalhe(folhaId)
  if (detalhe.error || !detalhe.data) return detalhe
  const { itens, vales } = detalhe.data

  const valorComissao = round2(baseComissao * (comissaoPercentual / 100))
  const extras = itens.filter((i) => i.tipo === 'provento').reduce((s, i) => s + Number(i.valor), 0)
  const descontosManuais = itens.filter((i) => i.tipo === 'desconto').reduce((s, i) => s + Number(i.valor), 0)
  const totalVales = vales.reduce((s, v) => s + Number(v.valor), 0)
  const totalProventos = round2(salarioBase + valorComissao + extras)
  const totalDescontos = round2(descontosManuais + totalVales)

  const { data: atualizada, error: updateError } = await supabase
    .from('folha_pagamentos')
    .update({
      funcionario_nome: profileRes.data.nome,
      cargo: cadastroRes.data?.cargo ?? atual.cargo,
      salario_base: salarioBase,
      comissao_percentual: comissaoPercentual,
      base_comissao: round2(baseComissao),
      valor_comissao: valorComissao,
      total_proventos: totalProventos,
      total_descontos: totalDescontos,
      valor_liquido: round2(totalProventos - totalDescontos),
      updated_at: new Date().toISOString(),
    })
    .eq('id', folhaId)
    .select()
    .single()
  if (updateError) return { data: null, error: updateError.message }

  return { data: { folha: atualizada as FolhaPagamento, itens, vales }, error: null }
}

export async function adicionarItemFolha(
  item: FolhaItemInsert,
  userId: string,
): Promise<{ data: FolhaDetalhe | null; error: string | null }> {
  const { error } = await supabase.from('folha_itens').insert({ ...item, created_by: userId })
  if (error) return { data: null, error: error.message }
  return recalcularFolha(item.folha_id)
}

export async function removerItemFolha(item: FolhaItem): Promise<{ data: FolhaDetalhe | null; error: string | null }> {
  const { error } = await supabase.from('folha_itens').delete().eq('id', item.id)
  if (error) return { data: null, error: error.message }
  return recalcularFolha(item.folha_id)
}

export async function atualizarObservacoesFolha(folhaId: string, observacoes: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('folha_pagamentos')
    .update({ observacoes, updated_at: new Date().toISOString() })
    .eq('id', folhaId)
  if (error) return { error: error.message }
  return { error: null }
}

/** Recalcula, lança a saída do líquido no caixa e marca a folha como paga. */
export async function pagarFolha(
  folhaId: string,
  formaPagamento: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { data: detalhe, error: recalcError } = await recalcularFolha(folhaId)
  if (recalcError || !detalhe) return { error: recalcError ?? 'Folha não encontrada.' }
  const { folha } = detalhe
  if (folha.status === 'paga') return { error: 'Esta folha já foi paga.' }

  let lancamentoId: string | null = null
  if (folha.valor_liquido > 0) {
    const { data: lancamento, error: lancError } = await supabase
      .from('lancamentos')
      .insert({
        tipo: 'saida',
        descricao: `Folha ${mesLabel(folha.mes)} — ${folha.funcionario_nome}`,
        valor: folha.valor_liquido,
        data_lancamento: today(),
        categoria_id: null,
        categoria_nome: CATEGORIA_FOLHA,
        forma_pagamento: formaPagamento,
        referencia_id: folha.id,
        referencia_tipo: 'folha_pagamento',
        observacoes: null,
        created_by: userId,
        updated_by: null,
      })
      .select('id')
      .single()
    if (lancError) return { error: lancError.message }
    lancamentoId = lancamento.id as string
  }

  const { error } = await supabase
    .from('folha_pagamentos')
    .update({
      status: 'paga',
      data_pagamento: today(),
      forma_pagamento: formaPagamento,
      lancamento_id: lancamentoId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', folha.id)
  if (error) {
    if (lancamentoId) await supabase.from('lancamentos').delete().eq('id', lancamentoId)
    return { error: error.message }
  }
  return { error: null }
}

/** Desfaz o pagamento: remove a saída do caixa e reabre a folha. */
export async function estornarPagamentoFolha(folha: FolhaPagamento): Promise<{ error: string | null }> {
  if (folha.lancamento_id) {
    const { error } = await supabase.from('lancamentos').delete().eq('id', folha.lancamento_id)
    if (error) return { error: error.message }
  }
  const { error } = await supabase
    .from('folha_pagamentos')
    .update({
      status: 'aberta',
      data_pagamento: null,
      forma_pagamento: null,
      lancamento_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', folha.id)
  if (error) return { error: error.message }
  return { error: null }
}

/** Exclui uma folha aberta; os vales dela voltam a ficar pendentes de desconto. */
export async function excluirFolha(folha: FolhaPagamento): Promise<{ error: string | null }> {
  if (folha.status === 'paga') return { error: 'Estorne o pagamento antes de excluir a folha.' }
  const { error: valesError } = await supabase.from('folha_vales').update({ folha_id: null }).eq('folha_id', folha.id)
  if (valesError) return { error: valesError.message }
  const { error } = await supabase.from('folha_pagamentos').delete().eq('id', folha.id)
  if (error) return { error: error.message }
  return { error: null }
}

// ── Vales / adiantamentos ──────────────────────────────────────

export async function listarVales(
  inicio: string,
  fim: string,
): Promise<{ data: FolhaVale[]; error: string | null }> {
  const { data, error } = await supabase
    .from('folha_vales')
    .select('*')
    .gte('data_vale', inicio)
    .lte('data_vale', fim)
    .order('data_vale', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: data as FolhaVale[], error: null }
}

/** Status das folhas que contêm os vales, para saber quais já foram descontados de fato. */
export async function statusFolhasDosVales(vales: FolhaVale[]): Promise<Record<string, FolhaPagamento['status']>> {
  const ids = [...new Set(vales.map((v) => v.folha_id).filter((id): id is string => !!id))]
  if (ids.length === 0) return {}
  const { data } = await supabase.from('folha_pagamentos').select('id, status').in('id', ids)
  return Object.fromEntries(((data ?? []) as { id: string; status: FolhaPagamento['status'] }[]).map((f) => [f.id, f.status]))
}

export async function criarVale(
  dados: FolhaValeInsert,
  funcionarioNome: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { data: lancamento, error: lancError } = await supabase
    .from('lancamentos')
    .insert({
      tipo: 'saida',
      descricao: `Vale — ${funcionarioNome}`,
      valor: dados.valor,
      data_lancamento: dados.data_vale,
      categoria_id: null,
      categoria_nome: CATEGORIA_VALE,
      forma_pagamento: dados.forma_pagamento,
      referencia_id: null,
      referencia_tipo: 'folha_vale',
      observacoes: dados.descricao,
      created_by: userId,
      updated_by: null,
    })
    .select('id')
    .single()
  if (lancError) return { error: lancError.message }

  const { data: vale, error } = await supabase
    .from('folha_vales')
    .insert({ ...dados, lancamento_id: lancamento.id, created_by: userId })
    .select('id')
    .single()
  if (error) {
    await supabase.from('lancamentos').delete().eq('id', lancamento.id)
    return { error: error.message }
  }
  await supabase.from('lancamentos').update({ referencia_id: vale.id }).eq('id', lancamento.id)

  // Se a folha do mês do vale já existe e está aberta, já entra nela.
  const mes = `${dados.data_vale.slice(0, 7)}-01`
  const { data: folhaAberta } = await supabase
    .from('folha_pagamentos')
    .select('id')
    .eq('funcionario_id', dados.funcionario_id)
    .eq('mes', mes)
    .eq('status', 'aberta')
    .maybeSingle()
  if (folhaAberta) {
    const { error: recalcError } = await recalcularFolha(folhaAberta.id as string)
    if (recalcError) return { error: recalcError }
  }
  return { error: null }
}

export async function excluirVale(vale: FolhaVale): Promise<{ error: string | null }> {
  if (vale.folha_id) {
    const { data: folha } = await supabase.from('folha_pagamentos').select('status').eq('id', vale.folha_id).maybeSingle()
    if (folha?.status === 'paga') {
      return { error: 'Este vale já foi descontado numa folha paga. Estorne o pagamento da folha antes.' }
    }
  }

  const { error } = await supabase.from('folha_vales').delete().eq('id', vale.id)
  if (error) return { error: error.message }
  if (vale.lancamento_id) await supabase.from('lancamentos').delete().eq('id', vale.lancamento_id)
  if (vale.folha_id) {
    const { error: recalcError } = await recalcularFolha(vale.folha_id)
    if (recalcError) return { error: recalcError }
  }
  return { error: null }
}

// ── Relatório ──────────────────────────────────────────────────

export async function resumoFolhaPorMes(
  mesInicio: string,
  mesFim: string,
): Promise<{ data: FolhaResumoMensal[]; error: string | null }> {
  const { data, error } = await supabase
    .from('folha_pagamentos')
    .select('mes, status, salario_base, valor_comissao, total_proventos, total_descontos, valor_liquido')
    .gte('mes', mesInicio)
    .lte('mes', mesFim)
    .order('mes')
  if (error) return { data: [], error: error.message }

  const porMes = new Map<string, FolhaResumoMensal>()
  for (const f of data as Pick<FolhaPagamento, 'mes' | 'status' | 'salario_base' | 'valor_comissao' | 'total_proventos' | 'total_descontos' | 'valor_liquido'>[]) {
    const r = porMes.get(f.mes) ?? {
      mes: f.mes, funcionarios: 0, salarios: 0, comissoes: 0, outrosProventos: 0, descontos: 0, liquido: 0, pago: 0,
    }
    const salario = Number(f.salario_base)
    const comissao = Number(f.valor_comissao)
    r.funcionarios += 1
    r.salarios += salario
    r.comissoes += comissao
    r.outrosProventos += Number(f.total_proventos) - salario - comissao
    r.descontos += Number(f.total_descontos)
    r.liquido += Number(f.valor_liquido)
    if (f.status === 'paga') r.pago += Number(f.valor_liquido)
    porMes.set(f.mes, r)
  }
  return { data: [...porMes.values()].map((r) => ({ ...r, outrosProventos: round2(r.outrosProventos) })), error: null }
}
