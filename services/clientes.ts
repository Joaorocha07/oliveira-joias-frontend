import { supabase } from '@/lib/supabase'
import { calcularLeadScore, STATUS_QUALIFICACAO_LABEL } from '@/utils'
import type { ClienteLeadFormData } from '@/schemas/cliente'
import type { Cliente, ClienteTimelineEvento, StatusFunil, StatusQualificacao } from '@/types'

async function registrarContato(clienteId: string) {
  await supabase.from('clientes').update({ ultimo_contato_em: new Date().toISOString() }).eq('id', clienteId)
}

function buildLeadPayload(data: ClienteLeadFormData) {
  return {
    nome: data.nome,
    telefone: data.telefone || null,
    whatsapp: data.whatsapp || null,
    instagram: data.instagram || null,
    cidade: data.cidade || null,
    origem_id: data.origem_id || null,
    origem_outro: data.origem_outro || null,
    produto_interesse: data.produto_interesse || null,
    valor_pretendido: data.valor_pretendido ?? null,
    data_casamento: data.data_casamento || null,
    data_noivado: data.data_noivado || null,
    quando_pretende_comprar: data.quando_pretende_comprar || null,
    modelo_desejado: data.modelo_desejado || null,
    numeracao: data.numeracao || null,
    vendedor_id: data.vendedor_id || null,
    parceiro_nome: data.parceiro_nome || null,
    parceiro_telefone: data.parceiro_telefone || null,
    status_qualificacao: data.status_qualificacao,
    perguntou_pagamento: data.perguntou_pagamento,
    solicitou_gravacao: data.solicitou_gravacao,
    demonstrou_intencao: data.demonstrou_intencao,
    observacoes: data.observacoes || null,
    lead_score: calcularLeadScore(data),
    data_inicio_conversa: data.data_inicio_conversa || null,
  }
}

export async function deleteLead(id: string): Promise<{ error: string | null }> {
  // Remove registros CRM sem dependências
  await supabase.from('cliente_arquivos').delete().eq('cliente_id', id)
  await supabase.from('cliente_timeline').delete().eq('cliente_id', id)
  await supabase.from('cliente_followups').delete().eq('cliente_id', id)

  // Crediário: parcelas → crediário (crediário referencia vendas, então vem antes)
  const { data: crediarios } = await supabase.from('crediario').select('id').eq('cliente_id', id)
  if (crediarios?.length) {
    await supabase.from('crediario_parcelas').delete().in('crediario_id', crediarios.map((c) => c.id))
  }
  await supabase.from('crediario').delete().eq('cliente_id', id)

  // Vendas: itens → vendas
  const { data: vendas } = await supabase.from('vendas').select('id').eq('cliente_id', id)
  if (vendas?.length) {
    await supabase.from('venda_itens').delete().in('venda_id', vendas.map((v) => v.id))
  }
  await supabase.from('vendas').delete().eq('cliente_id', id)

  // Serviços
  await supabase.from('servicos').delete().eq('cliente_id', id)

  // Remove o cliente
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function listarLeadsFunil(vendedorId?: string): Promise<{ data: Cliente[] | null; error: string | null }> {
  let query = supabase
    .from('clientes')
    .select('*, origem:origens_cliente(id, nome), vendedor:profiles!clientes_vendedor_id_fkey(id, nome)')
    .eq('ativo', true)
    .order('created_at', { ascending: false })

  // Vendedor vê os próprios leads + os ainda sem dono (não atribuídos a ninguém)
  if (vendedorId) query = query.or(`vendedor_id.eq.${vendedorId},vendedor_id.is.null`)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data: data as Cliente[], error: null }
}

export async function createLead(
  data: ClienteLeadFormData,
  userId: string,
): Promise<{ data: Cliente | null; error: string | null }> {
  const { data: lead, error } = await supabase
    .from('clientes')
    .insert({ ...buildLeadPayload(data), status_funil: 'novo_lead', created_by: userId })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  await supabase.from('cliente_timeline').insert({
    cliente_id: lead.id,
    tipo: 'sistema',
    descricao: 'Lead criado',
    created_by: userId,
  })

  return { data: lead as Cliente, error: null }
}

export async function vincularClienteExistenteAoFunil(
  clienteId: string,
  data: ClienteLeadFormData,
  userId: string,
): Promise<{ data: Cliente | null; error: string | null }> {
  const { data: lead, error } = await supabase
    .from('clientes')
    .update({ ...buildLeadPayload(data), status_funil: 'novo_lead' })
    .eq('id', clienteId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  await supabase.from('cliente_timeline').insert({
    cliente_id: clienteId,
    tipo: 'sistema',
    descricao: 'Cliente adicionado ao funil de vendas',
    created_by: userId,
  })

  return { data: lead as Cliente, error: null }
}

export async function updateLead(
  id: string,
  data: ClienteLeadFormData,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('clientes')
    .update(buildLeadPayload(data))
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function updateStatusFunil(
  id: string,
  novoStatus: StatusFunil,
  statusAnterior: StatusFunil,
  userId: string,
  motivoPerda?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('clientes')
    .update({
      status_funil: novoStatus,
      ...(novoStatus === 'lead_perdido' ? { motivo_perda: motivoPerda || null } : {}),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('cliente_timeline').insert({
    cliente_id: id,
    tipo: 'status',
    descricao: motivoPerda
      ? `Movido para "Lead Perdido" — ${motivoPerda}`
      : `Movido de estágio no funil`,
    status_anterior: statusAnterior,
    status_novo: novoStatus,
    created_by: userId,
  })
  await registrarContato(id)

  return { error: null }
}

export async function updateStatusQualificacao(
  id: string,
  novoStatus: StatusQualificacao,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('clientes')
    .update({ status_qualificacao: novoStatus })
    .eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('cliente_timeline').insert({
    cliente_id: id,
    tipo: 'sistema',
    descricao: `Status de atendimento alterado para "${STATUS_QUALIFICACAO_LABEL[novoStatus]}"`,
    created_by: userId,
  })
  await registrarContato(id)

  return { error: null }
}

export async function criarNotaTimeline(
  clienteId: string,
  descricao: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cliente_timeline').insert({
    cliente_id: clienteId,
    tipo: 'nota',
    descricao,
    created_by: userId,
  })
  if (error) return { error: error.message }
  await registrarContato(clienteId)
  return { error: null }
}

export async function listarTimeline(
  clienteId: string,
): Promise<{ data: ClienteTimelineEvento[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cliente_timeline')
    .select('*, autor:profiles(nome)')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as ClienteTimelineEvento[], error: null }
}
