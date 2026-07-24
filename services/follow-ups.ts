import { differenceInHours, differenceInDays, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { formatDate, today } from '@/utils'
import type { FollowUpFormData } from '@/schemas/follow-up'
import type { ClienteFollowUp, StatusFunil } from '@/types'

const SELECT_COM_CLIENTE =
  '*, cliente:clientes(id, nome, telefone, produto_interesse, ultimo_contato_em, vendedor:profiles!clientes_vendedor_id_fkey(id, nome))'

const LIMIAR_SEM_RESPOSTA_HORAS = 24
const LIMIAR_ESQUECIDO_DIAS = 7
const LIMIAR_ORCAMENTO_SEM_RETORNO_DIAS = 3

async function registrarEventoTimeline(clienteId: string, descricao: string, userId: string) {
  await supabase.from('cliente_timeline').insert({
    cliente_id: clienteId,
    tipo: 'sistema',
    descricao,
    created_by: userId,
  })
}

function descreverAgendamento(data: FollowUpFormData): string {
  return `para ${formatDate(data.data_agendada)}${data.horario ? ` às ${data.horario}` : ''} — ${data.motivo}`
}

export async function listarFollowUps(vendedorId?: string): Promise<{ data: ClienteFollowUp[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cliente_followups')
    .select(SELECT_COM_CLIENTE)
    .eq('status', 'pendente')
    .order('data_agendada', { ascending: true })
    .order('horario', { ascending: true, nullsFirst: true })

  if (error) return { data: null, error: error.message }
  let rows = data as unknown as ClienteFollowUp[]
  // Vendedor vê os próprios follow-ups + os de leads ainda sem dono
  if (vendedorId) rows = rows.filter((f) => !f.cliente?.vendedor || f.cliente.vendedor.id === vendedorId)
  return { data: rows, error: null }
}

export async function criarFollowUp(
  clienteId: string,
  data: FollowUpFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cliente_followups').insert({
    cliente_id: clienteId,
    data_agendada: data.data_agendada,
    horario: data.horario || null,
    motivo: data.motivo,
    created_by: userId,
  })
  if (error) return { error: error.message }

  await registrarEventoTimeline(clienteId, `Follow-up agendado ${descreverAgendamento(data)}`, userId)
  return { error: null }
}

export async function reagendarFollowUp(
  followUp: ClienteFollowUp,
  data: FollowUpFormData,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cliente_followups')
    .update({ data_agendada: data.data_agendada, horario: data.horario || null, motivo: data.motivo })
    .eq('id', followUp.id)
  if (error) return { error: error.message }

  await registrarEventoTimeline(followUp.cliente_id, `Follow-up reagendado ${descreverAgendamento(data)}`, userId)
  return { error: null }
}

export async function concluirFollowUp(
  followUp: ClienteFollowUp,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cliente_followups').update({ status: 'concluido' }).eq('id', followUp.id)
  if (error) return { error: error.message }

  await registrarEventoTimeline(followUp.cliente_id, 'Follow-up concluído', userId)
  await supabase.from('clientes').update({ ultimo_contato_em: new Date().toISOString() }).eq('id', followUp.cliente_id)
  return { error: null }
}

export async function cancelarFollowUp(
  followUp: ClienteFollowUp,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cliente_followups').update({ status: 'cancelado' }).eq('id', followUp.id)
  if (error) return { error: error.message }

  await registrarEventoTimeline(followUp.cliente_id, 'Follow-up cancelado', userId)
  return { error: null }
}

// ── ALERTAS ──────────────────────────────────────────────────────
export interface AlertasFunil {
  semRespostaCount: number
  esquecidosCount: number
  orcamentoSemRetornoCount: number
  followUpsVencidosCount: number
}

export async function listarAlertas(vendedorId?: string): Promise<{ data: AlertasFunil | null; error: string | null }> {
  let clientesQuery = supabase
    .from('clientes')
    .select('id, status_funil, ultimo_contato_em')
    .eq('ativo', true)
    .not('status_funil', 'in', '(pos_venda,lead_perdido)')
  // Vendedor vê os próprios leads + os ainda sem dono
  if (vendedorId) clientesQuery = clientesQuery.or(`vendedor_id.eq.${vendedorId},vendedor_id.is.null`)

  const followUpsQuery = supabase
    .from('cliente_followups')
    .select('id, data_agendada, cliente:clientes(vendedor_id)')
    .eq('status', 'pendente')

  const [clientesRes, followUpsRes] = await Promise.all([clientesQuery, followUpsQuery])

  if (clientesRes.error) return { data: null, error: clientesRes.error.message }
  if (followUpsRes.error) return { data: null, error: followUpsRes.error.message }

  const agora = new Date()
  const rows = (clientesRes.data ?? []) as { id: string; status_funil: StatusFunil; ultimo_contato_em: string }[]
  const hojeStr = today()

  const semRespostaCount = rows.filter(
    (c) => differenceInHours(agora, parseISO(c.ultimo_contato_em)) >= LIMIAR_SEM_RESPOSTA_HORAS
  ).length
  const esquecidosCount = rows.filter(
    (c) => differenceInDays(agora, parseISO(c.ultimo_contato_em)) >= LIMIAR_ESQUECIDO_DIAS
  ).length
  const orcamentoSemRetornoCount = rows.filter(
    (c) => c.status_funil === 'orcamento'
      && differenceInDays(agora, parseISO(c.ultimo_contato_em)) >= LIMIAR_ORCAMENTO_SEM_RETORNO_DIAS
  ).length
  const followUpsRows = (followUpsRes.data ?? []) as unknown as { id: string; data_agendada: string; cliente: { vendedor_id: string | null } | null }[]
  const followUpsVencidosCount = followUpsRows
    .filter((f) => !vendedorId || !f.cliente?.vendedor_id || f.cliente.vendedor_id === vendedorId)
    .filter((f) => f.data_agendada < hojeStr).length

  return {
    data: { semRespostaCount, esquecidosCount, orcamentoSemRetornoCount, followUpsVencidosCount },
    error: null,
  }
}
