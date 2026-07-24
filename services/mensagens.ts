import { supabase } from '@/lib/supabase'
import type { MensagemModelo, MensagemModeloInsert } from '@/types'

export async function listarMensagensModelo(): Promise<{ data: MensagemModelo[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('mensagens_modelo')
    .select('*')
    .eq('ativo', true)
    .order('categoria')
    .order('titulo')

  if (error) return { data: null, error: error.message }
  return { data: data as MensagemModelo[], error: null }
}

export async function criarMensagemModelo(data: MensagemModeloInsert): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mensagens_modelo').insert(data)
  return { error: error?.message ?? null }
}

export async function atualizarMensagemModelo(
  id: string,
  data: Partial<MensagemModeloInsert>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mensagens_modelo').update(data).eq('id', id)
  return { error: error?.message ?? null }
}

export async function excluirMensagemModelo(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mensagens_modelo').update({ ativo: false }).eq('id', id)
  return { error: error?.message ?? null }
}

interface PreencherVars {
  nome?: string
  produto?: string
  empresa?: string
  endereco?: string
  instagram?: string
}

export function preencherMensagem(texto: string, vars: PreencherVars): string {
  return texto
    .replaceAll('{nome}', vars.nome || '')
    .replaceAll('{produto}', vars.produto || 'a peça que você procura')
    .replaceAll('{empresa}', vars.empresa || 'nossa loja')
    .replaceAll('{endereco}', vars.endereco || 'consulte o endereço com a loja')
    .replaceAll('{instagram}', vars.instagram || '')
}
