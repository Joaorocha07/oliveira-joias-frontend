import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export async function listarVendedoresAtivos(): Promise<{ data: Profile[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'vendedor')
    .eq('ativo', true)
    .order('nome')

  if (error) return { data: null, error: error.message }
  return { data: data as Profile[], error: null }
}
