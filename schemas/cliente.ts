import { z } from 'zod'

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
