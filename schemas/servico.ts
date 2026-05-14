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
  origem_id: z.string().nullable(),
  origem_outro: z.string().nullable(),
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
  // Crediário fields — only used when forma_pagamento === 'crediario'
  num_parcelas: z.number().min(1).optional(),
  entrada_crediario: z.number().min(0).optional(),
  dia_vencimento: z.number().min(1).max(28).optional(),
})

export type ServicoFormData = z.infer<typeof servicoSchema>
