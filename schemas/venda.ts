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
    tipo: z.enum(['normal', 'livre'] as const),
    cliente_id: z.string().nullable(),
    vendedor_id: z.string().nullable(),
    origem_id: z.string().nullable(),
    origem_outro: z.string().nullable(),
    data_venda: z.string().min(1, 'Data obrigatória'),
    forma_pagamento: z.enum(formasPagamento),
    desconto: z.number().min(0),
    observacoes: z.string(),
    // Venda normal
    itens: z.array(itemSchema),
    // Venda livre
    descricao_livre: z.string(),
    valor_livre: z.number().min(0),
    custo_livre: z.number().min(0),
    // Crediário
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
    if (data.tipo === 'normal' && data.itens.length === 0) {
      ctx.addIssue({
        path: ['itens'],
        message: 'Adicione pelo menos 1 item',
        code: z.ZodIssueCode.custom,
      })
    }
    if (data.tipo === 'livre') {
      if (!data.descricao_livre.trim()) {
        ctx.addIssue({
          path: ['descricao_livre'],
          message: 'Descrição obrigatória',
          code: z.ZodIssueCode.custom,
        })
      }
      if (data.valor_livre <= 0) {
        ctx.addIssue({
          path: ['valor_livre'],
          message: 'Valor da venda obrigatório',
          code: z.ZodIssueCode.custom,
        })
      }
    }
  })

export type VendaFormData = z.infer<typeof vendaSchema>
export type VendaItemFormData = z.infer<typeof itemSchema>
