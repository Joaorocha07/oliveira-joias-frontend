import { z } from 'zod'

const tipos = ['entrada', 'saida', 'ajuste', 'devolucao'] as const

export const estoqueSchema = z.object({
  produto_id: z.string().min(1, 'Selecione um produto'),
  variacao_id: z.string().min(1, 'Selecione uma variação'),
  tipo: z.enum(tipos),
  quantidade: z.number().int().min(1, 'Mínimo 1'),
  motivo: z.string().min(1, 'Informe o motivo'),
})

export type EstoqueFormData = z.infer<typeof estoqueSchema>
