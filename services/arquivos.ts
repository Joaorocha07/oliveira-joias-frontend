import { supabase } from '@/lib/supabase'
import type { ClienteArquivo, ClienteArquivoTipo } from '@/types'

const BUCKET = 'crm-arquivos'

export function getArquivoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function listarArquivos(clienteId: string): Promise<{ data: ClienteArquivo[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cliente_arquivos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as ClienteArquivo[], error: null }
}

export async function uploadArquivo(
  clienteId: string,
  file: File,
  tipo: ClienteArquivoTipo,
  userId: string,
): Promise<{ error: string | null }> {
  const path = `${clienteId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from('cliente_arquivos').insert({
    cliente_id: clienteId,
    tipo,
    nome: file.name,
    url: path,
    created_by: userId,
  })
  return { error: error?.message ?? null }
}

export async function excluirArquivo(arquivo: ClienteArquivo): Promise<{ error: string | null }> {
  await supabase.storage.from(BUCKET).remove([arquivo.url])
  const { error } = await supabase.from('cliente_arquivos').delete().eq('id', arquivo.id)
  return { error: error?.message ?? null }
}
