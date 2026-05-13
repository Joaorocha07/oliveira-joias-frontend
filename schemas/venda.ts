import { z } from 'zod'

const formasPagamento = [
  'dinheiro', 'pix', 'cartao_debito', 'cartao_credito',
  'crediario', 'transferencia', 'cheque', 'misto',
] as const

const itemSchema = z.object({
  produto_id: z.string().min(1, 'Selecione um produto'),
  variacao_id: z.string().nullable(),
  nome_produto: z.string(),
  quantidade: z.number().int().min(1, 'Mínimo 1'),
  preco_unitario: z.number().min(0.01, 'Preço inválido'),
  custo_unitario: z.number().min(0),
  desconto: z.number().min(0),
})

export const vendaSchema = z
  .object({
    cliente_id: z.string().nullable(),
    vendedor_id: z.string().nullable(),
    origem_id: z.string().nullable(),
    origem_outro: z.string().nullable(),
    data_venda: z.string().min(1, 'Data obrigatória'),
    forma_pagamento: z.enum(formasPagamento),
    desconto: z.number().min(0),
    observacoes: z.string(),
    itens: z.array(itemSchema).min(1, 'Adicione pelo menos 1 item'),
    num_parcelas: z.number().int().min(1).max(60),
    entrada: z.number().min(0),
    dia_vencimento: z.number().int().min(1).max(28),
  })
  .superRefine((data, ctx) => {
    if (data.forma_pagamento === 'crediario' && !data.cliente_id) {
      ctx.addIssue({
        path: ['cliente_id'],
        message: 'Cliente obrigatório para venda no crediário',
        code: z.ZodIssueCode.custom,
      })
    }
  })

export type VendaFormData = z.infer<typeof vendaSchema>
export type VendaItemFormData = z.infer<typeof itemSchema>
