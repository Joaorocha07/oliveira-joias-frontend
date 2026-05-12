import { z } from 'zod'

const formasPagamento = [
  'dinheiro', 'pix', 'cartao_debito', 'cartao_credito',
  'crediario', 'transferencia', 'cheque', 'misto',
] as const

const servicoStatuses = [
  'orcamento', 'aguardando', 'em_andamento', 'concluido', 'entregue', 'cancelado',
] as const

export const servicoSchema = z.object({
  cliente_id: z.string().nullable(),
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  observacoes_internas: z.string(),
  valor: z.number().min(0.01, 'Valor inválido'),
  custo_estimado: z.number().min(0).nullable(),
  status: z.enum(servicoStatuses),
  data_entrada: z.string().min(1, 'Data de entrada obrigatória'),
  data_previsao: z.string().nullable(),
  forma_pagamento: z.enum(formasPagamento).nullable(),
  responsavel_id: z.string().nullable(),
  pago: z.boolean(),
})

export type ServicoFormData = z.infer<typeof servicoSchema>
