import { z } from 'zod'

export const ORCAMENTO_ITENS_PADRAO = [
  'Par de Alianças',
  'Anel Solitário de Brinde',
  'Gravação',
  'Caixinha de Veludo',
  'Certificado',
] as const

export const orcamentoSchema = z.object({
  cliente_nome: z.string().optional(),
  cliente_telefone: z.string().optional(),
  modelo_nome: z.string().min(1, 'Informe o modelo'),
  material: z.string().optional(),
  largura: z.string().optional(),
  itens_inclusos: z.array(z.string()),
  valor_vista: z.number().min(0.01, 'Valor inválido'),
  num_parcelas: z.number().int().min(1, 'Mínimo 1 parcela').max(60, 'Máximo 60 parcelas'),
  parcelas_sem_juros_ate: z.number().int().min(0, 'Não pode ser negativo').max(60, 'Máximo 60 parcelas'),
  prazo_fabricacao: z.string().optional(),
  observacoes: z.string().optional(),
})

export type OrcamentoFormData = z.infer<typeof orcamentoSchema>

export const orcamentoConfiguracaoSchema = z.object({
  nome_empresa: z.string().min(1, 'Nome da empresa é obrigatório'),
  contato: z.string().optional(),
  endereco: z.string().optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  texto_rodape: z.string().optional(),
  cor_principal: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
})

export type OrcamentoConfiguracaoFormData = z.infer<typeof orcamentoConfiguracaoSchema>
