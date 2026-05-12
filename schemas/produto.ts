import { z } from 'zod'

const produtoCategorias = [
  'anel', 'colar', 'brinco', 'pulseira', 'alianca',
  'pingente', 'relogio', 'kit', 'outro',
] as const

export const variacaoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  valor: z.string().min(1, 'Valor é obrigatório'),
  estoque_atual: z.number().min(0),
  estoque_minimo: z.number().min(0),
  custo_adicional: z.number().min(0),
  ativo: z.boolean(),
})

export const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  codigo: z.string().min(1, 'Código é obrigatório'),
  descricao: z.string().nullable(),
  categoria: z.enum(produtoCategorias, { error: 'Categoria é obrigatória' }),
  material: z.string().nullable(),
  peso_g: z.number().nullable(),
  fornecedor_id: z.string().nullable(),
  custo: z.number().min(0),
  preco_venda: z.number().min(0.01, 'Preço de venda é obrigatório'),
  preco_minimo: z.number().nullable(),
  observacoes: z.string().nullable(),
  ativo: z.boolean(),
  is_kit: z.boolean(),
  variacoes: z.array(variacaoSchema).min(1, 'Adicione ao menos uma variação'),
})

export type VariacaoFormData = z.infer<typeof variacaoSchema>
export type ProdutoFormData = z.infer<typeof produtoSchema>
