import { supabase } from '@/lib/supabase'
import { calcularCondicaoOrcamento } from '@/utils'
import type { OrcamentoFormData, OrcamentoConfiguracaoFormData } from '@/schemas/orcamento'
import type { Orcamento, OrcamentoModelo, OrcamentoMaterial, OrcamentoConfiguracao } from '@/types'

const ORCAMENTO_CONFIG_ID = '00000000-0000-0000-0000-000000000001'

function buildOrcamentoPayload(data: OrcamentoFormData) {
  const { percentual, parcelas, valorParcelado, valorParcela } = calcularCondicaoOrcamento(
    data.valor_vista,
    data.material,
  )
  return {
    cliente_nome: data.cliente_nome || null,
    cliente_telefone: data.cliente_telefone || null,
    modelo_nome: data.modelo_nome || null,
    material: data.material || null,
    largura: data.largura || null,
    itens_inclusos: data.itens_inclusos,
    valor_vista: data.valor_vista,
    percentual_acrescimo: percentual,
    num_parcelas: parcelas,
    valor_parcelado: valorParcelado,
    valor_parcela: valorParcela,
    prazo_fabricacao: data.prazo_fabricacao || null,
    observacoes: data.observacoes || null,
  }
}

export async function createOrcamento(
  data: OrcamentoFormData,
  userId: string,
): Promise<{ data: Orcamento | null; error: string | null }> {
  const { data: ultimo, error: ultimoError } = await supabase
    .from('orcamentos')
    .select('numero')
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ultimoError) return { data: null, error: ultimoError.message }
  const proximoNumero = (ultimo?.numero ?? 0) + 1

  const { data: result, error } = await supabase
    .from('orcamentos')
    .insert({ ...buildOrcamentoPayload(data), numero: proximoNumero, created_by: userId })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: result as Orcamento, error: null }
}

export async function updateOrcamento(
  id: string,
  data: OrcamentoFormData,
): Promise<{ data: Orcamento | null; error: string | null }> {
  const { data: result, error } = await supabase
    .from('orcamentos')
    .update(buildOrcamentoPayload(data))
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: result as Orcamento, error: null }
}

export async function deleteOrcamento(id: string): Promise<{ error: string | null }> {
  const { data: alvo, error: fetchError } = await supabase
    .from('orcamentos')
    .select('numero')
    .eq('id', id)
    .single()

  if (fetchError) return { error: fetchError.message }

  const { error } = await supabase.from('orcamentos').delete().eq('id', id)
  if (error) return { error: error.message }

  const { error: renumError } = await supabase.rpc('renumerar_orcamentos_apos_delete', {
    numero_excluido: alvo.numero,
  })
  return { error: renumError?.message ?? null }
}

export async function listOrcamentoModelos(): Promise<{ data: OrcamentoModelo[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orcamento_modelos')
    .select('*')
    .eq('ativo', true)
    .order('nome')

  if (error) return { data: null, error: error.message }
  return { data: data as OrcamentoModelo[], error: null }
}

export async function createOrcamentoModelo(
  nome: string,
  userId: string,
): Promise<{ data: OrcamentoModelo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orcamento_modelos')
    .insert({ nome, created_by: userId })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as OrcamentoModelo, error: null }
}

export async function deleteOrcamentoModelo(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('orcamento_modelos').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function listOrcamentoMateriais(): Promise<{ data: OrcamentoMaterial[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orcamento_materiais')
    .select('*')
    .eq('ativo', true)
    .order('nome')

  if (error) return { data: null, error: error.message }
  return { data: data as OrcamentoMaterial[], error: null }
}

export async function createOrcamentoMaterial(
  nome: string,
  userId: string,
): Promise<{ data: OrcamentoMaterial | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orcamento_materiais')
    .insert({ nome, created_by: userId })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as OrcamentoMaterial, error: null }
}

export async function deleteOrcamentoMaterial(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('orcamento_materiais').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function getOrcamentoConfiguracoes(): Promise<{ data: OrcamentoConfiguracao; error: string | null }> {
  const { data, error } = await supabase
    .from('orcamento_configuracoes')
    .select('*')
    .eq('id', ORCAMENTO_CONFIG_ID)
    .maybeSingle()

  if (error) {
    return {
      data: {
        id: ORCAMENTO_CONFIG_ID,
        nome_empresa: 'Oliveira Joias',
        contato: null,
        endereco: null,
        whatsapp: null,
        instagram: null,
        texto_rodape: null,
        cor_principal: '#C9A84C',
        created_at: '',
        updated_at: '',
      },
      error: error.message,
    }
  }

  return {
    data: (data as OrcamentoConfiguracao) ?? {
      id: ORCAMENTO_CONFIG_ID,
      nome_empresa: 'Oliveira Joias',
      contato: null,
      endereco: null,
      whatsapp: null,
      instagram: null,
      texto_rodape: null,
      cor_principal: '#C9A84C',
      created_at: '',
      updated_at: '',
    },
    error: null,
  }
}

export async function upsertOrcamentoConfiguracoes(
  data: OrcamentoConfiguracaoFormData,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('orcamento_configuracoes')
    .upsert(
      {
        id: ORCAMENTO_CONFIG_ID,
        nome_empresa: data.nome_empresa,
        contato: data.contato || null,
        endereco: data.endereco || null,
        whatsapp: data.whatsapp || null,
        instagram: data.instagram || null,
        texto_rodape: data.texto_rodape || null,
        cor_principal: data.cor_principal,
      },
      { onConflict: 'id' },
    )

  return { error: error?.message ?? null }
}
