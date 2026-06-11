import { z } from 'zod'

const formasPagamento = [
  'dinheiro', 'pix', 'cartao_debito', 'cartao_credito',
  'transferencia', 'cheque',
] as const

export const pagarParcelaSchema = z.object({
  valor_pago: z.number().min(0.01, 'Valor inválido'),
  data_pagamento: z.string().min(1, 'Data obrigatória'),
  forma_pagamento: z.enum(formasPagamento),
  observacoes: z.string(),
})

export type PagarParcelaFormData = z.infer<typeof pagarParcelaSchema>

export const editarCrediarioSchema = z.object({
  total: z.number().min(0.01, 'Total invalido'),
  entrada: z.number().min(0),
  num_parcelas: z.number().int().min(1, 'Mínimo 1').max(60, 'Máximo 60'),
  dia_vencimento: z.number().int().min(1, 'Mínimo 1').max(28, 'Máximo 28'),
}).refine((data) => data.entrada <= data.total, {
  path: ['entrada'],
  message: 'Entrada nao pode ser maior que o total',
})

export type EditarCrediarioFormData = z.infer<typeof editarCrediarioSchema>
