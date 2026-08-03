import { z } from 'zod'
import type { Cliente } from '@/types'

const produtosInteresse = [
  'alianca_prata', 'alianca_ouro', 'alianca_moeda_antiga', 'alianca_aco', 'semijoias', 'outro',
] as const

const statusQualificacao = [
  'novo_lead', 'em_atendimento', 'fazendo_orcamento', 'interessado',
  'aguardando_resposta', 'follow_up_agendado', 'venda_concluida',
  'lead_perdido', 'nao_respondeu',
] as const

export const clienteLeadSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  cidade: z.string().nullable(),
  origem_id: z.string().nullable(),
  origem_outro: z.string().nullable(),
  produto_interesse: z.enum(produtosInteresse).nullable(),
  valor_pretendido: z.number().min(0).nullable(),
  data_casamento: z.string().nullable(),
  data_noivado: z.string().nullable(),
  quando_pretende_comprar: z.string().nullable(),
  modelo_desejado: z.string().nullable(),
  numeracao: z.string().nullable(),
  vendedor_id: z.string().nullable(),
  parceiro_nome: z.string().nullable(),
  parceiro_telefone: z.string().nullable(),
  status_qualificacao: z.enum(statusQualificacao),
  perguntou_pagamento: z.boolean(),
  solicitou_gravacao: z.boolean(),
  demonstrou_intencao: z.boolean(),
  observacoes: z.string().nullable(),
  data_inicio_conversa: z.string().nullable(),
})

export type ClienteLeadFormData = z.infer<typeof clienteLeadSchema>

export function clienteToLeadFormData(c: Cliente): ClienteLeadFormData {
  return {
    nome: c.nome,
    telefone: c.telefone,
    whatsapp: c.whatsapp,
    instagram: c.instagram,
    cidade: c.cidade,
    origem_id: c.origem_id,
    origem_outro: c.origem_outro,
    produto_interesse: c.produto_interesse,
    valor_pretendido: c.valor_pretendido,
    data_casamento: c.data_casamento,
    data_noivado: c.data_noivado,
    quando_pretende_comprar: c.quando_pretende_comprar,
    modelo_desejado: c.modelo_desejado,
    numeracao: c.numeracao,
    vendedor_id: c.vendedor_id,
    parceiro_nome: c.parceiro_nome,
    parceiro_telefone: c.parceiro_telefone,
    status_qualificacao: c.status_qualificacao,
    perguntou_pagamento: c.perguntou_pagamento,
    solicitou_gravacao: c.solicitou_gravacao,
    demonstrou_intencao: c.demonstrou_intencao,
    observacoes: c.observacoes,
    data_inicio_conversa: c.data_inicio_conversa,
  }
}
