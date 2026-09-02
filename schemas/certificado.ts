import { z } from 'zod'

export const certificadoSchema = z.object({
  cliente_nome: z.string().min(1, 'Informe o nome do cliente'),
  cliente_cpf: z.string().optional(),
  cliente_telefone: z.string().optional(),
  data_compra: z.string().optional(),
  modelo: z.string().min(1, 'Informe o modelo'),
  material: z.string().min(1, 'Informe o material'),
  largura: z.string().optional(),
  gramas: z.string().optional(),
  numeracao: z.string().optional(),
  pedido_os: z.string().optional(),
  valor: z.number().min(0).optional(),
  vendedor_nome: z.string().optional(),
  observacoes: z.string().optional(),
})

export type CertificadoFormData = z.infer<typeof certificadoSchema>

const linhas = z
  .string()
  .transform((v) => v.split('\n').map((l) => l.trim()).filter(Boolean))

export const certificadoConfiguracaoSchema = z.object({
  nome_empresa: z.string().min(1, 'Nome da empresa é obrigatório'),
  subtitulo: z.string().optional(),
  endereco: z.string().optional(),
  whatsapp: z.string().optional(),
  telefone_secundario: z.string().optional(),
  instagram: z.string().optional(),
  cor_principal: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
  texto_introducao: z.string().optional(),
  termos_garantia: linhas,
  beneficios: linhas,
  nao_cobre: linhas,
  recomendacoes: linhas,
  texto_declaracao: z.string().optional(),
  texto_agradecimento: z.string().optional(),
  texto_validade: z.string().optional(),
})

export type CertificadoConfiguracaoFormData = z.infer<typeof certificadoConfiguracaoSchema>
export type CertificadoConfiguracaoFormInput = z.input<typeof certificadoConfiguracaoSchema>
