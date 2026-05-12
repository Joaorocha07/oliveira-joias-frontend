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
