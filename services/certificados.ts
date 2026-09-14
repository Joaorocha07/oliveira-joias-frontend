import { supabase } from '@/lib/supabase'
import type { CertificadoFormData, CertificadoConfiguracaoFormData } from '@/schemas/certificado'
import type {
  Certificado,
  CertificadoModelo,
  CertificadoMaterial,
  CertificadoConfiguracao,
} from '@/types'

const CERTIFICADO_CONFIG_ID = '00000000-0000-0000-0000-000000000001'

const CONFIG_PADRAO: CertificadoConfiguracao = {
  id: CERTIFICADO_CONFIG_ID,
  nome_empresa: 'Oliveira Joias',
  subtitulo: 'Especializada em Alianças e Joias',
  endereco: null,
  whatsapp: null,
  telefone_secundario: null,
  instagram: null,
  cor_principal: '#C9A227',
  texto_introducao: null,
  termos_garantia: [],
  beneficios: [],
  nao_cobre: [],
  recomendacoes: [],
  texto_declaracao: null,
  texto_agradecimento: null,
  texto_validade: null,
  created_at: '',
  updated_at: '',
}

function buildPayload(data: CertificadoFormData) {
  return {
    cliente_nome: data.cliente_nome || null,
    cliente_cpf: data.cliente_cpf || null,
    cliente_telefone: data.cliente_telefone || null,
    data_compra: data.data_compra || null,
    modelo: data.modelo || null,
    material: data.material || null,
    largura: data.largura || null,
    gramas: data.gramas || null,
    numeracao: data.numeracao || null,
    pedido_os: data.pedido_os || null,
    valor: data.valor ?? null,
    vendedor_nome: data.vendedor_nome || null,
    observacoes: data.observacoes || null,
  }
}

async function proximoNumero(): Promise<string> {
  const ano = new Date().getFullYear()
  const prefixo = `GAR-${ano}-`
  const { count } = await supabase
    .from('certificados')
    .select('id', { count: 'exact', head: true })
    .like('numero', `${prefixo}%`)
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `${prefixo}${seq}`
}

type CertificadoExtras = { cliente_id: string | null; vendedor_id: string | null; venda_id: string | null }

export async function criarCertificado(
  data: CertificadoFormData,
  extras: CertificadoExtras,
  userId: string,
): Promise<{ data: Certificado | null; error: string | null }> {
  const numero = await proximoNumero()
  const { data: result, error } = await supabase
    .from('certificados')
    .insert({
      ...buildPayload(data),
      numero,
      cliente_id: extras.cliente_id,
      vendedor_id: extras.vendedor_id,
      venda_id: extras.venda_id,
      created_by: userId,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: result as Certificado, error: null }
}

export async function atualizarCertificado(
  id: string,
  data: CertificadoFormData,
  extras: CertificadoExtras,
): Promise<{ data: Certificado | null; error: string | null }> {
  const { data: result, error } = await supabase
    .from('certificados')
    .update({
      ...buildPayload(data),
      cliente_id: extras.cliente_id,
      vendedor_id: extras.vendedor_id,
      venda_id: extras.venda_id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: result as Certificado, error: null }
}

export async function listarCertificados(
  dataInicio: string,
  dataFim: string,
): Promise<{ data: Certificado[]; error: string | null }> {
  const { data, error } = await supabase
    .from('certificados')
    .select('*')
    .gte('created_at', `${dataInicio}T00:00:00`)
    .lte('created_at', `${dataFim}T23:59:59`)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data as Certificado[]) ?? [], error: null }
}

export async function excluirCertificado(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('certificados').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Catálogos ──────────────────────────────────────────────────
export async function listarCertificadoModelos(): Promise<{ data: CertificadoModelo[]; error: string | null }> {
  const { data, error } = await supabase
    .from('certificado_modelos')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) return { data: [], error: error.message }
  return { data: (data as CertificadoModelo[]) ?? [], error: null }
}

export async function criarCertificadoModelo(
  nome: string,
  userId: string,
): Promise<{ data: CertificadoModelo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('certificado_modelos')
    .insert({ nome, created_by: userId })
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as CertificadoModelo, error: null }
}

export async function excluirCertificadoModelo(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('certificado_modelos').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function listarCertificadoMateriais(): Promise<{ data: CertificadoMaterial[]; error: string | null }> {
  const { data, error } = await supabase
    .from('certificado_materiais')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) return { data: [], error: error.message }
  return { data: (data as CertificadoMaterial[]) ?? [], error: null }
}

export async function criarCertificadoMaterial(
  nome: string,
  userId: string,
): Promise<{ data: CertificadoMaterial | null; error: string | null }> {
  const { data, error } = await supabase
    .from('certificado_materiais')
    .insert({ nome, created_by: userId })
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as CertificadoMaterial, error: null }
}

export async function excluirCertificadoMaterial(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('certificado_materiais').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Configuração ───────────────────────────────────────────────
export async function getCertificadoConfiguracoes(): Promise<{ data: CertificadoConfiguracao; error: string | null }> {
  const { data, error } = await supabase
    .from('certificado_configuracoes')
    .select('*')
    .eq('id', CERTIFICADO_CONFIG_ID)
    .maybeSingle()

  if (error) return { data: CONFIG_PADRAO, error: error.message }
  return { data: (data as CertificadoConfiguracao) ?? CONFIG_PADRAO, error: null }
}

export async function upsertCertificadoConfiguracoes(
  data: CertificadoConfiguracaoFormData,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('certificado_configuracoes').upsert(
    {
      id: CERTIFICADO_CONFIG_ID,
      nome_empresa: data.nome_empresa,
      subtitulo: data.subtitulo || null,
      endereco: data.endereco || null,
      whatsapp: data.whatsapp || null,
      telefone_secundario: data.telefone_secundario || null,
      instagram: data.instagram || null,
      cor_principal: data.cor_principal,
      texto_introducao: data.texto_introducao || null,
      termos_garantia: data.termos_garantia,
      beneficios: data.beneficios,
      nao_cobre: data.nao_cobre,
      recomendacoes: data.recomendacoes,
      texto_declaracao: data.texto_declaracao || null,
      texto_agradecimento: data.texto_agradecimento || null,
      texto_validade: data.texto_validade || null,
    },
    { onConflict: 'id' },
  )
  return { error: error?.message ?? null }
}
