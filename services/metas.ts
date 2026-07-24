import { supabase } from '@/lib/supabase'
import type { MetaMensal } from '@/types'

export async function listarMetasMensais(mes: string): Promise<{ data: MetaMensal[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('metas_mensais')
    .select('*, vendedor:profiles(id, nome)')
    .eq('mes', mes)

  if (error) return { data: null, error: error.message }
  return { data: data as MetaMensal[], error: null }
}

export async function upsertMetaMensal(
  mes: string,
  vendedorId: string | null,
  valorMeta: number,
  userId: string,
): Promise<{ error: string | null }> {
  let query = supabase.from('metas_mensais').select('id').eq('mes', mes)
  query = vendedorId ? query.eq('vendedor_id', vendedorId) : query.is('vendedor_id', null)
  const { data: existente } = await query.maybeSingle()

  if (existente) {
    const { error } = await supabase.from('metas_mensais').update({ valor_meta: valorMeta }).eq('id', existente.id)
    return { error: error?.message ?? null }
  }

  const { error } = await supabase.from('metas_mensais').insert({
    mes, vendedor_id: vendedorId, valor_meta: valorMeta, created_by: userId,
  })
  return { error: error?.message ?? null }
}
