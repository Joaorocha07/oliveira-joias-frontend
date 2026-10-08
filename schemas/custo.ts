import { z } from 'zod'

// Custo adicional lançado dentro do modal de venda (vinculado à própria venda)
export const custoAdicionalSchema = z.object({
  id: z.string().optional(),
  tipo_id: z.string().min(1, 'Selecione o tipo'),
  descricao: z.string(),
  valor: z.number().min(0.01, 'Informe o valor'),
})

// Custo cadastrado na aba "Custos adicionais" de Serviços — precisa de pelo menos um vínculo
export const custoAvulsoSchema = custoAdicionalSchema
  .extend({
    venda_id: z.string().nullable(),
    servico_id: z.string().nullable(),
    data_custo: z.string().min(1, 'Data obrigatória'),
  })
  .superRefine((data, ctx) => {
    if (!data.venda_id && !data.servico_id) {
      ctx.addIssue({
        path: ['venda_id'],
        message: 'Vincule a uma venda ou a um serviço',
        code: z.ZodIssueCode.custom,
      })
    }
  })

export type CustoAdicionalFormData = z.infer<typeof custoAdicionalSchema>
export type CustoAvulsoFormData = z.infer<typeof custoAvulsoSchema>
